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
		if _, err := repo.SavePoll(context.Background(), p, readings); err != nil {
			t.Fatal(err)
		}
	}
	cfg := &config.Config{Schedule: "0 * * * *"}
	return NewRouter(cfg, repo, poll.New(context.Background(), cfg, repo, noSource{}))
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
		`modwatch_mods{owned="true"} 1`,
		`modwatch_mods{owned="false"} 1`,
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
