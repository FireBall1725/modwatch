// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/db/dbtest"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/poll"
	"github.com/fireball1725/modwatch/internal/repository"
)

func issuesServer(t *testing.T) (http.Handler, *repository.Repo) {
	t.Helper()
	conn := dbtest.Open(t)
	repo := repository.New(conn)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)
	p := models.Poll{StartedAt: now.Add(-time.Second), FinishedAt: now}
	ps := []models.PlatformReading{{PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "1", Slug: "turbolifts", Name: "Create: Turbolifts", Owned: true}}}
	id, err := repo.SavePollWithProjects(ctx, p, nil, nil, ps, nil)
	if err != nil {
		t.Fatal(err)
	}
	day := func(n int) time.Time { return now.Add(-time.Duration(n) * 24 * time.Hour) }
	issues := []models.Issue{
		{Number: 1, Title: "crash", State: "open", Kind: "crash", ModLabel: "turbolifts", Labels: []string{"crash", "mod: turbolifts"}, CreatedAt: day(10), UpdatedAt: day(1)},
		{Number: 2, Title: "bug", State: "open", Kind: "bug", ModLabel: "turbolifts", CreatedAt: day(5), UpdatedAt: day(2)},
		{Number: 3, Title: "unlinked", State: "open", Kind: "enhancement", ModLabel: "mystery", CreatedAt: day(3), UpdatedAt: day(3)},
		{Number: 4, Title: "closed", State: "closed", Kind: "bug", ModLabel: "turbolifts", CreatedAt: day(9), UpdatedAt: day(4), ClosedAt: day(4)},
		{Number: 5, Title: "no label", State: "open", Kind: "other", CreatedAt: day(1), UpdatedAt: day(0)},
	}
	for i := range issues {
		issues[i].Repo = "o/r"
	}
	if err := repo.SaveIssues(ctx, id, []string{"o/r"}, []string{"o/r"}, issues); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Schedule: "0 * * * *", GitHubIssuesRepo: "o/r"}
	return NewRouter(cfg, repo, poll.New(ctx, cfg, repo, noSource{}, nil)), repo
}

func decodeIssues(t *testing.T, h http.Handler, path string) issuesResponse {
	t.Helper()
	rec := get(t, h, path)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s: status %d: %s", path, rec.Code, rec.Body)
	}
	var out issuesResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func numbers(is []issueItem) []int {
	out := []int{}
	for _, i := range is {
		out = append(out, i.Number)
	}
	return out
}

func TestIssuesStateFilterAndOrder(t *testing.T) {
	h, _ := issuesServer(t)
	for path, want := range map[string][]int{
		"/api/v1/issues":              {5, 1, 2, 3},
		"/api/v1/issues?state=open":   {5, 1, 2, 3},
		"/api/v1/issues?state=closed": {4},
		"/api/v1/issues?state=all":    {5, 1, 2, 3, 4},
	} {
		got := numbers(decodeIssues(t, h, path).Issues)
		if len(got) != len(want) {
			t.Errorf("%s = %v, want %v", path, got, want)
			continue
		}
		for i := range got {
			if got[i] != want[i] {
				t.Errorf("%s = %v, want %v", path, got, want)
				break
			}
		}
	}
}

func TestIssuesBadState(t *testing.T) {
	h, _ := issuesServer(t)
	if rec := get(t, h, "/api/v1/issues?state=nope"); rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d", rec.Code)
	}
}

func TestIssuesSummaryAndMapping(t *testing.T) {
	h, _ := issuesServer(t)
	out := decodeIssues(t, h, "/api/v1/issues?state=closed")
	if out.Repo != "o/r" {
		t.Errorf("repo = %q", out.Repo)
	}
	s := out.Summary
	if s.Open != 4 || s.Closed != 1 || s.OpenBugs != 1 || s.OpenCrashes != 1 || s.OldestOpenAt == nil {
		t.Errorf("summary = %+v", s)
	}
	if len(s.ByKind) != 6 || s.ByKind[0].Kind != "bug" || s.ByKind[5].Kind != "other" {
		t.Errorf("byKind = %+v", s.ByKind)
	}
	if len(s.ByMod) != 2 || s.ByMod[0].Slug != "turbolifts" || s.ByMod[0].Open != 2 || s.ByMod[0].Bugs != 1 || s.ByMod[0].Crashes != 1 || s.ByMod[1].Slug != "mystery" {
		t.Errorf("byMod = %+v", s.ByMod)
	}
}

