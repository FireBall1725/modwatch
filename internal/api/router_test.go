// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/db"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/poll"
	"github.com/fireball1725/modwatch/internal/providers/curseforge"
	"github.com/fireball1725/modwatch/internal/repository"
)

type noSource struct{}

func (noSource) ListByAuthor(context.Context, int, bool) ([]curseforge.Mod, error) { return nil, nil }
func (noSource) ListFiles(context.Context, int) ([]curseforge.File, error)         { return nil, nil }

func newServer(t *testing.T, readings ...models.Reading) http.Handler {
	t.Helper()
	conn, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	repo := repository.New(conn)
	if len(readings) > 0 {
		now := time.Now()
		p := models.Poll{StartedAt: now.Add(-2 * time.Second), FinishedAt: now}
		if _, err := repo.SavePoll(context.Background(), p, readings, nil, nil); err != nil {
			t.Fatal(err)
		}
	}
	cfg := &config.Config{Schedule: "0 * * * *"}
	return NewRouter(cfg, repo, poll.New(context.Background(), cfg, repo, noSource{}, nil))
}

func get(t *testing.T, h http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func TestMetricsExposition(t *testing.T) {
	h := newServer(t,
		models.Reading{Mod: models.Mod{ID: 7, Slug: "graves", Name: `Graves "beta"`, Owned: true}, Downloads: 325645},
		models.Reading{Mod: models.Mod{ID: 9, Slug: "ae2", Name: "Applied Energistics 2"}, Downloads: 99},
	)
	rec := get(t, h, "/metrics")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/plain; version=0.0.4") {
		t.Errorf("content type = %q", ct)
	}
	body := rec.Body.String()
	for _, want := range []string{
		"# TYPE modwatch_mod_downloads_total counter",
		`modwatch_mod_downloads_total{id="7",slug="graves",name="Graves \"beta\"",owned="true"} 325645`,
		`modwatch_mod_downloads_total{id="9",slug="ae2",name="Applied Energistics 2",owned="false"} 99`,
		"modwatch_last_poll_success 1",
		`modwatch_build_info{version="0.0.0-dev"} 1`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("metrics missing %q\n%s", want, body)
		}
	}
}

func TestMetricsBeforeTheFirstPollStillServes(t *testing.T) {
	rec := get(t, newServer(t), "/metrics")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "modwatch_build_info") {
		t.Errorf("status %d body %q", rec.Code, rec.Body.String())
	}
}

func TestSummaryTotalsOwnedSeparately(t *testing.T) {
	h := newServer(t,
		models.Reading{Mod: models.Mod{ID: 1, Slug: "a", Name: "a", Owned: true}, Downloads: 100},
		models.Reading{Mod: models.Mod{ID: 2, Slug: "b", Name: "b"}, Downloads: 900},
	)
	var s summaryResponse
	if err := json.Unmarshal(get(t, h, "/api/v1/summary").Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	if s.Owned.Downloads != 100 || s.All.Downloads != 1000 || s.Owned.Mods != 1 || s.All.Mods != 2 {
		t.Errorf("summary = %+v", s)
	}
	if s.Problems == nil {
		t.Error("problems must serialize as [], not null")
	}
}

func TestListsAreNeverNull(t *testing.T) {
	h := newServer(t)
	if got := strings.TrimSpace(get(t, h, "/api/v1/mods").Body.String()); got != "[]" {
		t.Errorf("mods = %s", got)
	}
	if got := strings.TrimSpace(get(t, h, "/api/v1/history").Body.String()); got != "{}" {
		t.Errorf("history = %s", got)
	}
}

func TestHistoryRejectsABadRange(t *testing.T) {
	if rec := get(t, newServer(t), "/api/v1/history?days=0"); rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d", rec.Code)
	}
}

func TestPollWithoutAKeyIsAConflict(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/poll", nil))
	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d", rec.Code)
	}
}

func TestUnknownAPIPathIs404NotTheUI(t *testing.T) {
	if rec := get(t, newServer(t), "/api/v1/nope"); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d", rec.Code)
	}
}

func serverWithFiles(t *testing.T, files []models.FileReading, statuses []models.SourceStatus) http.Handler {
	t.Helper()
	conn, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	repo := repository.New(conn)
	now := time.Now()
	p := models.Poll{StartedAt: now.Add(-time.Second), FinishedAt: now}
	if _, err := repo.SavePoll(context.Background(), p, nil, files, statuses); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Schedule: "0 * * * *"}
	return NewRouter(cfg, repo, poll.New(context.Background(), cfg, repo, noSource{}, nil))
}

