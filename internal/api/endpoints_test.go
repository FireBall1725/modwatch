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
	"github.com/fireball1725/modwatch/internal/db"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/poll"
	"github.com/fireball1725/modwatch/internal/repository"
)

// fullServer holds one mod on both platforms (Modrinth in review, queued 9 days ago), a member mod,
// an open crash, an unlinked label and a failed Modrinth source.
func fullServer(t *testing.T) http.Handler {
	t.Helper()
	conn, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	repo := repository.New(conn)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)

	proj := func(platform, id, slug, name string, status models.ReviewStatus, owned bool, n int64) models.PlatformReading {
		return models.PlatformReading{
			PlatformProject: models.PlatformProject{
				Platform: platform, ID: id, Slug: slug, Name: name, Status: status, RawStatus: string(status), Owned: owned,
				URL: "https://example.test/" + slug, IconURL: "https://img/" + slug,
			},
			Downloads: n,
		}
	}
	mr := proj("modrinth", "m1", "tower", "Tower", models.StatusInReview, true, 20)
	mr.QueuedAt = now.AddDate(0, 0, -9)
	mr.StatusMessage = "needs a licence"
	fr := func(source, project, id string, at time.Time, n int64, gv ...string) models.FileReading {
		return models.FileReading{File: models.File{
			Source: source, ID: id, ProjectID: project, ProjectSlug: project, ProjectName: "Tower", Name: id, Version: id,
			ReleaseType: "release", GameVersions: gv, Loaders: []string{"neoforge"}, PublishedAt: at,
		}, Downloads: n}
	}
	poll1 := models.Poll{StartedAt: now.Add(-time.Second), FinishedAt: now}
	id, err := repo.SavePollWithProjects(ctx, poll1, nil,
		[]models.FileReading{
			fr("curseforge", "1", "cf-file", now.AddDate(0, 0, -30), 100, "1.21.1"),
			fr("modrinth", "m1", "mr-file", now.AddDate(0, 0, -2), 20, "26.1"),
		},
		[]models.PlatformReading{
			proj("curseforge", "1", "tower", "Tower", models.StatusApproved, true, 100), mr,
			proj("curseforge", "9", "ae2", "Applied Energistics 2", models.StatusApproved, false, 9999),
		},
		[]models.SourceStatus{
			{Source: "curseforge", OK: true, CheckedAt: now, LastOKAt: now},
			{Source: "modrinth", OK: false, Error: "boom", Detail: poll.MissingTokenDetail, CheckedAt: now},
		})
	if err != nil {
		t.Fatal(err)
	}
	issues := []models.Issue{
		{Number: 5, Title: "crash on load", State: "open", Kind: "crash", ModLabel: "tower", URL: "https://gh/5", CreatedAt: now.AddDate(0, 0, -3), UpdatedAt: now},
		{Number: 6, Title: "who", State: "open", Kind: "other", ModLabel: "ghost", CreatedAt: now, UpdatedAt: now},
	}
	if err := repo.SaveIssues(ctx, id, issues); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Schedule: "0 * * * *", GitHubIssuesRepo: "o/r"}
	return NewRouter(cfg, repo, poll.New(ctx, cfg, repo, noSource{}, nil))
}

func decode[T any](t *testing.T, h http.Handler, path string) T {
	t.Helper()
	rec := get(t, h, path)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s: status %d: %s", path, rec.Code, rec.Body)
	}
	var out T
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("%s: %v", path, err)
	}
	return out
}

func TestOverview(t *testing.T) {
	o := decode[overviewResponse](t, fullServer(t), "/api/v1/overview")
	if o.Totals.Mods != 1 || len(o.Mods) != 1 || o.Mods[0].Slug != "tower" {
		t.Fatalf("mods = %+v", o.Mods)
	}
	if o.Totals.Downloads.Total != 120 || o.Totals.Downloads.CurseForge != 100 || o.Totals.Downloads.Modrinth != 20 {
		t.Errorf("downloads = %+v", o.Totals.Downloads)
	}
	if o.Totals.Downloads.Delta24h != nil {
		t.Errorf("a fresh install has no deltas, got %v", *o.Totals.Downloads.Delta24h)
	}
	if o.Totals.OpenIssues != 2 || o.Totals.OpenCrashes != 1 || o.Totals.NeedAttention != 1 || o.Totals.InReview != 1 {
		t.Errorf("totals = %+v", o.Totals)
	}
	if o.Mods[0].Health != healthProblem {
		t.Errorf("health = %s", o.Mods[0].Health)
	}
	kinds := itemKinds(o.Attention)
	for _, want := range []string{"problem:crash_open", "warning:review_stuck", "warning:source_down", "info:unlinked"} {
		if !containsStr(kinds, want) {
			t.Errorf("attention %v is missing %s", kinds, want)
		}
	}
	if kinds[0] != "problem:crash_open" {
		t.Errorf("problems come first: %v", kinds)
	}
	if len(o.RecentReleases) != 2 || o.RecentReleases[0].Name != "mr-file" {
		t.Errorf("releases = %+v", o.RecentReleases)
	}
	if len(o.Sources) != 2 || o.Sources[0].LastOKAt == nil || o.Sources[1].LastOKAt != nil || o.Sources[1].Detail != poll.MissingTokenDetail {
		t.Errorf("sources = %+v", o.Sources)
	}
	if o.LastOKPoll == nil || o.Problems == nil {
		t.Errorf("poll %v problems %v", o.LastOKPoll, o.Problems)
	}
}

