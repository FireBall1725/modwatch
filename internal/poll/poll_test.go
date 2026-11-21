// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package poll

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/db"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/providers/curseforge"
	"github.com/fireball1725/modwatch/internal/repository"
)

type fakeSource struct {
	member, owned []curseforge.Mod
	err           error
}

func (f fakeSource) ListByAuthor(_ context.Context, _ int, ownerOnly bool) ([]curseforge.Mod, error) {
	if f.err != nil {
		return nil, f.err
	}
	if ownerOnly {
		return f.owned, nil
	}
	return f.member, nil
}

func mod(id int, name string, n int64) curseforge.Mod {
	return curseforge.Mod{ID: id, Name: name, Slug: name, DownloadCount: n}
}

func newService(t *testing.T, src Source) (*Service, *repository.Repo) {
	t.Helper()
	conn, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	repo := repository.New(conn)
	cfg := &config.Config{CurseForgeKey: "k", CurseForgeAuthorID: 1}
	return New(context.Background(), cfg, repo, src), repo
}

func TestRunMarksOwnedMods(t *testing.T) {
	svc, repo := newService(t, fakeSource{
		member: []curseforge.Mod{mod(1, "mine", 10), mod(2, "team", 99)},
		owned:  []curseforge.Mod{mod(1, "mine", 10)},
	})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	stats, _ := repo.ListModStats(context.Background(), time.Now())
	owned := map[string]bool{}
	for _, s := range stats {
		owned[s.Name] = s.Owned
	}
	if len(stats) != 2 || !owned["mine"] || owned["team"] {
		t.Errorf("owned flags = %v", owned)
	}
}

func TestRunKeepsOwnedModMissingFromMembership(t *testing.T) {
	svc, repo := newService(t, fakeSource{owned: []curseforge.Mod{mod(5, "solo", 1)}})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	stats, _ := repo.ListModStats(context.Background(), time.Now())
	if len(stats) != 1 || !stats[0].Owned {
		t.Errorf("stats = %+v", stats)
	}
}

func TestRunRecordsAFailure(t *testing.T) {
	svc, repo := newService(t, fakeSource{err: errors.New("403")})
	if err := svc.Run(context.Background()); err == nil {
		t.Fatal("want the fetch error back")
	}
	last, _ := repo.LatestPoll(context.Background())
	if last == nil || last.State != models.PollError || last.Error != "403" {
		t.Errorf("last poll = %+v", last)
	}
}

func TestStartRefusesWithoutAKey(t *testing.T) {
	conn, _ := db.Open(t.TempDir())
	t.Cleanup(func() { _ = conn.Close() })
	svc := New(context.Background(), &config.Config{}, repository.New(conn), fakeSource{})
	if err := svc.Start(); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("err = %v", err)
	}
}
