// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package poll

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/db/dbtest"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/providers/curseforge"
	"github.com/fireball1725/modwatch/internal/providers/modrinth"
	"github.com/fireball1725/modwatch/internal/repository"
	"github.com/fireball1725/modwatch/internal/settings"
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
	conn := dbtest.Open(t)
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
	conn := dbtest.Open(t)
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
		{"graves-1.0.jar", "Graves", "1.0.jar"},
		{"Graves-1.11-b2-universal.jar", "Graves", "1.11-b2-universal.jar"},
		{"graves-1.8.9-b46-universal.jar", "Graves", "1.8.9-b46-universal.jar"},
		{"ae2ee3emcaddon-1.0.jar", "AE2 EE3 EMC Add-on", "1.0.jar"},
		{"Graves.jar", "Graves", "Graves.jar"},
		{"Graves v2.0", "Graves", "2.0"},
		{"Graves", "Graves", "Graves"},
	} {
		if got := versionOf(c.display, c.project); got != c.want {
			t.Errorf("versionOf(%q, %q) = %q, want %q", c.display, c.project, got, c.want)
		}
	}
}

func processingProject() modrinth.Project {
	queued := time.Date(2026, 11, 10, 8, 0, 0, 0, time.UTC)
	req := "approved"
	return modrinth.Project{
		ID: "P9", Slug: "ae-lights", Title: "AE Lights", Description: "Lights", ProjectType: "mod",
		Status: "processing", RequestedStatus: &req, ModeratorMsg: "Add a licence.", Queued: &queued,
		Followers: 2, Downloads: 15, SourceURL: "https://src",
	}
}