func TestOverviewEmptyDatabase(t *testing.T) {
	body := get(t, newServer(t), "/api/v1/overview").Body.String()
	for _, want := range []string{
		`"attention":[]`, `"mods":[]`, `"recentReleases":[]`, `"sources":[]`, `"problems":[`,
		`"lastPoll":null`, `"lastOkPoll":null`,
		`"totals":{"mods":0,"downloads":{"total":0,"curseforge":0,"modrinth":0,"delta24h":null,"delta7d":null},"openIssues":0,"openBugs":0,"openCrashes":0,"needAttention":0,"inReview":0}`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %s\n%s", want, body)
		}
	}
}

func TestModsList(t *testing.T) {
	mods := decode[[]modSummary](t, fullServer(t), "/api/v1/mods")
	if len(mods) != 2 || mods[0].Slug != "ae2" || mods[1].Slug != "tower" {
		t.Fatalf("mods = %+v", mods)
	}
	if mods[0].Owned || mods[0].Health != healthOK || mods[0].Attention == nil {
		t.Errorf("member = %+v", mods[0])
	}
	tw := mods[1]
	if tw.CurseForge == nil || tw.Modrinth == nil || tw.Modrinth.Status != "in_review" ||
		tw.Modrinth.StatusMessage == nil || *tw.Modrinth.StatusMessage != "needs a licence" || tw.Modrinth.QueuedAt == nil {
		t.Errorf("tower = %+v", tw)
	}
	if tw.Github == nil || tw.Github.OpenCrashes != 1 {
		t.Errorf("github = %+v", tw.Github)
	}
	if want := []string{"26.1", "1.21.1"}; strings.Join(tw.MinecraftVersions, ",") != strings.Join(want, ",") {
		t.Errorf("versions = %v", tw.MinecraftVersions)
	}
}

func TestModsEmptyDatabase(t *testing.T) {
	if got := strings.TrimSpace(get(t, newServer(t), "/api/v1/mods").Body.String()); got != "[]" {
		t.Errorf("mods = %s", got)
	}
}

func TestModDetail(t *testing.T) {
	h := fullServer(t)
	d := decode[modDetail](t, h, "/api/v1/mods/tower")
	if d.Slug != "tower" || len(d.Files) != 2 || d.Files[0].Name != "cf-file" {
		t.Errorf("detail = %+v", d)
	}
	if d.Files[0].URL == nil || *d.Files[0].URL != "https://example.test/tower/files/cf-file" {
		t.Errorf("file url = %v", d.Files[0].URL)
	}
	if len(d.Issues) != 1 || d.Issues[0].Number != 5 {
		t.Errorf("issues = %+v", d.Issues)
	}
	if len(d.GameVersions) != 2 || d.GameVersions[0].Name != "26.1" || d.GameVersions[0].Modrinth != 20 {
		t.Errorf("game versions = %+v", d.GameVersions)
	}
	if len(d.History) == 0 || d.History[len(d.History)-1].CurseForge != 100 || d.History[len(d.History)-1].Modrinth != 20 {
		t.Errorf("history = %+v", d.History)
	}
	if d.Links.CurseForge == nil || d.Links.Github == nil || *d.Links.Github != "https://github.com/o/r" || d.Links.Wiki != nil {
		t.Errorf("links = %+v", d.Links)
	}
	body := get(t, h, "/api/v1/mods/tower").Body.String()
	for _, want := range []string{`"wiki":null`, `"discord":null`, `"delta24h":null`} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %s", want)
		}
	}
}

func TestModDetailUnknownIs404(t *testing.T) {
	for _, h := range []http.Handler{newServer(t), fullServer(t)} {
		rec := get(t, h, "/api/v1/mods/nope")
		if rec.Code != http.StatusNotFound || !strings.Contains(rec.Body.String(), `"error"`) {
			t.Errorf("status %d body %s", rec.Code, rec.Body)
		}
	}
}

func TestModDetailWithNothingStoredHasEmptyLists(t *testing.T) {
	h := fullServer(t)
	body := get(t, h, "/api/v1/mods/ae2").Body.String()
	for _, want := range []string{`"files":[]`, `"issues":[]`, `"gameVersions":[]`, `"attention":[]`, `"curseforge":{`, `"modrinth":null`} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %s\n%s", want, body)
		}
	}
}

