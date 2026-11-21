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
	"github.com/fireball1725/modwatch/internal/db/dbtest"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/poll"
	"github.com/fireball1725/modwatch/internal/repository"
)

func catalogServer(t *testing.T) http.Handler {
	t.Helper()
	conn := dbtest.Open(t)
	repo := repository.New(conn)
	now := time.Now()
	p := models.Poll{StartedAt: now.Add(-time.Second), FinishedAt: now}
	mk := func(platform, id, slug, name string, owned bool) models.PlatformReading {
		return models.PlatformReading{PlatformProject: models.PlatformProject{Platform: platform, ID: id, Slug: slug, Name: name, Owned: owned}}
	}
	ps := []models.PlatformReading{
		mk("curseforge", "1", "firecorelib", "FireCore Lib", true),
		mk("modrinth", "m1", "firecoremod", "FireCore", true),
		mk("curseforge", "2", "ae2", "Applied Energistics 2", false),
	}
	if _, err := repo.SavePollWithProjects(context.Background(), p, nil, nil, ps, nil); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Schedule: "0 * * * *"}
	return NewRouter(cfg, repo, poll.New(context.Background(), cfg, repo, noSource{}, nil))
}

func send(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func TestCatalogShape(t *testing.T) {
	rec := get(t, catalogServer(t), "/api/v1/catalog")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var raw map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	entries := raw["entries"].([]any)
	if len(entries) != 2 || entries[0].(map[string]any)["slug"] != "firecoremod" {
		t.Errorf("entries = %v", entries)
	}
	first := entries[0].(map[string]any)
	if first["curseforgeId"] != nil || first["githubLabel"] != nil || first["auto"] != true {
		t.Errorf("first = %v", first)
	}
	un := raw["unlinked"].(map[string]any)
	if len(un["projects"].([]any)) != 1 {
		t.Errorf("unlinked projects = %v", un["projects"])
	}
	if labels, ok := un["githubLabels"].([]any); !ok || len(labels) != 0 {
		t.Errorf("githubLabels = %v", un["githubLabels"])
	}
}

func TestCatalogEmptyListsAreNotNull(t *testing.T) {
	conn := dbtest.Open(t)
	cfg := &config.Config{}
	h := NewRouter(cfg, repository.New(conn), poll.New(context.Background(), cfg, repository.New(conn), noSource{}, nil))
	body := get(t, h, "/api/v1/catalog").Body.String()
	if strings.Contains(body, "null") {
		t.Errorf("body has null: %s", body)
	}
}

func TestCatalogPutMergesAndReturnsCatalog(t *testing.T) {
	h := catalogServer(t)
	rec := send(h, http.MethodPut, "/api/v1/catalog/firecorelib", `{"modrinthId":"m1","name":"FireCore","hidden":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var c struct {
		Entries []models.CatalogEntry `json:"entries"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &c); err != nil {
		t.Fatal(err)
	}
	if len(c.Entries) != 1 || c.Entries[0].Auto || !c.Entries[0].Hidden || c.Entries[0].Name != "FireCore" {
		t.Errorf("entries = %+v", c.Entries)
	}
}

func TestCatalogPutNullClears(t *testing.T) {
	h := catalogServer(t)
	send(h, http.MethodPut, "/api/v1/catalog/firecorelib", `{"modrinthId":"m1"}`)
	rec := send(h, http.MethodPut, "/api/v1/catalog/firecorelib", `{"modrinthId":null}`)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"modrinthId":null`) {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
}

func TestCatalogPutErrors(t *testing.T) {
	h := catalogServer(t)
	cases := []struct {
		name, path, body string
		want             int
	}{
		{"unknown slug", "/api/v1/catalog/nope", `{}`, http.StatusNotFound},
		{"bad json", "/api/v1/catalog/firecorelib", `{`, http.StatusBadRequest},
		{"not an object", "/api/v1/catalog/firecorelib", `[1]`, http.StatusBadRequest},
		{"null body", "/api/v1/catalog/firecorelib", `null`, http.StatusBadRequest},
		{"unknown field", "/api/v1/catalog/firecorelib", `{"slug":"x"}`, http.StatusBadRequest},
		{"wrong type", "/api/v1/catalog/firecorelib", `{"curseforgeId":"one"}`, http.StatusBadRequest},
		{"null name", "/api/v1/catalog/firecorelib", `{"name":null}`, http.StatusBadRequest},
		{"unknown project", "/api/v1/catalog/firecorelib", `{"modrinthId":"zzz"}`, http.StatusBadRequest},
		{"unknown cf project", "/api/v1/catalog/firecorelib", `{"curseforgeId":404}`, http.StatusBadRequest},
		{"empty name", "/api/v1/catalog/firecorelib", `{"name":""}`, http.StatusBadRequest},
	}
	for _, c := range cases {
		rec := send(h, http.MethodPut, c.path, c.body)
		if rec.Code != c.want {
			t.Errorf("%s: status = %d, want %d (%s)", c.name, rec.Code, c.want, rec.Body)
			continue
		}
		var e map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &e); err != nil || e["error"] == "" {
			t.Errorf("%s: body = %s", c.name, rec.Body)
		}
	}
}

func TestCatalogRelinkKeepsManualEntries(t *testing.T) {
	h := catalogServer(t)
	send(h, http.MethodPut, "/api/v1/catalog/firecorelib", `{"modrinthId":"m1"}`)
	rec := send(h, http.MethodPost, "/api/v1/catalog/relink", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var c struct {
		Entries []models.CatalogEntry `json:"entries"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &c)
	if len(c.Entries) != 1 {
		t.Errorf("entries = %+v", c.Entries)
	}
}

func TestCatalogPutLegacy(t *testing.T) {
	h := catalogServer(t)
	rec := send(h, http.MethodPut, "/api/v1/catalog/firecorelib", `{"legacy":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d %s", rec.Code, rec.Body)
	}
	var out catalogResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, e := range out.Entries {
		if e.Slug == "firecorelib" {
			found = true
			if !e.Legacy || e.Auto {
				t.Errorf("entry = %+v", e)
			}
		} else if e.Legacy {
			t.Errorf("%s must not be legacy", e.Slug)
		}
	}
	if !found {
		t.Fatal("entry missing")
	}
	if !strings.Contains(get(t, h, "/api/v1/catalog").Body.String(), `"legacy":true`) {
		t.Error("GET must return legacy")
	}
	for _, body := range []string{`{"legacy":null}`, `{"legacy":"yes"}`, `{"legacy":1}`} {
		if rec := send(h, http.MethodPut, "/api/v1/catalog/firecorelib", body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d", body, rec.Code)
		}
	}
}

func TestLegacyModsHideUnlessAskedAndStayInMetrics(t *testing.T) {
	h := catalogServer(t)
	if rec := send(h, http.MethodPut, "/api/v1/catalog/firecorelib", `{"legacy":true}`); rec.Code != http.StatusOK {
		t.Fatalf("put = %d %s", rec.Code, rec.Body)
	}
	slugs := func(path string) string {
		var mods []modSummary
		if err := json.Unmarshal(get(t, h, path).Body.Bytes(), &mods); err != nil {
			t.Fatal(err)
		}
		return names(mods)
	}
	if got := slugs("/api/v1/mods"); strings.Contains(got, "firecorelib") {
		t.Errorf("default list = %q, must leave the legacy mod out", got)
	}
	if got := slugs("/api/v1/mods?legacy=1"); !strings.Contains(got, "firecorelib") {
		t.Errorf("?legacy=1 list = %q, must include it", got)
	}
	if rec := get(t, h, "/api/v1/mods/firecorelib"); rec.Code != http.StatusOK {
		t.Errorf("a legacy mod's own page = %d, want 200", rec.Code)
	}
	if !strings.Contains(get(t, h, "/metrics").Body.String(), `slug="firecorelib"`) {
		t.Error("metrics must keep legacy mods; Prometheus wants every series")
	}
}
