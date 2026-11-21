// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

var testNow = time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)

func i64(n int64) *int64 { return &n }

func proj(platform, id, slug string, status models.ReviewStatus, downloads int64) models.PlatformStat {
	return models.PlatformStat{
		PlatformProject: models.PlatformProject{
			Platform: platform, ID: id, Slug: slug, Name: slug, Status: status, Owned: true, URL: "https://example.test/" + slug,
		},
		Downloads: downloads,
	}
}

// entry links a catalog entry to a CurseForge id (a number as text) and a Modrinth id, either of which may be "".
func entry(slug, cf, mr string) models.CatalogEntry {
	e := models.CatalogEntry{Slug: slug, Name: slug}
	if cf != "" {
		n, _ := strconv.ParseInt(cf, 10, 64)
		e.CurseForgeID = &n
	}
	if mr != "" {
		e.ModrinthID = &mr
	}
	return e
}

func file(source, project, id string, published time.Time, downloads int64, gv ...string) models.FileStat {
	return models.FileStat{
		File: models.File{
			Source: source, ID: id, ProjectID: project, ProjectSlug: project, ProjectName: project, Name: id, Version: id,
			ReleaseType: "release", GameVersions: gv, Loaders: []string{"neoforge"}, PublishedAt: published,
		},
		Downloads: downloads,
	}
}

func build(ds dataset) *view {
	if ds.now.IsZero() {
		ds.now = testNow
	}
	return newView(&ds, true)
}

func itemKinds(items []attentionItem) []string {
	out := []string{}
	for _, it := range items {
		out = append(out, it.Severity+":"+it.Kind)
	}
	return out
}

func attentionOf(t *testing.T, v *view, slug string) []attentionItem {
	t.Helper()
	g := v.bySlug[slug]
	if g == nil {
		t.Fatalf("no group %q", slug)
	}
	return v.summary(g).Attention
}

func TestAttentionIssues(t *testing.T) {
	both := func(is ...models.Issue) *view {
		return build(dataset{
			stats:   []models.PlatformStat{proj("curseforge", "1", "a", models.StatusApproved, 1), proj("modrinth", "m1", "a", models.StatusApproved, 1)},
			entries: []models.CatalogEntry{entry("a", "1", "m1")},
			issues:  is,
		})
	}
	crash := models.Issue{Number: 12, Title: "boom", State: "open", Kind: "crash", ModLabel: "a", URL: "https://gh/12"}
	bug := models.Issue{Number: 13, Title: "oops", State: "open", Kind: "bug", ModLabel: "a"}
	closedCrash := crash
	closedCrash.State = "closed"
	idea := models.Issue{Number: 14, State: "open", Kind: "enhancement", ModLabel: "a"}

	got := attentionOf(t, both(crash, bug), "a")
	if want := []string{"problem:crash_open", "warning:bug_open"}; !reflect.DeepEqual(itemKinds(got), want) {
		t.Fatalf("items = %v, want %v", itemKinds(got), want)
	}
	if got[0].Title != "a has an open crash (#12)" || got[0].URL == nil || *got[0].URL != "https://gh/12" || got[0].ModSlug == nil || *got[0].ModSlug != "a" {
		t.Errorf("crash item = %+v", got[0])
	}
	if got := attentionOf(t, both(closedCrash, idea), "a"); len(got) != 0 {
		t.Errorf("a closed crash and an enhancement raise nothing, got %v", itemKinds(got))
	}
}

func TestAttentionPlatformStatus(t *testing.T) {
	tests := []struct {
		status models.ReviewStatus
		want   []string
		health string
	}{
		{models.StatusApproved, []string{}, healthOK},
		{models.StatusRejected, []string{"problem:not_approved"}, healthProblem},
		{models.StatusChangesRequired, []string{"problem:not_approved"}, healthProblem},
		{models.StatusDraft, []string{"warning:not_approved"}, healthAttention},
		{models.StatusUnlisted, []string{"warning:not_approved"}, healthAttention},
		{models.StatusArchived, []string{}, healthOK},
		{models.StatusInactive, []string{}, healthOK},
		{models.StatusUnknown, []string{}, healthOK},
	}
	for _, tt := range tests {
		v := build(dataset{
			stats:   []models.PlatformStat{proj("curseforge", "1", "a", models.StatusApproved, 1), proj("modrinth", "m1", "a", tt.status, 1)},
			entries: []models.CatalogEntry{entry("a", "1", "m1")},
		})
		s := v.summary(v.bySlug["a"])
		if got := itemKinds(s.Attention); !reflect.DeepEqual(got, tt.want) {
			t.Errorf("%s: items = %v, want %v", tt.status, got, tt.want)
		}
		if s.Health != tt.health {
			t.Errorf("%s: health = %s, want %s", tt.status, s.Health, tt.health)
		}
	}
}