func TestPollStoresProjectsOfBothPlatforms(t *testing.T) {
	cfMod := mod(1, "Mine", 10)
	cfMod.Status, cfMod.ThumbsUp = 2, 6
	cfMod.Links.IssuesURL = "https://cf-issues"
	team := mod(2, "Team", 99)
	team.Status = 4

	svc, repo := newServiceWith(t,
		fakeSource{member: []curseforge.Mod{cfMod, team}, owned: []curseforge.Mod{cfMod}},
		fakeModrinth{projects: []modrinth.Project{processingProject()}})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	got, err := repo.ListPlatformStats(context.Background(), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	by := map[string]models.PlatformStat{}
	for _, s := range got {
		by[s.Platform+"/"+s.ID] = s
	}
	if len(by) != 3 {
		t.Fatalf("want 2 CurseForge and 1 Modrinth project, got %+v", got)
	}

	if c := by["curseforge/1"]; c.Status != models.StatusChangesRequired || c.RawStatus != "ChangesRequired" || !c.Owned || c.Followers != 6 || c.IssuesURL != "https://cf-issues" || c.Downloads != 10 {
		t.Errorf("curseforge mine = %+v", c)
	}
	if c := by["curseforge/2"]; c.Status != models.StatusApproved || c.Owned {
		t.Errorf("curseforge team = %+v", c)
	}
	m := by["modrinth/P9"]
	if m.Status != models.StatusInReview || m.RawStatus != "processing" || m.StatusMessage != "Add a licence." || m.RequestedStatus != "approved" {
		t.Errorf("modrinth review = %+v", m)
	}
	if !m.Owned || m.QueuedAt.IsZero() || m.URL != "https://modrinth.com/mod/ae-lights" || m.Downloads != 15 || m.Followers != 2 {
		t.Errorf("modrinth project = %+v", m)
	}
}

func TestModrinthOutageKeepsItsLastProjects(t *testing.T) {
	cf := fakeSource{owned: []curseforge.Mod{mod(1, "Mine", 10)}}
	svc, repo := newServiceWith(t, cf, fakeModrinth{projects: []modrinth.Project{processingProject()}})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	svc.mr = fakeModrinth{err: errors.New("modrinth: rate limited")}
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	got, _ := repo.ListPlatformStats(context.Background(), time.Now())
	var mr, cfn int
	for _, s := range got {
		if s.Platform == "modrinth" {
			mr++
		} else {
			cfn++
		}
	}
	if mr != 1 || cfn != 1 {
		t.Errorf("the failed source must keep its last projects: %+v", got)
	}
}

func modrinthDetail(t *testing.T, repo *repository.Repo) (models.SourceStatus, bool) {
	t.Helper()
	sts, err := repo.ListSourceStatuses(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range sts {
		if s.Source == models.SourceModrinth {
			return s, true
		}
	}
	return models.SourceStatus{}, false
}

func TestMissingModrinthTokenIsSaidOutLoud(t *testing.T) {
	svc, repo := newServiceWith(t, fakeSource{owned: []curseforge.Mod{mod(1, "Mine", 10)}}, fakeModrinth{})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	st, ok := modrinthDetail(t, repo)
	want := "Drafts and projects in review are hidden without MODRINTH_TOKEN"
	if !ok || !st.OK || st.Detail != want {
		t.Errorf("status = %+v, want detail %q", st, want)
	}
	if cf, _ := repo.ListSourceStatuses(context.Background()); cf[0].Detail != "" {
		t.Errorf("curseforge must carry no detail: %+v", cf)
	}

	svc.cfg.ModrinthToken = "tok"
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if st, _ := modrinthDetail(t, repo); st.Detail != "" {
		t.Errorf("detail with a token = %q", st.Detail)
	}
}

func TestMissingTokenDetailSurvivesAModrinthFailure(t *testing.T) {
	svc, repo := newServiceWith(t, fakeSource{owned: []curseforge.Mod{mod(1, "Mine", 10)}}, fakeModrinth{err: errors.New("down")})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if st, _ := modrinthDetail(t, repo); st.OK || st.Detail == "" || st.Error == "" {
		t.Errorf("status = %+v", st)
	}
}

type fakeGitHub struct {
	issues []models.Issue
	err    error
}

func (f fakeGitHub) ListIssues(context.Context, string) ([]models.Issue, error) {
	return f.issues, f.err
}

func sourceOf(t *testing.T, repo *repository.Repo, name string) (models.SourceStatus, bool) {
	t.Helper()
	sts, err := repo.ListSourceStatuses(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range sts {
		if s.Source == name {
			return s, true
		}
	}
	return models.SourceStatus{}, false
}

func TestIssuesAreStoredAndTheDetailNamesTheMissingToken(t *testing.T) {
	svc, repo := newService(t, fakeSource{owned: []curseforge.Mod{mod(1, "Mine", 10)}})
	svc.cfg.GitHubIssuesRepo = "o/r"
	at := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	svc.WithGitHub(fakeGitHub{issues: []models.Issue{{Number: 7, Title: "t", State: "open", Kind: "bug", ModLabel: "mine", Labels: []string{"bug"}, CreatedAt: at, UpdatedAt: at}}})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	got, err := repo.ListIssues(context.Background(), "open")
	if err != nil || len(got) != 1 || got[0].Number != 7 || got[0].ModLabel != "mine" || !got[0].CreatedAt.Equal(at) {
		t.Fatalf("issues = %+v, %v", got, err)
	}
	st, ok := sourceOf(t, repo, models.SourceGitHub)
	if !ok || !st.OK || st.Detail != "Unauthenticated: 60 requests an hour" {
		t.Errorf("status = %+v", st)
	}

	svc.cfg.GitHubToken = "tok"
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if st, _ := sourceOf(t, repo, models.SourceGitHub); st.Detail != "" {
		t.Errorf("detail with a token = %q", st.Detail)
	}
}

func TestGitHubFailureKeepsIssuesAndDoesNotFailThePoll(t *testing.T) {
	svc, repo := newService(t, fakeSource{owned: []curseforge.Mod{mod(1, "Mine", 10)}})
	svc.cfg.GitHubIssuesRepo = "o/r"
	at := time.Now().UTC()
	svc.WithGitHub(fakeGitHub{issues: []models.Issue{{Number: 7, State: "open", Kind: "bug", CreatedAt: at, UpdatedAt: at}}})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	svc.WithGitHub(fakeGitHub{err: errors.New("github: rate limit reached")})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatalf("a GitHub failure failed the poll: %v", err)
	}
	if got, _ := repo.ListIssues(context.Background(), "all"); len(got) != 1 {
		t.Errorf("issues after failure = %d, want the last 1", len(got))
	}
	if st, _ := sourceOf(t, repo, models.SourceGitHub); st.OK || st.Error == "" {
		t.Errorf("status = %+v", st)
	}

	// A good poll with no issues clears the old ones.
	svc.WithGitHub(fakeGitHub{})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if got, _ := repo.ListIssues(context.Background(), "all"); len(got) != 0 {
		t.Errorf("issues = %d, want 0", len(got))
	}
}

func TestGitHubOffWithoutARepo(t *testing.T) {
	svc, repo := newService(t, fakeSource{owned: []curseforge.Mod{mod(1, "Mine", 10)}})
	svc.WithGitHub(fakeGitHub{})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, ok := sourceOf(t, repo, models.SourceGitHub); ok {
		t.Error("no github source expected when GITHUB_ISSUES_REPO is empty")
	}
}

func TestEmptyModListIsAFailedPollAndKeepsTheLastGoodOne(t *testing.T) {
	svc, repo := newService(t, fakeSource{member: []curseforge.Mod{mod(1, "mine", 10)}, owned: []curseforge.Mod{mod(1, "mine", 10)}})
	if err := svc.Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	svc.cf = fakeSource{}
	if err := svc.Run(context.Background()); err == nil {
		t.Fatal("an empty mod list should fail the poll")
	}
	stats, err := repo.ListModStats(context.Background(), time.Now())
	if err != nil || len(stats) != 1 {
		t.Errorf("stats = %+v, err = %v; the last good poll should stay current", stats, err)
	}
}

func TestWaitReturnsOnceThePollIsDone(t *testing.T) {
	svc, _ := newService(t, fakeSource{member: []curseforge.Mod{mod(1, "mine", 10)}})
	if err := svc.Start(); err != nil {
		t.Fatal(err)
	}
	if !svc.Wait(5 * time.Second) {
		t.Error("poll did not finish")
	}
}

// repoGitHub serves issues per repository and counts the calls.
type repoGitHub struct {
	byRepo map[string][]models.Issue
	failed map[string]error
	calls  *[]string
}

func (g repoGitHub) ListIssues(_ context.Context, repo string) ([]models.Issue, error) {
	*g.calls = append(*g.calls, repo)
	if err := g.failed[repo]; err != nil {
		return nil, err
	}
	out := append([]models.Issue(nil), g.byRepo[repo]...)
	return out, nil
}

func TestIssuesComeFromTheSharedRepoAndEachModsOwn(t *testing.T) {
	ctx := context.Background()
	at := time.Now().UTC()
	svc, repo := newService(t, fakeSource{owned: []curseforge.Mod{mod(1, "mine", 10)}})
	svc.cfg.GitHubIssuesRepo = "me/shared"
	// One poll first, so the catalog has an entry to give its own repository.
	if err := svc.Run(ctx); err != nil {
		t.Fatal(err)
	}
	own := "me/mine-issues"
	if _, err := repo.UpdateCatalogEntry(ctx, "mine", models.CatalogUpdate{GitHubRepo: models.Patch[string]{Set: true, Value: &own}}); err != nil {
		t.Fatal(err)
	}
	var calls []string
	mk := func(n int) models.Issue {
		return models.Issue{Number: n, State: "open", Kind: "bug", CreatedAt: at, UpdatedAt: at}
	}
	svc.WithGitHub(repoGitHub{calls: &calls, byRepo: map[string][]models.Issue{
		"me/shared":      {mk(1), mk(2)},
		"me/mine-issues": {mk(1)}, // the same number in another repo
	}})
	if err := svc.Run(ctx); err != nil {
		t.Fatal(err)
	}
	if len(calls) != 2 || calls[0] != "me/shared" || calls[1] != "me/mine-issues" {
		t.Errorf("repositories read = %v, want the shared one then the mod's own", calls)
	}
	got, _ := repo.ListIssues(ctx, "all")
	perRepo := map[string]int{}
	for _, is := range got {
		perRepo[is.Repo]++
	}
	if perRepo["me/shared"] != 2 || perRepo["me/mine-issues"] != 1 {
		t.Errorf("stored per repo = %v", perRepo)
	}
}

func TestOneFailingRepoKeepsItsIssuesAndNamesItInTheStatus(t *testing.T) {
	ctx := context.Background()
	at := time.Now().UTC()
	svc, repo := newService(t, fakeSource{owned: []curseforge.Mod{mod(1, "mine", 10)}})
	svc.cfg.GitHubIssuesRepo = "me/shared"
	if err := svc.Run(ctx); err != nil {
		t.Fatal(err)
	}
	own := "me/mine-issues"
	if _, err := repo.UpdateCatalogEntry(ctx, "mine", models.CatalogUpdate{GitHubRepo: models.Patch[string]{Set: true, Value: &own}}); err != nil {
		t.Fatal(err)
	}
	var calls []string
	issues := map[string][]models.Issue{
		"me/shared":      {{Number: 1, State: "open", Kind: "bug", CreatedAt: at, UpdatedAt: at}},
		"me/mine-issues": {{Number: 1, State: "open", Kind: "bug", CreatedAt: at, UpdatedAt: at}},
	}
	svc.WithGitHub(repoGitHub{calls: &calls, byRepo: issues})
	if err := svc.Run(ctx); err != nil {
		t.Fatal(err)
	}
	svc.WithGitHub(repoGitHub{calls: &calls, byRepo: issues, failed: map[string]error{"me/mine-issues": errors.New("github: not found")}})
	if err := svc.Run(ctx); err != nil {
		t.Fatalf("one repo failing must not fail the poll: %v", err)
	}
	if got, _ := repo.ListIssues(ctx, "all"); len(got) != 2 {
		t.Errorf("stored = %d, want both kept", len(got))
	}
	st, _ := sourceOf(t, repo, models.SourceGitHub)
	if st.OK || !strings.Contains(st.Error, "me/mine-issues") || strings.Contains(st.Error, "me/shared") {
		t.Errorf("status = %+v, want the failing repo named and only it", st)
	}
}

type recordingFactory struct{ seen *[]*config.Config }

func (f recordingFactory) CurseForge(cfg *config.Config) CurseForge {
	*f.seen = append(*f.seen, cfg)
	return fakeSource{owned: []curseforge.Mod{mod(1, "mine", 10)}}
}
func (recordingFactory) Modrinth(*config.Config) Modrinth { return nil }
func (recordingFactory) GitHub(*config.Config) GitHub     { return nil }

func TestEachPollReadsTheCurrentSettings(t *testing.T) {
	ctx := context.Background()
	conn := dbtest.Open(t)
	repo := repository.New(conn)
	base := &config.Config{} // nothing in the environment
	store := settings.New(base, repo)
	var seen []*config.Config
	svc := New(ctx, base, repo, nil, nil).WithSettings(store, recordingFactory{seen: &seen})

	if err := svc.Start(); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("with no key anywhere, Start = %v, want ErrNotConfigured", err)
	}
	key, id := "ui-key", "77"
	if err := store.Update(ctx, map[string]*string{config.KeyCurseForgeAPIKey: &key, config.KeyCurseForgeAuthorID: &id}); err != nil {
		t.Fatal(err)
	}
	if err := svc.Run(ctx); err != nil {
		t.Fatal(err)
	}
	if len(seen) != 1 || seen[0].CurseForgeKey != "ui-key" || seen[0].CurseForgeAuthorID != 77 {
		t.Fatalf("the poll must build its clients from Settings, saw %+v", seen)
	}
	if base.CurseForgeKey != "" {
		t.Error("the base configuration must stay as the environment gave it")
	}
	// Change it again; the next poll sees the new value without a restart.
	id2 := "78"
	if err := store.Update(ctx, map[string]*string{config.KeyCurseForgeAuthorID: &id2}); err != nil {
		t.Fatal(err)
	}
	if err := svc.Run(ctx); err != nil {
		t.Fatal(err)
	}
	if len(seen) != 2 || seen[1].CurseForgeAuthorID != 78 {
		t.Errorf("second poll saw %+v", seen)
	}
}