func fileReading(source, slug, version string, n int64, gv, loaders []string) models.FileReading {
	return models.FileReading{
		File: models.File{Source: source, ID: slug + version, ProjectID: slug, ProjectSlug: slug, ProjectName: slug,
			Name: version, Version: version, ReleaseType: "release", GameVersions: gv, Loaders: loaders},
		Downloads: n,
	}
}

func TestVersionsRollUpByMinecraftVersionAndLoader(t *testing.T) {
	h := serverWithFiles(t, []models.FileReading{
		fileReading("curseforge", "a", "1", 100, []string{"1.21.1"}, []string{"neoforge"}),
		fileReading("modrinth", "a", "2", 30, []string{"1.21.1", "1.21"}, []string{"neoforge", "fabric"}),
		fileReading("curseforge", "b", "1", 5, []string{"1.20.1"}, []string{"forge"}),
	}, nil)
	var v versionsResponse
	if err := json.Unmarshal(get(t, h, "/api/v1/versions").Body.Bytes(), &v); err != nil {
		t.Fatal(err)
	}
	want := map[string]int64{"1.21.1": 130, "1.21": 30, "1.20.1": 5}
	for _, gv := range v.GameVersions {
		if want[gv.Name] != gv.Downloads {
			t.Errorf("game version %s = %d, want %d", gv.Name, gv.Downloads, want[gv.Name])
		}
	}
	if len(v.GameVersions) != 3 || v.GameVersions[0].Name != "1.21.1" {
		t.Errorf("biggest first: %+v", v.GameVersions)
	}
	if v.Loaders[0].Name != "neoforge" || v.Loaders[0].Downloads != 130 {
		t.Errorf("loaders = %+v", v.Loaders)
	}
}

func TestVersionsAreNeverNull(t *testing.T) {
	body := get(t, newServer(t), "/api/v1/versions").Body.String()
	if !strings.Contains(body, `"gameVersions":[]`) || !strings.Contains(body, `"loaders":[]`) {
		t.Errorf("body = %s", body)
	}
	if got := strings.TrimSpace(get(t, newServer(t), "/api/v1/files").Body.String()); got != "[]" {
		t.Errorf("files = %s", got)
	}
}

func TestFileAndSourceMetrics(t *testing.T) {
	now := time.Now()
	h := serverWithFiles(t, []models.FileReading{
		fileReading("curseforge", "tower", "26.11.0-rc.2", 16, []string{"1.21.1"}, []string{"neoforge"}),
		fileReading("curseforge", "tower", "26.11.0-rc.1", 17, []string{"1.21.1", "1.21"}, []string{"neoforge"}),
	}, []models.SourceStatus{
		{Source: "curseforge", OK: true, CheckedAt: now, LastOKAt: now},
		{Source: "modrinth", OK: false, Error: "429", CheckedAt: now},
	})
	body := get(t, h, "/metrics").Body.String()
	for _, want := range []string{
		`modwatch_file_downloads_total{source="curseforge",slug="tower",name="tower",id="tower26.11.0-rc.2",version="26.11.0-rc.2",release_type="release",game_versions="1.21.1",loaders="neoforge"} 16`,
		`modwatch_game_version_downloads_total{source="curseforge",slug="tower",name="tower",game_version="1.21.1"} 33`,
		`modwatch_game_version_downloads_total{source="curseforge",slug="tower",name="tower",game_version="1.21"} 17`,
		`modwatch_loader_downloads_total{source="curseforge",slug="tower",name="tower",loader="neoforge"} 33`,
		`modwatch_source_up{source="curseforge"} 1`,
		`modwatch_source_up{source="modrinth"} 0`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("metrics missing %q\n%s", want, body)
		}
	}
	if strings.Contains(body, `modwatch_source_last_success_timestamp_seconds{source="modrinth"}`) {
		t.Error("a source that never worked has no last-success time")
	}
}