func TestAttentionReviewThreshold(t *testing.T) {
	week := 7 * 24 * time.Hour
	tests := []struct {
		name   string
		queued time.Time
		seen   time.Time
		want   string
	}{
		{"queued six days ago", testNow.Add(-6 * 24 * time.Hour), time.Time{}, "info:review_pending"},
		{"queued exactly seven days ago", testNow.Add(-week), time.Time{}, "info:review_pending"},
		{"queued a second past seven days", testNow.Add(-week - time.Second), time.Time{}, "warning:review_stuck"},
		{"no queue time, first seen eight days ago", time.Time{}, testNow.Add(-8 * 24 * time.Hour), "warning:review_stuck"},
		{"no queue time, first seen two days ago", time.Time{}, testNow.Add(-2 * 24 * time.Hour), "info:review_pending"},
		{"queue time wins over first seen", testNow.Add(-time.Hour), testNow.Add(-30 * 24 * time.Hour), "info:review_pending"},
		{"no timing at all", time.Time{}, time.Time{}, "info:review_pending"},
	}
	for _, tt := range tests {
		p := proj("modrinth", "m1", "a", models.StatusInReview, 1)
		p.QueuedAt = tt.queued
		ds := dataset{
			stats:   []models.PlatformStat{proj("curseforge", "1", "a", models.StatusApproved, 1), p},
			entries: []models.CatalogEntry{entry("a", "1", "m1")},
			seen:    map[models.PlatformKey]time.Time{},
		}
		if !tt.seen.IsZero() {
			ds.seen[models.PlatformKey{Platform: "modrinth", ID: "m1"}] = tt.seen
		}
		v := build(ds)
		s := v.summary(v.bySlug["a"])
		if got := itemKinds(s.Attention); len(got) != 1 || got[0] != tt.want {
			t.Errorf("%s: items = %v, want [%s]", tt.name, got, tt.want)
		}
		wantHealth := healthOK
		if tt.want == "warning:review_stuck" {
			wantHealth = healthAttention
		}
		if s.Health != wantHealth {
			t.Errorf("%s: health = %s, want %s", tt.name, s.Health, wantHealth)
		}
	}
}

