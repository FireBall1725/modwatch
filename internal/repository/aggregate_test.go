// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

func reviewProject(id string, status models.ReviewStatus) models.PlatformReading {
	return models.PlatformReading{PlatformProject: models.PlatformProject{Platform: "modrinth", ID: id, Slug: id, Name: id, Status: status, Owned: true}}
}

func TestReviewSeenKeepsTheFirstSightingAndResetsOnLeaving(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	t0 := time.Date(2026, 11, 1, 10, 0, 0, 0, time.UTC)
	save := func(at time.Time, ps ...models.PlatformReading) {
		t.Helper()
		if _, err := r.SavePollWithProjects(ctx, poll(at), nil, nil, ps, nil); err != nil {
			t.Fatal(err)
		}
	}
	key := models.PlatformKey{Platform: "modrinth", ID: "a"}
	seen := func() map[models.PlatformKey]time.Time {
		t.Helper()
		m, err := r.ReviewSeen(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return m
	}

	save(t0, reviewProject("a", models.StatusInReview), reviewProject("b", models.StatusApproved))
	if m := seen(); len(m) != 1 || !m[key].Equal(t0) {
		t.Fatalf("after first poll: %v", m)
	}

	save(t0.Add(48*time.Hour), reviewProject("a", models.StatusInReview))
	if got := seen()[key]; !got.Equal(t0) {
		t.Errorf("a second poll in review moved the clock to %v", got)
	}

	// A poll that read no Modrinth projects (an outage) leaves the clock alone.
	save(t0.Add(72*time.Hour), models.PlatformReading{PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "1", Slug: "x", Name: "x"}})
	if got := seen()[key]; !got.Equal(t0) {
		t.Errorf("an outage reset the clock to %v", got)
	}

	save(t0.Add(96*time.Hour), reviewProject("a", models.StatusApproved))
	if m := seen(); len(m) != 0 {
		t.Errorf("leaving review should clear the row: %v", m)
	}

	back := t0.Add(120 * time.Hour)
	save(back, reviewProject("a", models.StatusInReview))
	if got := seen()[key]; !got.Equal(back) {
		t.Errorf("a new review starts a new clock, got %v", got)
	}
}

func TestReviewSeenEmptyIsNotNil(t *testing.T) {
	m, err := newRepo(t).ReviewSeen(context.Background())
	if err != nil || m == nil || len(m) != 0 {
		t.Errorf("got %v, %v", m, err)
	}
}

func TestFileHistoryKeepsTheLastSnapshotOfEachDay(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	day := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)
	f := func(n int64) []models.FileReading {
		return []models.FileReading{{File: models.File{Source: "curseforge", ID: "f1", ProjectID: "1", ProjectSlug: "a", ProjectName: "a", Name: "f", Version: "1"}, Downloads: n}}
	}
	for _, s := range []struct {
		at time.Time
		n  int64
	}{{day.Add(2 * time.Hour), 5}, {day.Add(20 * time.Hour), 9}, {day.Add(30 * time.Hour), 12}} {
		if _, err := r.SavePoll(ctx, poll(s.at), nil, f(s.n), nil); err != nil {
			t.Fatal(err)
		}
	}
	h, err := r.FileHistory(ctx, day)
	if err != nil {
		t.Fatal(err)
	}
	got := h[models.PlatformKey{Platform: "curseforge", ID: "f1"}]
	if len(got) != 2 || got[0].Downloads != 9 || got[1].Downloads != 12 {
		t.Errorf("history = %+v", got)
	}
	empty, err := r.FileHistory(ctx, day.AddDate(1, 0, 0))
	if err != nil || empty == nil || len(empty) != 0 {
		t.Errorf("empty = %v, %v", empty, err)
	}
}