func TestIssuesLinkThroughCatalog(t *testing.T) {
	h, _ := issuesServer(t)
	// The poll auto-linked the CurseForge project to an entry with slug "turbolifts".
	all := decodeIssues(t, h, "/api/v1/issues?state=all")
	for _, is := range all.Issues {
		switch is.Number {
		case 1, 2, 4:
			if is.ModSlug == nil || *is.ModSlug != "turbolifts" || *is.ModName != "Create: Turbolifts" {
				t.Errorf("issue %d not linked: %+v", is.Number, is)
			}
		case 3:
			if is.ModSlug != nil || is.ModLabel == nil || *is.ModLabel != "mystery" {
				t.Errorf("issue 3 = %+v", is)
			}
		case 5:
			if is.ModSlug != nil || is.ModLabel != nil {
				t.Errorf("issue 5 = %+v", is)
			}
		}
		if is.Number == 4 && (is.ClosedAt == nil || is.State != "closed") {
			t.Errorf("closed issue = %+v", is)
		}
	}

	rec := get(t, h, "/api/v1/catalog")
	var cat catalogResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &cat); err != nil {
		t.Fatal(err)
	}
	if len(cat.Unlinked.GitHubLabels) != 1 || cat.Unlinked.GitHubLabels[0] != (gitHubLabel{Label: "mystery", Issues: 1}) {
		t.Errorf("unlinked labels = %+v", cat.Unlinked.GitHubLabels)
	}

	// Setting the label on the entry claims the issues, and an entry label beats a slug match.
	rec = send(h, http.MethodPut, "/api/v1/catalog/turbolifts", `{"githubLabel":"mystery"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("put: %d %s", rec.Code, rec.Body)
	}
	out := decodeIssues(t, h, "/api/v1/issues?state=all")
	for _, is := range out.Issues {
		if is.Number == 3 && (is.ModSlug == nil || *is.ModSlug != "turbolifts") {
			t.Errorf("issue 3 should follow the entry's githubLabel: %+v", is)
		}
		if is.Number == 1 && is.ModSlug != nil {
			t.Errorf("slug match must not apply once githubLabel is set: %+v", is)
		}
	}
}

func TestIssuesEmptyShape(t *testing.T) {
	h := newServer(t)
	rec := get(t, h, "/api/v1/issues")
	body := rec.Body.String()
	for _, want := range []string{`"issues":[]`, `"byMod":[]`, `"oldestOpenAt":null`} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %s: %s", want, body)
		}
	}
	if strings.Count(body, `"kind"`) != 6 {
		t.Errorf("byKind must list every kind: %s", body)
	}
}

func TestIssueMetrics(t *testing.T) {
	h, _ := issuesServer(t)
	body := get(t, h, "/metrics").Body.String()
	for _, want := range []string{
		`modwatch_issues_open{mod="turbolifts",kind="crash"} 1`,
		`modwatch_issues_open{mod="turbolifts",kind="bug"} 1`,
		`modwatch_issues_open{mod="mystery",kind="enhancement"} 1`,
		`modwatch_issues_open{mod="unlabelled",kind="other"} 1`,
		`modwatch_oldest_open_bug_age_seconds{mod="turbolifts"} 864`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("metrics missing %q\n%s", want, body)
		}
	}
	if strings.Contains(body, `oldest_open_bug_age_seconds{mod="mystery"}`) {
		t.Error("a mod with no open bug must have no age series")
	}
}
