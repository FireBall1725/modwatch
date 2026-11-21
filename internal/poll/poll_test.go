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
	"github.com/fireball1725/modwatch/internal/providers/modrinth"
	"github.com/fireball1725/modwatch/internal/repository"
)

type fakeSource struct {
	member, owned []curseforge.Mod
	files         map[int][]curseforge.File
	filesErr      error
	err           error
}

func (f fakeSource) ListFiles(_ context.Context, modID int) ([]curseforge.File, error) {
	if f.filesErr != nil {
		return nil, f.filesErr
	}
	return f.files[modID], nil
}

type fakeModrinth struct {
	projects []modrinth.Project
	versions map[string][]modrinth.Version
	err      error
}

func (f fakeModrinth) ListProjects(context.Context, string) ([]modrinth.Project, error) {
	return f.projects, f.err
}

func (f fakeModrinth) ListVersions(_ context.Context, id string) ([]modrinth.Version, error) {
	return f.versions[id], nil
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

func newService(t *testing.T, src CurseForge) (*Service, *repository.Repo) {
	return newServiceWith(t, src, nil)
}

func newServiceWith(t *testing.T, src CurseForge, mr Modrinth) (*Service, *repository.Repo) {
	t.Helper()
	conn, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	repo := repository.New(conn)
	cfg := &config.Config{CurseForgeKey: "k", CurseForgeAuthorID: 1, ModrinthUser: "me"}
	return New(context.Background(), cfg, repo, src, mr), repo
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
	svc := New(context.Background(), &config.Config{}, repository.New(conn), fakeSource{}, nil)
	if err := svc.Start(); !errors.Is(err, ErrNotConfigured) {
		t.Errorf("err = %v", err)
	}
}

func cfFile(id int, name string, n int64, gv ...string) curseforge.File {
	return curseforge.File{ID: id, DisplayName: name, DownloadCount: n, ReleaseType: 2, GameVersions: gv}
}

func TestRunFetchesFilesForOwnedModsOnly(t *testing.T) {
	svc, repo := newService(t, fakeSource{
		member: []curseforge.Mod{mod(1, "Mine", 10), mod(2, "Team", 99)},
		owned:  []curseforge.Mod{mod(1, "Mine", 10)},
		files: map[int][]curseforge.File{
			1: {cfFile(11, "Mine 1.2.0", 4, "Client", "1.21.1", "NeoForge", "Server")},
			2: {cfFile(21, "Team 9.9.9", 80, "1.20.1", "Forge")},
		},
	})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	files, _ := repo.ListFileStats(context.Background(), time.Now())
	if len(files) != 1 {
		t.Fatalf("files of a mod the author doesn't own must be skipped, got %+v", files)
	}
	f := files[0]
	if f.Version != "1.2.0" || f.ReleaseType != "beta" || f.Downloads != 4 {
		t.Errorf("file = %+v", f)
	}
	if len(f.GameVersions) != 1 || f.GameVersions[0] != "1.21.1" || len(f.Loaders) != 1 || f.Loaders[0] != "neoforge" {
		t.Errorf("sides must be dropped and the rest split: %+v / %+v", f.GameVersions, f.Loaders)
	}
}

func TestAFileFetchFailureKeepsTheTotalsAndMarksTheSource(t *testing.T) {
	svc, repo := newService(t, fakeSource{
		member:   []curseforge.Mod{mod(1, "Mine", 10)},
		owned:    []curseforge.Mod{mod(1, "Mine", 10)},
		filesErr: errors.New("boom"),
	})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatalf("file failures must not fail the poll: %v", err)
	}
	stats, _ := repo.ListModStats(context.Background(), time.Now())
	if len(stats) != 1 {
		t.Errorf("totals must still save, got %+v", stats)
	}
	st, _ := repo.ListSourceStatuses(context.Background())
	if len(st) != 1 || st[0].OK || st[0].Source != "curseforge" {
		t.Errorf("statuses = %+v", st)
	}
}

func TestModrinthVersionsAreStored(t *testing.T) {
	svc, repo := newServiceWith(t,
		fakeSource{owned: []curseforge.Mod{mod(1, "Mine", 10)}},
		fakeModrinth{
			projects: []modrinth.Project{{ID: "P1", Slug: "mine", Title: "Mine"}},
			versions: map[string][]modrinth.Version{"P1": {
				{ID: "V1", Name: "Mine 1.2.0", VersionNumber: "1.2.0", VersionType: "release", Downloads: 30, GameVersions: []string{"1.21.1"}, Loaders: []string{"neoforge"}},
			}},
		})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	files, _ := repo.ListFileStats(context.Background(), time.Now())
	var got *models.FileStat
	for i := range files {
		if files[i].Source == "modrinth" {
			got = &files[i]
		}
	}
	if got == nil || got.Downloads != 30 || got.ProjectName != "Mine" || got.GameVersions[0] != "1.21.1" {
		t.Errorf("modrinth file = %+v", got)
	}
}

func TestModrinthFailureDoesNotFailThePoll(t *testing.T) {
	svc, repo := newServiceWith(t,
		fakeSource{owned: []curseforge.Mod{mod(1, "Mine", 10)}},
		fakeModrinth{err: errors.New("modrinth: rate limited")})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatalf("a Modrinth outage must not block CurseForge totals: %v", err)
	}
	st, _ := repo.ListSourceStatuses(context.Background())
	down := false
	for _, s := range st {
		if s.Source == "modrinth" && !s.OK {
			down = true
		}
	}
	if !down {
		t.Errorf("modrinth should be marked down: %+v", st)
	}
}

func TestVersionOf(t *testing.T) {
	for _, c := range []struct{ display, project, want string }{
		{"Create: Turbolifts 26.11.0-rc.2", "Create: Turbolifts", "26.11.0-rc.2"},
		{"graves-1.0.jar", "Graves", "graves-1.0.jar"},
		{"Graves", "Graves", "Graves"},
	} {
		if got := versionOf(c.display, c.project); got != c.want {
			t.Errorf("versionOf(%q, %q) = %q, want %q", c.display, c.project, got, c.want)
		}
	}
}
