// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

func issue(repo string, n int) models.Issue {
	at := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	return models.Issue{Repo: repo, Number: n, Title: "t", State: "open", Kind: "bug", CreatedAt: at, UpdatedAt: at}
}

func countByRepo(t *testing.T, r *Repo) map[string]int {
	t.Helper()
	all, err := r.ListIssues(context.Background(), "all")
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]int{}
	for _, is := range all {
		out[is.Repo]++
	}
	return out
}

func TestIssueNumbersAreOnlyUniqueWithinARepo(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	both := []string{"a/one", "b/two"}
	if err := r.SaveIssues(ctx, 1, both, both, []models.Issue{issue("a/one", 1), issue("b/two", 1)}); err != nil {
		t.Fatal(err)
	}
	if got := countByRepo(t, r); got["a/one"] != 1 || got["b/two"] != 1 {
		t.Errorf("counts = %v, want #1 in each repo", got)
	}
}

func TestAFailedRepoKeepsItsIssuesAndAnUnconfiguredOneLosesThem(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	all := []string{"a/one", "b/two", "c/three"}
	if err := r.SaveIssues(ctx, 1, all, all, []models.Issue{issue("a/one", 1), issue("a/one", 2), issue("b/two", 1), issue("c/three", 1)}); err != nil {
		t.Fatal(err)
	}
	// Poll 2: a/one read fine and #2 is gone; b/two failed; c/three is no longer configured.
	if err := r.SaveIssues(ctx, 2, []string{"a/one", "b/two"}, []string{"a/one"}, []models.Issue{issue("a/one", 1)}); err != nil {
		t.Fatal(err)
	}
	got := countByRepo(t, r)
	if got["a/one"] != 1 {
		t.Errorf("a/one = %d, want the issue that vanished upstream removed", got["a/one"])
	}
	if got["b/two"] != 1 {
		t.Errorf("b/two = %d, want its last issues kept while it fails", got["b/two"])
	}
	if got["c/three"] != 0 {
		t.Errorf("c/three = %d, want an unconfigured repo's issues removed", got["c/three"])
	}
}

func TestSaveIssuesWithNothingConfiguredClearsEverything(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	if err := r.SaveIssues(ctx, 1, []string{"a/one"}, []string{"a/one"}, []models.Issue{issue("a/one", 1)}); err != nil {
		t.Fatal(err)
	}
	if err := r.SaveIssues(ctx, 2, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if got := countByRepo(t, r); len(got) != 0 {
		t.Errorf("counts = %v, want none", got)
	}
}

func TestDismissAndRestore(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	at := time.Now()
	for i := 0; i < 2; i++ { // twice: dismissing again changes nothing
		if err := r.Dismiss(ctx, "no_latest_minecraft", "turbolifts", at); err != nil {
			t.Fatal(err)
		}
	}
	got, err := r.Dismissals(ctx)
	if err != nil || len(got) != 1 || got[0].Kind != "no_latest_minecraft" || got[0].ModSlug != "turbolifts" {
		t.Fatalf("dismissals = %+v, err %v", got, err)
	}
	if err := r.Restore(ctx, "no_latest_minecraft", "turbolifts"); err != nil {
		t.Fatal(err)
	}
	if err := r.Restore(ctx, "no_latest_minecraft", "turbolifts"); err != nil {
		t.Fatalf("restoring twice: %v", err)
	}
	if got, _ := r.Dismissals(ctx); len(got) != 0 {
		t.Errorf("dismissals = %+v, want none", got)
	}
}

func TestPerModRepoOnACatalogEntry(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	at := time.Now()
	ps := []models.PlatformReading{
		{PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "1", Slug: "one", Name: "One", Owned: true}},
		{PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "2", Slug: "two", Name: "Two", Owned: true}},
	}
	if _, err := r.SavePollWithProjects(ctx, models.Poll{StartedAt: at, FinishedAt: at}, nil, nil, ps, nil); err != nil {
		t.Fatal(err)
	}
	repo := "me/one-issues"
	e, err := r.UpdateCatalogEntry(ctx, "one", models.CatalogUpdate{GitHubRepo: models.Patch[string]{Set: true, Value: &repo}})
	if err != nil || e.GitHubRepo == nil || *e.GitHubRepo != repo || e.Auto {
		t.Fatalf("set: %+v, %v", e, err)
	}
	// The same repository on another mod is refused, whatever the case.
	other := "ME/One-Issues"
	if _, err := r.UpdateCatalogEntry(ctx, "two", models.CatalogUpdate{GitHubRepo: models.Patch[string]{Set: true, Value: &other}}); err == nil {
		t.Error("a repository can belong to one mod only")
	}
	for _, bad := range []string{"noslash", "a/b/c", "a b/c"} {
		b := bad
		var inv *InvalidError
		if _, err := r.UpdateCatalogEntry(ctx, "two", models.CatalogUpdate{GitHubRepo: models.Patch[string]{Set: true, Value: &b}}); !asInvalid(err, &inv) {
			t.Errorf("%q: err = %v, want InvalidError", bad, err)
		}
	}
	ix, _ := r.CatalogIndex(ctx)
	if slug, ok := ix.SlugForRepo("ME/ONE-issues"); !ok || slug != "one" {
		t.Errorf("SlugForRepo = %q %v", slug, ok)
	}
	if got := ix.Repos(); len(got) != 1 || got[0] != repo {
		t.Errorf("Repos = %v", got)
	}
	// Clearing it again works.
	if e, err := r.UpdateCatalogEntry(ctx, "one", models.CatalogUpdate{GitHubRepo: models.Patch[string]{Set: true}}); err != nil || e.GitHubRepo != nil {
		t.Errorf("clear: %+v, %v", e, err)
	}
}

func asInvalid(err error, target **InvalidError) bool {
	if e, ok := err.(*InvalidError); ok {
		*target = e
		return true
	}
	return false
}