func TestSummaryListsSources(t *testing.T) {
	now := time.Now()
	h := serverWithFiles(t, nil, []models.SourceStatus{{Source: "modrinth", OK: false, Error: "429", Detail: "hidden without a token", CheckedAt: now}})
	var s summaryResponse
	if err := json.Unmarshal(get(t, h, "/api/v1/summary").Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	if len(s.Sources) != 1 || s.Sources[0].OK || s.Sources[0].Error != "429" || s.Sources[0].Detail != "hidden without a token" {
		t.Errorf("sources = %+v", s.Sources)
	}
}

// Two Modrinth versions sharing a version number must stay two series, and every series of a mod uses its registry slug.
func TestMetricsFileSeriesAreUniqueAndUseRegistrySlug(t *testing.T) {
	conn, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	repo := repository.New(conn)
	now := time.Now()
	p := models.Poll{StartedAt: now.Add(-time.Second), FinishedAt: now}
	mk := func(id string, n int64) models.FileReading {
		return models.FileReading{
			File: models.File{Source: "modrinth", ID: id, ProjectID: "MR1", ProjectSlug: "ags", ProjectName: "Auto Scale",
				Name: id, Version: "1.0", ReleaseType: "release", GameVersions: []string{"1.21.1"}, Loaders: []string{"neoforge"}},
			Downloads: n,
		}
	}
	projects := []models.PlatformReading{
		{PlatformProject: models.PlatformProject{Platform: "modrinth", ID: "MR1", Slug: "ags", Name: "Auto Scale", Status: models.StatusApproved, Owned: true}, Downloads: 50},
		{PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "5", Slug: "automatic-gui-scale", Name: "Auto Scale", Status: models.StatusApproved, Owned: true}, Downloads: 7},
	}
	if _, err := repo.SavePollWithProjects(context.Background(), p, nil, []models.FileReading{mk("v1", 40), mk("v2", 10)}, projects, nil); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Schedule: "0 * * * *"}
	h := NewRouter(cfg, repo, poll.New(context.Background(), cfg, repo, noSource{}, nil))
	body := get(t, h, "/metrics").Body.String()

	seen := map[string]bool{}
	for _, line := range strings.Split(body, "\n") {
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		series := line[:strings.LastIndex(line, " ")]
		if seen[series] {
			t.Errorf("duplicate series %s", series)
		}
		seen[series] = true
	}
	if !strings.Contains(body, `id="v1"`) || !strings.Contains(body, `id="v2"`) {
		t.Errorf("file series need the version id:\n%s", body)
	}
	if strings.Contains(body, `slug="ags"`) {
		t.Errorf("a series uses the Modrinth slug instead of the registry slug:\n%s", body)
	}
	if !strings.Contains(body, `modwatch_mods{owned="true"} 1`) {
		t.Errorf("modwatch_mods should count registry entries:\n%s", body)
	}
}

func TestUnknownAPIPathIsJSON(t *testing.T) {
	rec := get(t, newServer(t), "/api/v1/nope")
	if rec.Code != http.StatusNotFound || strings.TrimSpace(rec.Body.String()) != `{"error":"not found"}` {
		t.Errorf("status %d body %q", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("content type = %q", ct)
	}
}

func TestEmptyQueryValueActsAbsent(t *testing.T) {
	h := newServer(t)
	for _, base := range []string{"/api/v1/history", "/api/v1/downloads/history", "/api/v1/versions", "/api/v1/issues", "/api/v1/mods", "/api/v1/files", "/api/v1/releases"} {
		want := get(t, h, base)
		for _, q := range []string{"?days=", "?state=", "?days=&state="} {
			got := get(t, h, base+q)
			if got.Code != want.Code || got.Body.String() != want.Body.String() {
				t.Errorf("%s%s: status %d vs %d", base, q, got.Code, want.Code)
			}
		}
	}
}

func TestSummaryAndOverviewReportMissingModrinthToken(t *testing.T) {
	cfg := &config.Config{Schedule: "0 * * * *", ModrinthUser: "someone"}
	conn, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	repo := repository.New(conn)
	h := NewRouter(cfg, repo, poll.New(context.Background(), cfg, repo, noSource{}, nil))
	for _, path := range []string{"/api/v1/summary", "/api/v1/overview"} {
		var body struct {
			Problems []string `json:"problems"`
		}
		if err := json.Unmarshal(get(t, h, path).Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		found := false
		for _, p := range body.Problems {
			if strings.Contains(p, "MODRINTH_TOKEN is not set, so Modrinth drafts and projects in review are hidden") {
				found = true
			}
		}
		if !found {
			t.Errorf("%s problems = %v", path, body.Problems)
		}
	}
}