func TestDownloadsHistoryEndpoint(t *testing.T) {
	h := fullServer(t)
	hist := decode[downloadsHistory](t, h, "/api/v1/downloads/history")
	if hist.Days != 90 || len(hist.Total) != 1 || hist.Total[0].CurseForge != 100 || hist.Total[0].Modrinth != 20 {
		t.Errorf("history = %+v", hist)
	}
	if _, ok := hist.PerMod["tower"]; !ok {
		t.Errorf("perMod = %+v", hist.PerMod)
	}
	if got := decode[downloadsHistory](t, h, "/api/v1/downloads/history?days=7"); got.Days != 7 {
		t.Errorf("days = %d", got.Days)
	}
	for _, q := range []string{"days=0", "days=3651", "days=abc", "days=-1"} {
		if rec := get(t, h, "/api/v1/downloads/history?"+q); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d", q, rec.Code)
		}
	}
	if rec := get(t, h, "/api/v1/downloads/history?days=3650"); rec.Code != http.StatusOK {
		t.Errorf("3650 days: status %d", rec.Code)
	}
	empty := get(t, newServer(t), "/api/v1/downloads/history").Body.String()
	if !strings.Contains(empty, `"total":[]`) || !strings.Contains(empty, `"perMod":{}`) {
		t.Errorf("empty = %s", empty)
	}
}

func TestVersionsEndpointShape(t *testing.T) {
	h := fullServer(t)
	v := decode[versionsResponse](t, h, "/api/v1/versions")
	if v.LatestMinecraft == nil || *v.LatestMinecraft != "26.1" {
		t.Errorf("latest = %v", v.LatestMinecraft)
	}
	if len(v.Matrix.Versions) != 2 || v.Matrix.Versions[0] != "26.1" || len(v.Matrix.Rows) != 1 {
		t.Errorf("matrix = %+v", v.Matrix)
	}
	if len(v.History["26.1"]) == 0 {
		t.Errorf("history = %+v", v.History)
	}
	empty := get(t, newServer(t), "/api/v1/versions").Body.String()
	for _, want := range []string{`"latestMinecraft":null`, `"gameVersions":[]`, `"loaders":[]`, `"matrix":{"versions":[],"rows":[]}`, `"history":{}`} {
		if !strings.Contains(empty, want) {
			t.Errorf("empty versions missing %s\n%s", want, empty)
		}
	}
}

func TestReleasesEndpoint(t *testing.T) {
	h := fullServer(t)
	r := decode[[]releaseItem](t, h, "/api/v1/releases")
	if len(r) != 2 || r[0].Name != "mr-file" || r[1].Name != "cf-file" {
		t.Errorf("releases = %+v", r)
	}
	if got := decode[[]releaseItem](t, h, "/api/v1/releases?limit=1"); len(got) != 1 {
		t.Errorf("limit: %d", len(got))
	}
	for _, q := range []string{"limit=0", "limit=501", "limit=x"} {
		if rec := get(t, h, "/api/v1/releases?"+q); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d", q, rec.Code)
		}
	}
	if got := strings.TrimSpace(get(t, newServer(t), "/api/v1/releases").Body.String()); got != "[]" {
		t.Errorf("empty = %s", got)
	}
}

func TestSummaryReportsNeverOKAsNull(t *testing.T) {
	body := get(t, fullServer(t), "/api/v1/summary").Body.String()
	if !strings.Contains(body, `"lastOkAt":null`) {
		t.Errorf("body = %s", body)
	}
}

func TestProjectMetrics(t *testing.T) {
	body := get(t, fullServer(t), "/metrics").Body.String()
	for _, want := range []string{
		"# TYPE modwatch_project_downloads_total counter",
		`modwatch_project_downloads_total{platform="curseforge",slug="tower",name="Tower"} 100`,
		`modwatch_project_downloads_total{platform="modrinth",slug="tower",name="Tower"} 20`,
		`modwatch_project_downloads_total{platform="curseforge",slug="ae2",name="Applied Energistics 2"} 9999`,
		`modwatch_project_review_status{platform="modrinth",slug="tower",status="in_review"} 1`,
		`modwatch_project_review_status{platform="curseforge",slug="tower",status="approved"} 1`,
		`modwatch_mod_health{slug="tower",health="problem"} 1`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("metrics missing %q\n%s", want, body)
		}
	}
	if strings.Contains(body, `status="approved"} 0`) || strings.Count(body, `modwatch_mod_health{slug="tower"`) != 1 {
		t.Error("review status and health carry one series each, valued 1")
	}
	// Queued nine days ago: 9 days is 777600 seconds, a little more by now.
	queue := ""
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, `modwatch_project_review_queue_seconds{platform="modrinth",slug="tower"}`) {
			queue = line
		}
	}
	if !strings.Contains(queue, "7776") {
		t.Errorf("queue line = %q", queue)
	}
	if strings.Contains(body, `modwatch_project_review_queue_seconds{platform="curseforge"`) {
		t.Error("the queue series exists only while in review")
	}
	if strings.Contains(body, `modwatch_mod_health{slug="ae2"`) {
		t.Error("member mods have no health series")
	}
}

func TestProjectMetricsAbsentOnEmptyDatabase(t *testing.T) {
	body := get(t, newServer(t), "/metrics").Body.String()
	for _, name := range []string{"modwatch_project_downloads_total", "modwatch_project_review_status", "modwatch_mod_health"} {
		if strings.Contains(body, name) {
			t.Errorf("%s should not appear with no projects", name)
		}
	}
}
