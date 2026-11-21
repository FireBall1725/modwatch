// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/db"
	"github.com/fireball1725/modwatch/internal/models"
)

func newRepo(t *testing.T) *Repo {
	t.Helper()
	conn, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return New(conn)
}

func reading(id int, name string, owned bool, downloads int64) models.Reading {
	return models.Reading{Mod: models.Mod{ID: id, Slug: name, Name: name, Owned: owned}, Downloads: downloads}
}

func poll(at time.Time) models.Poll {
	return models.Poll{StartedAt: at.Add(-time.Second), FinishedAt: at}
}

func TestListModStatsEmptyIsNotNil(t *testing.T) {
	stats, err := newRepo(t).ListModStats(context.Background(), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if stats == nil || len(stats) != 0 {
		t.Errorf("want an empty non-nil slice, got %v", stats)
	}
}

func TestDeltasNeedAnOldEnoughSnapshot(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)

	// Eight days ago, one day ago minus a minute, and now.
	for _, step := range []struct {
		at time.Time
		n  int64
	}{
		{now.Add(-8 * 24 * time.Hour), 1000},
		{now.Add(-24*time.Hour - time.Minute), 1100},
		{now, 1150},
	} {
		if _, err := r.SavePoll(ctx, poll(step.at), []models.Reading{reading(1, "graves", true, step.n)}, nil, nil); err != nil {
			t.Fatal(err)
		}
	}

	stats, err := r.ListModStats(ctx, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(stats) != 1 || stats[0].Downloads != 1150 {
		t.Fatalf("stats = %+v", stats)
	}
	if stats[0].Delta24h == nil || *stats[0].Delta24h != 50 {
		t.Errorf("24h delta = %v, want 50", stats[0].Delta24h)
	}
	if stats[0].Delta7d == nil || *stats[0].Delta7d != 150 {
		t.Errorf("7d delta = %v, want 150", stats[0].Delta7d)
	}
}

func TestFreshInstallHasNoDeltas(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Now()
	if _, err := r.SavePoll(ctx, poll(now), []models.Reading{reading(1, "graves", true, 5)}, nil, nil); err != nil {
		t.Fatal(err)
	}
	stats, _ := r.ListModStats(ctx, now)
	if stats[0].Delta24h != nil || stats[0].Delta7d != nil {
		t.Errorf("a first snapshot has nothing to compare to, got %v %v", stats[0].Delta24h, stats[0].Delta7d)
	}
}

func TestRemovedModsDropOutOfTheLatestList(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Now()
	if _, err := r.SavePoll(ctx, poll(now.Add(-time.Hour)), []models.Reading{reading(1, "a", true, 10), reading(2, "b", true, 20)}, nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := r.SavePoll(ctx, poll(now), []models.Reading{reading(1, "a", true, 11)}, nil, nil); err != nil {
		t.Fatal(err)
	}
	stats, _ := r.ListModStats(ctx, now)
	if len(stats) != 1 || stats[0].ID != 1 {
		t.Errorf("only mod 1 is in the latest poll, got %+v", stats)
	}
}

func TestFailedPollKeepsTheLastGoodData(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Now()
	if _, err := r.SavePoll(ctx, poll(now.Add(-time.Hour)), []models.Reading{reading(1, "a", true, 10)}, nil, nil); err != nil {
		t.Fatal(err)
	}
	failed := poll(now)
	failed.State, failed.Error = models.PollError, "403"
	if err := r.SaveFailedPoll(ctx, failed, nil); err != nil {
		t.Fatal(err)
	}
	stats, _ := r.ListModStats(ctx, now)
	if len(stats) != 1 {
		t.Errorf("a failed poll must not blank the dashboard, got %+v", stats)
	}
	last, _ := r.LatestPoll(ctx)
	ok, _ := r.LatestOKPoll(ctx)
	if last.State != models.PollError || ok.State != models.PollOK {
		t.Errorf("latest = %v, latest ok = %v", last.State, ok.State)
	}
}

func TestHistoryKeepsOneSnapshotPerDay(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	day := time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC)
	for h, n := range []int64{10, 12, 15} {
		if _, err := r.SavePoll(ctx, poll(day.Add(time.Duration(h)*time.Hour)), []models.Reading{reading(1, "a", true, n)}, nil, nil); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := r.SavePoll(ctx, poll(day.Add(25*time.Hour)), []models.Reading{reading(1, "a", true, 20)}, nil, nil); err != nil {
		t.Fatal(err)
	}
	hist, err := r.History(ctx, day.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	got := hist[1]
	if len(got) != 2 || got[0].Downloads != 15 || got[1].Downloads != 20 {
		t.Errorf("want the last snapshot of each day (15, 20), got %+v", got)
	}
}

func file(source, id, project string, gv []string, n int64) models.FileReading {
	return models.FileReading{
		File: models.File{
			Source: source, ID: id, ProjectID: project, ProjectSlug: project, ProjectName: project,
			Name: id, Version: id, ReleaseType: "release", GameVersions: gv, Loaders: []string{"neoforge"},
		},
		Downloads: n,
	}
}

func TestFileStatsRoundTripAndDeltas(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)

	if _, err := r.SavePoll(ctx, poll(now.Add(-25*time.Hour)), nil, []models.FileReading{file("modrinth", "a", "p", []string{"1.21.1"}, 10)}, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := r.SavePoll(ctx, poll(now), nil, []models.FileReading{file("modrinth", "a", "p", []string{"1.21.1", "1.21"}, 16)}, nil); err != nil {
		t.Fatal(err)
	}
	got, err := r.ListFileStats(ctx, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Downloads != 16 {
		t.Fatalf("files = %+v", got)
	}
	if got[0].Delta24h == nil || *got[0].Delta24h != 6 {
		t.Errorf("24h delta = %v, want 6", got[0].Delta24h)
	}
	if got[0].Delta7d != nil {
		t.Errorf("7d delta = %v, want none: the oldest snapshot is only 25 hours old", *got[0].Delta7d)
	}
	if len(got[0].GameVersions) != 2 || got[0].Loaders[0] != "neoforge" {
		t.Errorf("versions and loaders must survive storage: %+v", got[0].File)
	}
}

func TestFileStatsEmptyIsNotNil(t *testing.T) {
	got, err := newRepo(t).ListFileStats(context.Background(), time.Now())
	if err != nil || got == nil || len(got) != 0 {
		t.Errorf("want an empty non-nil slice, got %v %v", got, err)
	}
}

func TestAFileRemovedFromAProjectDisappears(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Now()
	both := []models.FileReading{file("curseforge", "1", "p", nil, 5), file("curseforge", "2", "p", nil, 7)}
	if _, err := r.SavePoll(ctx, poll(now.Add(-time.Hour)), nil, both, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := r.SavePoll(ctx, poll(now), nil, both[:1], nil); err != nil {
		t.Fatal(err)
	}
	got, _ := r.ListFileStats(ctx, now)
	if len(got) != 1 || got[0].ID != "1" {
		t.Errorf("file 2 was removed upstream, got %+v", got)
	}
}

func TestAProjectThatWasNotRefreshedKeepsItsLastFiles(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Now()
	if _, err := r.SavePoll(ctx, poll(now.Add(-time.Hour)), nil,
		[]models.FileReading{file("curseforge", "1", "a", nil, 5), file("curseforge", "2", "b", nil, 7)}, nil); err != nil {
		t.Fatal(err)
	}
	// The second poll could only fetch project a's files.
	if _, err := r.SavePoll(ctx, poll(now), nil, []models.FileReading{file("curseforge", "1", "a", nil, 6)}, nil); err != nil {
		t.Fatal(err)
	}
	got, _ := r.ListFileStats(ctx, now)
	if len(got) != 2 {
		t.Fatalf("project b's last files should stay on the dashboard, got %+v", got)
	}
}

func TestSourceStatusKeepsTheLastGoodTime(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	good := time.Date(2026, 11, 21, 10, 0, 0, 0, time.UTC)
	if _, err := r.SavePoll(ctx, poll(good), nil, nil,
		[]models.SourceStatus{{Source: "modrinth", OK: true, CheckedAt: good, LastOKAt: good}}); err != nil {
		t.Fatal(err)
	}
	bad := good.Add(time.Hour)
	if _, err := r.SavePoll(ctx, poll(bad), nil, nil,
		[]models.SourceStatus{{Source: "modrinth", OK: false, Error: "429", CheckedAt: bad}}); err != nil {
		t.Fatal(err)
	}
	got, err := r.ListSourceStatuses(ctx)
	if err != nil || len(got) != 1 {
		t.Fatalf("statuses = %v %v", got, err)
	}
	if got[0].OK || got[0].Error != "429" || !got[0].LastOKAt.Equal(good) {
		t.Errorf("a failure must keep the last good time: %+v", got[0])
	}
}

func pr(platform, id, name string, status models.ReviewStatus, n int64) models.PlatformReading {
	return models.PlatformReading{
		PlatformProject: models.PlatformProject{Platform: platform, ID: id, Slug: name, Name: name, Status: status, RawStatus: string(status), Owned: true},
		Downloads:       n,
	}
}

func TestPlatformProjectsRoundTrip(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Date(2026, 11, 21, 12, 0, 0, 0, time.UTC)
	queued := now.Add(-48 * time.Hour)

	mr := pr("modrinth", "P1", "ae-lights", models.StatusInReview, 40)
	mr.StatusMessage, mr.RequestedStatus, mr.QueuedAt = "Add a licence.", "approved", queued
	mr.Followers, mr.IconURL, mr.URL = 3, "https://i", "https://modrinth.com/mod/ae-lights"
	mr.SourceURL, mr.IssuesURL, mr.WikiURL, mr.DiscordURL = "s", "i", "w", "d"
	mr.PublishedAt, mr.UpdatedAt = now.Add(-72*time.Hour), now.Add(-time.Hour)
	cf := pr("curseforge", "7", "graves", models.StatusApproved, 100)
	cf.Owned = false

	if _, err := r.SavePollWithProjects(ctx, poll(now), nil, nil, []models.PlatformReading{mr, cf}, nil); err != nil {
		t.Fatal(err)
	}
	got, err := r.ListPlatformStats(ctx, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].ID != "7" || got[1].ID != "P1" {
		t.Fatalf("want biggest first, got %+v", got)
	}
	if got[0].Owned || got[0].Delta24h != nil || got[0].Delta7d != nil {
		t.Errorf("curseforge = %+v", got[0])
	}
	m := got[1]
	if m.Status != models.StatusInReview || m.StatusMessage != "Add a licence." || m.RequestedStatus != "approved" || !m.QueuedAt.Equal(queued) {
		t.Errorf("review fields lost: %+v", m)
	}
	if m.Followers != 3 || m.SourceURL != "s" || m.IssuesURL != "i" || m.WikiURL != "w" || m.DiscordURL != "d" || !m.Owned || m.Downloads != 40 {
		t.Errorf("metadata lost: %+v", m)
	}
	if !m.PublishedAt.Equal(mr.PublishedAt) || !m.UpdatedAt.Equal(mr.UpdatedAt) {
		t.Errorf("times = %v %v", m.PublishedAt, m.UpdatedAt)
	}
}

func TestPlatformStatsEmptyIsNotNilAndMissingTimesStayZero(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	got, err := r.ListPlatformStats(ctx, time.Now())
	if err != nil || got == nil || len(got) != 0 {
		t.Fatalf("got %v, %v", got, err)
	}
	if _, err := r.SavePollWithProjects(ctx, poll(time.Now()), nil, nil, []models.PlatformReading{pr("modrinth", "P", "x", models.StatusDraft, 0)}, nil); err != nil {
		t.Fatal(err)
	}
	got, _ = r.ListPlatformStats(ctx, time.Now())
	if len(got) != 1 || !got[0].QueuedAt.IsZero() || !got[0].PublishedAt.IsZero() || got[0].Downloads != 0 {
		t.Errorf("got %+v", got)
	}
}

func TestPlatformStatsKeepAPlatformThatMissedThePoll(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	t1 := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)
	t2 := t1.Add(time.Hour)

	_, _ = r.SavePollWithProjects(ctx, poll(t1), nil, nil, []models.PlatformReading{
		pr("curseforge", "1", "a", models.StatusApproved, 10), pr("curseforge", "2", "gone", models.StatusApproved, 5),
		pr("modrinth", "P1", "a", models.StatusApproved, 20),
	}, nil)
	// Modrinth failed in the second poll; CurseForge dropped project 2.
	_, _ = r.SavePollWithProjects(ctx, poll(t2), nil, nil, []models.PlatformReading{pr("curseforge", "1", "a", models.StatusApproved, 12)}, nil)

	got, _ := r.ListPlatformStats(ctx, t2)
	ids := map[string]int64{}
	for _, s := range got {
		ids[s.Platform+"/"+s.ID] = s.Downloads
	}
	if len(ids) != 2 || ids["curseforge/1"] != 12 || ids["modrinth/P1"] != 20 {
		t.Errorf("got %v", ids)
	}
}

func TestPlatformHistoryKeepsTheLastSnapshotOfEachDay(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	day1 := time.Date(2026, 11, 19, 6, 0, 0, 0, time.UTC)
	for i, at := range []time.Time{day1, day1.Add(10 * time.Hour), day1.Add(24 * time.Hour)} {
		_, err := r.SavePollWithProjects(ctx, poll(at), nil, nil, []models.PlatformReading{
			pr("curseforge", "1", "a", models.StatusApproved, int64(100+i)), pr("modrinth", "P", "a", models.StatusApproved, int64(10+i)),
		}, nil)
		if err != nil {
			t.Fatal(err)
		}
	}
	h, err := r.PlatformHistory(ctx, day1.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	cf := h[models.PlatformKey{Platform: "curseforge", ID: "1"}]
	if len(cf) != 2 || cf[0].Downloads != 101 || cf[1].Downloads != 102 {
		t.Errorf("curseforge history = %+v", cf)
	}
	if mr := h[models.PlatformKey{Platform: "modrinth", ID: "P"}]; len(mr) != 2 || mr[0].Downloads != 11 {
		t.Errorf("modrinth history = %+v", mr)
	}
	if later, _ := r.PlatformHistory(ctx, day1.Add(20*time.Hour)); len(later[models.PlatformKey{Platform: "curseforge", ID: "1"}]) != 1 {
		t.Errorf("since must cut older days: %+v", later)
	}
}

func TestSourceDetailRoundTripsAndClears(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	now := time.Now()
	st := models.SourceStatus{Source: "modrinth", OK: true, Detail: "hidden", CheckedAt: now, LastOKAt: now}
	if _, err := r.SavePoll(ctx, poll(now), nil, nil, []models.SourceStatus{st}); err != nil {
		t.Fatal(err)
	}
	got, _ := r.ListSourceStatuses(ctx)
	if len(got) != 1 || got[0].Detail != "hidden" {
		t.Fatalf("got %+v", got)
	}
	st.Detail = ""
	_, _ = r.SavePoll(ctx, poll(now), nil, nil, []models.SourceStatus{st})
	if got, _ = r.ListSourceStatuses(ctx); got[0].Detail != "" {
		t.Errorf("detail must clear once the token is set: %+v", got)
	}
}