func TestAttentionNoLatestMinecraft(t *testing.T) {
	cutoff := testNow.AddDate(0, -12, 0)
	tests := []struct {
		name      string
		published time.Time
		versions  []string
		want      bool
	}{
		{"recent release, older version only", testNow.AddDate(0, -11, 0), []string{"1.21.1"}, true},
		{"release a second inside twelve months", cutoff.Add(time.Second), []string{"1.21.1"}, true},
		{"release exactly twelve months ago", cutoff, []string{"1.21.1"}, false},
		{"release thirteen months ago", testNow.AddDate(0, -13, 0), []string{"1.21.1"}, false},
		{"recent release that has the newest version", testNow.AddDate(0, -1, 0), []string{"1.21.1", "26.1"}, false},
	}
	for _, tt := range tests {
		v := build(dataset{
			stats: []models.PlatformStat{
				proj("curseforge", "1", "old", models.StatusApproved, 1), proj("modrinth", "m1", "old", models.StatusApproved, 1),
				proj("curseforge", "2", "new", models.StatusApproved, 1), proj("modrinth", "m2", "new", models.StatusApproved, 1),
			},
			entries: []models.CatalogEntry{entry("old", "1", "m1"), entry("new", "2", "m2")},
			files: []models.FileStat{
				file("curseforge", "1", "f1", tt.published, 1, tt.versions...),
				file("curseforge", "2", "f2", testNow.AddDate(0, 0, -1), 1, "26.1"),
			},
		})
		if v.latestMC != "26.1" {
			t.Fatalf("latestMC = %q", v.latestMC)
		}
		got := false
		for _, it := range attentionOf(t, v, "old") {
			if it.Kind == "no_latest_minecraft" {
				got = true
				if it.Severity != sevWarning {
					t.Errorf("%s: severity = %s", tt.name, it.Severity)
				}
			}
		}
		if got != tt.want {
			t.Errorf("%s: flagged = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestAttentionMissingPlatformIsInfoOnly(t *testing.T) {
	v := build(dataset{
		stats: []models.PlatformStat{
			proj("curseforge", "1", "solo", models.StatusApproved, 1),
			proj("curseforge", "2", "pair", models.StatusApproved, 1), proj("modrinth", "m2", "pair", models.StatusApproved, 1),
			proj("modrinth", "m3", "mr-only", models.StatusApproved, 1),
		},
		entries: []models.CatalogEntry{entry("solo", "1", ""), entry("pair", "2", "m2"), entry("mr-only", "", "m3")},
	})
	s := v.summary(v.bySlug["solo"])
	if got := itemKinds(s.Attention); !reflect.DeepEqual(got, []string{"info:missing_platform"}) {
		t.Errorf("solo = %v", got)
	}
	if s.Attention[0].Title != "solo is only on CurseForge" || s.Attention[0].Detail != "No Modrinth project is linked" {
		t.Errorf("solo item = %+v", s.Attention[0])
	}
	if s.Health != healthOK {
		t.Errorf("info items must not change health, got %s", s.Health)
	}
	if got := v.summary(v.bySlug["mr-only"]).Attention[0].Title; got != "mr-only is only on Modrinth" {
		t.Errorf("title = %q", got)
	}
	if got := v.summary(v.bySlug["pair"]).Attention; len(got) != 0 {
		t.Errorf("pair = %v", itemKinds(got))
	}
}

func TestHealthRollUp(t *testing.T) {
	item := func(sev string) attentionItem { return attentionItem{Severity: sev} }
	tests := []struct {
		items []attentionItem
		want  string
	}{
		{nil, healthOK},
		{[]attentionItem{item(sevInfo), item(sevInfo)}, healthOK},
		{[]attentionItem{item(sevInfo), item(sevWarning)}, healthAttention},
		{[]attentionItem{item(sevWarning), item(sevProblem), item(sevInfo)}, healthProblem},
		{[]attentionItem{item(sevProblem)}, healthProblem},
	}
	for _, tt := range tests {
		if got := healthOf(tt.items); got != tt.want {
			t.Errorf("healthOf(%v) = %s, want %s", tt.items, got, tt.want)
		}
	}
}

func TestMemberModsGetNoAttention(t *testing.T) {
	p := proj("curseforge", "9", "ae2", models.StatusRejected, 500)
	p.Owned = false
	v := build(dataset{stats: []models.PlatformStat{p}})
	s := v.summary(v.groups[0])
	if s.Owned || s.Health != healthOK || len(s.Attention) != 0 {
		t.Errorf("member summary = %+v", s)
	}
}

func TestGlobalAttentionAndOrdering(t *testing.T) {
	v := build(dataset{
		stats: []models.PlatformStat{
			proj("curseforge", "1", "zeta", models.StatusApproved, 1), proj("modrinth", "m1", "zeta", models.StatusApproved, 1),
			proj("curseforge", "2", "alpha", models.StatusRejected, 1),
		},
		entries: []models.CatalogEntry{entry("zeta", "1", "m1"), entry("alpha", "2", "")},
		issues: []models.Issue{
			{Number: 1, State: "open", Kind: "crash", ModLabel: "zeta"},
			{Number: 2, State: "open", Kind: "bug", ModLabel: "alpha"},
			{Number: 3, State: "open", Kind: "other", ModLabel: "mystery"},
			{Number: 4, State: "closed", Kind: "other", ModLabel: "mystery"},
		},
		sources: []models.SourceStatus{
			{Source: "curseforge", OK: true},
			{Source: "modrinth", OK: false, Error: "429 too many requests"},
		},
	})
	got := v.attention(v.summaries())
	want := []string{
		"problem:not_approved", // alpha (name order inside a severity)
		"problem:crash_open",   // zeta
		"warning:source_down",  // no mod, sorts first among warnings
		"warning:bug_open",     // alpha
		"info:unlinked",
		"info:missing_platform", // alpha
	}
	if !reflect.DeepEqual(itemKinds(got), want) {
		t.Fatalf("attention = %v\nwant       %v", itemKinds(got), want)
	}
	down := got[2]
	if down.ModSlug != nil || down.Title != "Modrinth could not be read" || down.Detail != "429 too many requests" {
		t.Errorf("source_down = %+v", down)
	}
	if got[4].Title != `Issue label "mod: mystery" matches no mod` || got[4].Detail != "2 issues carry it" {
		t.Errorf("unlinked = %+v", got[4])
	}
}

func TestDownloadTotalsAndNullDeltas(t *testing.T) {
	both := func(cf, mr *int64) *group {
		a := proj("curseforge", "1", "a", models.StatusApproved, 100)
		b := proj("modrinth", "m1", "a", models.StatusApproved, 20)
		a.Delta24h, a.Delta7d = cf, cf
		b.Delta24h, b.Delta7d = mr, mr
		return &group{cf: &a, mr: &b}
	}
	d := downloadsOf(both(i64(5), i64(2)))
	if d.Total != 120 || d.CurseForge != 100 || d.Modrinth != 20 || d.Delta24h == nil || *d.Delta24h != 7 || *d.Delta7d != 7 {
		t.Errorf("both known = %+v", d)
	}
	d = downloadsOf(both(i64(5), nil))
	if d.Delta24h == nil || *d.Delta24h != 5 {
		t.Errorf("one known: delta is the known one, got %v", d.Delta24h)
	}
	d = downloadsOf(both(nil, nil))
	if d.Delta24h != nil || d.Delta7d != nil || d.Total != 120 {
		t.Errorf("neither known: %+v", d)
	}
	a := proj("curseforge", "1", "a", models.StatusApproved, 100)
	if d := downloadsOf(&group{cf: &a}); d.Total != 100 || d.Modrinth != 0 || d.Delta24h != nil {
		t.Errorf("one platform = %+v", d)
	}
	if d := downloadsOf(&group{}); d.Total != 0 {
		t.Errorf("no platform = %+v", d)
	}
}

func TestModSummaryComposition(t *testing.T) {
	cf := proj("curseforge", "1", "a", models.StatusApproved, 100)
	cf.IconURL, cf.Summary, cf.Followers = "https://img/a.png", "does a thing", 0
	mr := proj("modrinth", "m1", "a", models.StatusApproved, 20)
	oldFile := file("curseforge", "1", "old", testNow.AddDate(0, -3, 0), 10, "1.21.1", "1.21.10", "1.21.9")
	newFile := file("modrinth", "m1", "new", testNow.AddDate(0, 0, -2), 5, "1.21.11")
	newFile.Loaders = []string{"fabric", "neoforge"}
	v := build(dataset{
		stats:   []models.PlatformStat{cf, mr},
		entries: []models.CatalogEntry{entry("a", "1", "m1")},
		files:   []models.FileStat{oldFile, newFile},
	})
	s := v.summary(v.bySlug["a"])
	if s.IconURL != "https://img/a.png" || s.Summary != "does a thing" || !s.Owned {
		t.Errorf("summary = %+v", s)
	}
	if want := []string{"1.21.11", "1.21.10", "1.21.9", "1.21.1"}; !reflect.DeepEqual(s.MinecraftVersions, want) {
		t.Errorf("versions = %v, want %v", s.MinecraftVersions, want)
	}
	if want := []string{"fabric", "neoforge"}; !reflect.DeepEqual(s.Loaders, want) {
		t.Errorf("loaders = %v", s.Loaders)
	}
	if s.LatestRelease == nil || len(s.LatestRelease.Platforms) != 1 || s.LatestRelease.Platforms[0] != "modrinth" || s.LatestRelease.Version != "new" {
		t.Errorf("latestRelease = %+v", s.LatestRelease)
	}
	if s.CurseForge.Files != 1 || s.Modrinth.Files != 1 {
		t.Errorf("file counts = %d, %d", s.CurseForge.Files, s.Modrinth.Files)
	}
	if s.CurseForge.Followers == nil || *s.CurseForge.Followers != 0 {
		t.Errorf("a followers count of zero is a real value, got %v", s.CurseForge.Followers)
	}
	if s.CurseForge.StatusMessage != nil || s.CurseForge.QueuedAt != nil {
		t.Errorf("missing text and times are null: %+v", s.CurseForge)
	}
}

func TestListOrderHidesHiddenAndKeepsLooseProjects(t *testing.T) {
	ae2 := proj("curseforge", "9", "ae2", models.StatusApproved, 99999)
	ae2.Owned = false
	clash := proj("curseforge", "10", "small", models.StatusApproved, 3) // slug already taken by an entry
	clash.Owned = false
	hidden := entry("secret", "3", "")
	hidden.Hidden = true
	v := build(dataset{
		stats: []models.PlatformStat{
			proj("curseforge", "1", "small", models.StatusApproved, 10),
			proj("curseforge", "2", "big", models.StatusApproved, 500),
			proj("curseforge", "3", "secret", models.StatusApproved, 7000),
			ae2, clash,
		},
		entries: []models.CatalogEntry{entry("small", "1", ""), entry("big", "2", ""), hidden},
	})
	var slugs []string
	for _, m := range v.summaries() {
		slugs = append(slugs, m.Slug)
	}
	if want := []string{"ae2", "big", "small", "small-curseforge"}; !reflect.DeepEqual(slugs, want) {
		t.Errorf("slugs = %v, want %v", slugs, want)
	}
	if v.bySlug["secret"] == nil {
		t.Error("a hidden mod keeps its detail page")
	}
}

func TestVersionTotalsSplitAndSort(t *testing.T) {
	files := []models.FileStat{
		file("curseforge", "1", "a", testNow, 100, "1.21.1", "1.21"),
		file("modrinth", "m1", "b", testNow, 30, "1.21.1"),
		file("curseforge", "1", "c", testNow, 5, "26.1"),
		file("curseforge", "1", "d", testNow, 1, "24w14a"),
	}
	got := versionTotals(files, gameVersionsOf, true)
	names := []string{}
	for _, t := range got {
		names = append(names, t.Name)
	}
	if want := []string{"26.1", "1.21.1", "1.21", "24w14a"}; !reflect.DeepEqual(names, want) {
		t.Fatalf("order = %v, want %v", names, want)
	}
	if got[1].Downloads != 130 || got[1].CurseForge != 100 || got[1].Modrinth != 30 || got[1].Files != 2 {
		t.Errorf("1.21.1 = %+v", got[1])
	}
	loaders := versionTotals(files, loadersOf, false)
	if len(loaders) != 1 || loaders[0].Downloads != 136 {
		t.Errorf("loaders = %+v", loaders)
	}
}

func TestVersionsMatrixAndLatest(t *testing.T) {
	member := proj("curseforge", "9", "ae2", models.StatusApproved, 1)
	member.Owned = false
	v := build(dataset{
		stats: []models.PlatformStat{
			proj("curseforge", "1", "a", models.StatusApproved, 10), proj("modrinth", "m1", "a", models.StatusApproved, 10),
			proj("curseforge", "2", "b", models.StatusApproved, 5), member,
		},
		entries: []models.CatalogEntry{entry("a", "1", "m1"), entry("b", "2", "")},
		files: []models.FileStat{
			file("curseforge", "1", "f1", testNow, 7, "1.21.1"),
			file("modrinth", "m1", "f2", testNow, 3, "1.21.1", "26.1"),
			file("curseforge", "2", "f3", testNow, 2, "1.21.10"),
			file("curseforge", "9", "f4", testNow, 9000, "1.12.2"), // a member mod's file stays out
		},
	})
	out := v.versions(nil, dayRange(testNow, 3))
	if out.LatestMinecraft == nil || *out.LatestMinecraft != "26.1" {
		t.Errorf("latest = %v", out.LatestMinecraft)
	}
	if want := []string{"26.1", "1.21.10", "1.21.1"}; !reflect.DeepEqual(out.Matrix.Versions, want) {
		t.Errorf("matrix versions = %v, want %v", out.Matrix.Versions, want)
	}
	if len(out.Matrix.Rows) != 2 || out.Matrix.Rows[0].Slug != "a" {
		t.Fatalf("rows = %+v", out.Matrix.Rows)
	}
	c := out.Matrix.Rows[0].Cells["1.21.1"]
	if c.Downloads != 10 || !reflect.DeepEqual(c.Platforms, []string{"curseforge", "modrinth"}) {
		t.Errorf("a x 1.21.1 = %+v", c)
	}
	if _, has := out.Matrix.Rows[1].Cells["26.1"]; has {
		t.Error("b has no 26.1 file, so no cell")
	}
	if len(out.GameVersions) != 3 {
		t.Errorf("member file leaked into totals: %+v", out.GameVersions)
	}
}

func TestVersionsHistoryCarriesFilesForward(t *testing.T) {
	days := dayRange(testNow, 4) // Nov 18 to Nov 21
	at := func(d int, h int) time.Time { return days[d].Add(time.Duration(h) * time.Hour) }
	f1 := file("curseforge", "1", "f1", testNow, 0, "1.21.1")
	f2 := file("modrinth", "m1", "f2", testNow, 0, "1.21.1", "26.1")
	v := build(dataset{
		stats:   []models.PlatformStat{proj("curseforge", "1", "a", models.StatusApproved, 0), proj("modrinth", "m1", "a", models.StatusApproved, 0)},
		entries: []models.CatalogEntry{entry("a", "1", "m1")},
		files:   []models.FileStat{f1, f2},
	})
	snaps := map[models.PlatformKey][]models.Snapshot{
		{Platform: "curseforge", ID: "f1"}: {{At: at(0, 23), Downloads: 10}, {At: at(2, 5), Downloads: 14}},
		{Platform: "modrinth", ID: "f2"}:   {{At: at(1, 9), Downloads: 3}},
	}
	h := v.versions(snaps, days)
	got := []int64{}
	for _, p := range h.History["1.21.1"] {
		got = append(got, p.Downloads)
	}
	// Day 0: 10. Day 1: 10 + 3. Day 2: 14 + 3. Day 3 has no poll, so both carry.
	if want := []int64{10, 13, 17, 17}; !reflect.DeepEqual(got, want) {
		t.Errorf("1.21.1 history = %v, want %v", got, want)
	}
	if pts := h.History["26.1"]; len(pts) != 3 || pts[0].Downloads != 3 || pts[0].At != "2026-11-19T00:00:00Z" {
		t.Errorf("26.1 starts the day its only file has data: %+v", pts)
	}
}

func TestHistoryCarryForwardAndTotals(t *testing.T) {
	days := dayRange(testNow, 5) // Nov 17 to Nov 21
	at := func(d, h int) time.Time { return days[d].Add(time.Duration(h) * time.Hour) }
	member := proj("curseforge", "9", "ae2", models.StatusApproved, 0)
	member.Owned = false
	v := build(dataset{
		stats: []models.PlatformStat{
			proj("curseforge", "1", "a", models.StatusApproved, 0), proj("modrinth", "m1", "a", models.StatusApproved, 0),
			proj("curseforge", "2", "b", models.StatusApproved, 0), member,
		},
		entries: []models.CatalogEntry{entry("a", "1", "m1"), entry("b", "2", "")},
	})
	snaps := map[models.PlatformKey][]models.Snapshot{
		{Platform: "curseforge", ID: "1"}:  {{At: at(1, 10), Downloads: 100}, {At: at(3, 10), Downloads: 130}},
		{Platform: "modrinth", ID: "m1"}:   {{At: at(2, 10), Downloads: 20}},
		{Platform: "curseforge", ID: "2"}:  {{At: at(2, 23), Downloads: 5}},
		{Platform: "curseforge", ID: "9"}:  {{At: at(0, 1), Downloads: 1000000}},
		{Platform: "curseforge", ID: "77"}: {{At: at(0, 1), Downloads: 1}}, // a project no mod holds
	}
	h := v.history(snaps, days)
	if h.Days != 5 {
		t.Errorf("days = %d", h.Days)
	}
	a := h.PerMod["a"]
	type pt struct{ cf, mr int64 }
	var got []pt
	for _, p := range a {
		got = append(got, pt{p.CurseForge, p.Modrinth})
	}
	// Starts the first day with data (day 1); day 4 has no poll and carries day 3.
	if want := []pt{{100, 0}, {100, 20}, {130, 20}, {130, 20}}; !reflect.DeepEqual(got, want) {
		t.Errorf("a = %v, want %v", got, want)
	}
	if a[0].At != "2026-11-18T00:00:00Z" {
		t.Errorf("first at = %s", a[0].At)
	}
	if _, ok := h.PerMod["ae2"]; !ok {
		t.Error("member mods get a series too")
	}
	// Total sums owned mods only: the member's million never appears.
	if len(h.Total) != 4 {
		t.Fatalf("total len = %d: %+v", len(h.Total), h.Total)
	}
	last := h.Total[3]
	if last.CurseForge != 135 || last.Modrinth != 20 {
		t.Errorf("last total = %+v", last)
	}
	if h.Total[0].CurseForge != 100 || h.Total[1].CurseForge != 105 || h.Total[2].CurseForge != 135 {
		t.Errorf("totals = %+v", h.Total)
	}
}

func TestHistoryEmpty(t *testing.T) {
	h := build(dataset{}).history(nil, dayRange(testNow, 30))
	if h.Total == nil || len(h.Total) != 0 || h.PerMod == nil || len(h.PerMod) != 0 || h.Days != 30 {
		t.Errorf("empty history = %+v", h)
	}
}

func TestReleasesNewestFirst(t *testing.T) {
	member := proj("curseforge", "9", "ae2", models.StatusApproved, 1)
	member.Owned = false
	v := build(dataset{
		stats:   []models.PlatformStat{proj("curseforge", "1", "a", models.StatusApproved, 1), proj("modrinth", "m1", "a", models.StatusApproved, 1), member},
		entries: []models.CatalogEntry{entry("a", "1", "m1")},
		files: []models.FileStat{
			file("curseforge", "1", "f1", testNow.AddDate(0, 0, -5), 1, "1.21.1"),
			file("modrinth", "m1", "f2", testNow.AddDate(0, 0, -1), 1, "1.21.1"),
			file("curseforge", "1", "f3", time.Time{}, 1, "1.21.1"), // no date, not a release event
			file("curseforge", "9", "f4", testNow, 1, "1.12.2"),
		},
	})
	got := v.releases(10)
	if len(got) != 2 || got[0].Name != "f2" || got[1].Name != "f1" {
		t.Fatalf("releases = %+v", got)
	}
	if got[0].URL == nil || *got[0].URL != "https://example.test/a/version/f2" || *got[1].URL != "https://example.test/a/files/f1" {
		t.Errorf("urls = %v, %v", got[0].URL, got[1].URL)
	}
	if got[0].ModSlug == nil || *got[0].ModSlug != "a" {
		t.Errorf("modSlug = %v", got[0].ModSlug)
	}
	if len(v.releases(1)) != 1 {
		t.Error("limit not applied")
	}
}

func TestReleaseTypeNormalised(t *testing.T) {
	for in, want := range map[string]string{"release": "release", "Beta": "beta", "alpha": "alpha", "": "unknown", "x": "unknown"} {
		if got := releaseTypeOf(in); got != want {
			t.Errorf("releaseTypeOf(%q) = %q", in, got)
		}
	}
}

func TestGithubInfo(t *testing.T) {
	label := "tower"
	e := entry("a", "1", "")
	e.GitHubLabel = &label
	v := build(dataset{
		ghRepo:  "o/r",
		stats:   []models.PlatformStat{proj("curseforge", "1", "a", models.StatusApproved, 1)},
		entries: []models.CatalogEntry{e},
		issues: []models.Issue{
			{Number: 1, State: "open", Kind: "bug", ModLabel: "tower", CreatedAt: testNow.AddDate(0, 0, -9)},
			{Number: 2, State: "open", Kind: "crash", ModLabel: "tower", CreatedAt: testNow.AddDate(0, 0, -20)},
			{Number: 3, State: "open", Kind: "enhancement", ModLabel: "tower", CreatedAt: testNow.AddDate(0, 0, -90)},
			{Number: 4, State: "closed", Kind: "bug", ModLabel: "tower", CreatedAt: testNow.AddDate(0, 0, -100)},
		},
	})
	g := v.summary(v.bySlug["a"]).Github
	if g == nil || g.Label != "tower" || g.Open != 3 || g.OpenBugs != 1 || g.OpenCrashes != 1 {
		t.Fatalf("github = %+v", g)
	}
	if g.OldestOpenBugAt == nil || *g.OldestOpenBugAt != rfc3339(testNow.AddDate(0, 0, -20)) {
		t.Errorf("oldest = %v", g.OldestOpenBugAt)
	}
	// Issues off and no label: null, not zeros.
	v = build(dataset{
		stats:   []models.PlatformStat{proj("curseforge", "1", "a", models.StatusApproved, 1)},
		entries: []models.CatalogEntry{entry("a", "1", "")},
	})
	if v.summary(v.bySlug["a"]).Github != nil {
		t.Error("github should be null with issues off")
	}
}

func TestLegacyModNeverRaisesNoLatestMinecraft(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		old := entry("old", "1", "m1")
		old.Legacy = legacy
		v := build(dataset{
			stats: []models.PlatformStat{
				proj("curseforge", "1", "old", models.StatusApproved, 1), proj("modrinth", "m1", "old", models.StatusApproved, 1),
				proj("curseforge", "2", "new", models.StatusApproved, 1), proj("modrinth", "m2", "new", models.StatusApproved, 1),
			},
			entries: []models.CatalogEntry{old, entry("new", "2", "m2")},
			files: []models.FileStat{
				file("curseforge", "1", "f1", testNow.AddDate(0, -1, 0), 1, "1.21.1"),
				file("curseforge", "2", "f2", testNow.AddDate(0, 0, -1), 1, "26.1"),
			},
		})
		flagged := false
		for _, it := range attentionOf(t, v, "old") {
			if it.Kind == "no_latest_minecraft" {
				flagged = true
			}
		}
		if flagged == legacy {
			t.Errorf("legacy=%v: flagged=%v", legacy, flagged)
		}
		if got := v.summary(v.bySlug["old"]).Legacy; got != legacy {
			t.Errorf("summary legacy = %v, want %v", got, legacy)
		}
	}
}

func TestNoLoaderTotalCountsEachUntaggedFileOnce(t *testing.T) {
	files := []models.FileStat{
		{File: models.File{Source: platCF, Loaders: nil}, Downloads: 100},
		{File: models.File{Source: platCF, Loaders: []string{}}, Downloads: 50},
		{File: models.File{Source: platMR, Loaders: nil}, Downloads: 7},
		{File: models.File{Source: platCF, Loaders: []string{"forge", "neoforge"}}, Downloads: 999},
	}
	got := noLoaderTotal(files)
	if got.Downloads != 157 || got.Files != 3 || got.CurseForge != 150 || got.Modrinth != 7 {
		t.Errorf("noLoaderTotal = %+v, want 157 downloads over 3 files (150 CurseForge, 7 Modrinth)", got)
	}
	if empty := noLoaderTotal(nil); empty.Downloads != 0 || empty.Files != 0 {
		t.Errorf("no files must give zeros, got %+v", empty)
	}
}

// legacyData is one current mod and one legacy mod with a file each, in different Minecraft versions.
func legacyData() dataset {
	old := entry("old", "1", "")
	old.Legacy = true
	return dataset{
		stats: []models.PlatformStat{
			proj("curseforge", "1", "old", models.StatusApproved, 900),
			proj("curseforge", "2", "new", models.StatusApproved, 10),
		},
		entries: []models.CatalogEntry{old, entry("new", "2", "")},
		files: []models.FileStat{
			file("curseforge", "1", "f1", testNow.AddDate(-5, 0, 0), 900, "1.7.10"),
			file("curseforge", "2", "f2", testNow.AddDate(0, 0, -1), 10, "26.1"),
		},
	}
}

func TestLegacyModsStayOutOfRollUpsUnlessAsked(t *testing.T) {
	ds := legacyData()
	hidden := newView(&ds, false)
	if got := names(hidden.summaries()); got != "new" {
		t.Errorf("mods = %q, want only the current mod", got)
	}
	vs := hidden.versions(nil, nil)
	if len(vs.GameVersions) != 1 || vs.GameVersions[0].Name != "26.1" {
		t.Errorf("versions = %+v, want only 26.1", vs.GameVersions)
	}
	if len(vs.Matrix.Rows) != 1 || vs.Matrix.Rows[0].Slug != "new" {
		t.Errorf("matrix rows = %+v", vs.Matrix.Rows)
	}
	if got := hidden.releases(10); len(got) != 1 || got[0].ModSlug == nil || *got[0].ModSlug != "new" {
		t.Errorf("releases = %+v, want only the current mod's", got)
	}
	if hidden.bySlug["old"] == nil {
		t.Error("a legacy mod must still resolve by slug so its page opens")
	}

	shown := newView(&ds, true)
	if got := names(shown.summaries()); got != "old,new" {
		t.Errorf("mods = %q, want both, biggest first", got)
	}
	if n := len(shown.versions(nil, nil).GameVersions); n != 2 {
		t.Errorf("versions = %d, want 2", n)
	}
}

func names(ms []modSummary) string {
	var out []string
	for _, m := range ms {
		out = append(out, m.Slug)
	}
	return strings.Join(out, ",")
}
