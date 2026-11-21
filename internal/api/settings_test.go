// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/db/dbtest"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/poll"
	"github.com/fireball1725/modwatch/internal/repository"
)

// serverWith builds a router over a fresh database with the given environment configuration.
func serverWith(t *testing.T, cfg *config.Config, seed func(*repository.Repo)) http.Handler {
	t.Helper()
	repo := repository.New(dbtest.Open(t))
	if seed != nil {
		seed(repo)
	}
	return NewRouter(cfg, repo, poll.New(context.Background(), cfg, repo, noSource{}, nil))
}

type settingsBody struct {
	Items []struct {
		Key    string  `json:"key"`
		Secret bool    `json:"secret"`
		Value  *string `json:"value"`
		Set    bool    `json:"set"`
		Source string  `json:"source"`
		EnvSet bool    `json:"envSet"`
	} `json:"items"`
}

func readSettings(t *testing.T, h http.Handler) map[string]struct {
	Value  *string
	Set    bool
	Source string
	EnvSet bool
	Secret bool
} {
	t.Helper()
	var b settingsBody
	if err := json.Unmarshal(get(t, h, "/api/v1/settings").Body.Bytes(), &b); err != nil {
		t.Fatal(err)
	}
	out := map[string]struct {
		Value  *string
		Set    bool
		Source string
		EnvSet bool
		Secret bool
	}{}
	for _, it := range b.Items {
		out[it.Key] = struct {
			Value  *string
			Set    bool
			Source string
			EnvSet bool
			Secret bool
		}{it.Value, it.Set, it.Source, it.EnvSet, it.Secret}
	}
	return out
}

func TestSettingsNeverReturnASecretAndUIWinsOverEnv(t *testing.T) {
	h := serverWith(t, &config.Config{CurseForgeKey: "ENVSECRET", CurseForgeAuthorID: 9, ModrinthUser: "env-user"}, nil)
	rec := send(h, http.MethodPut, "/api/v1/settings", `{"modrinthUser":"ui-user","githubToken":"ghp_UISECRET","curseforgeAuthorId":"42"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("put = %d %s", rec.Code, rec.Body)
	}
	for _, body := range []string{rec.Body.String(), get(t, h, "/api/v1/settings").Body.String()} {
		if strings.Contains(body, "ENVSECRET") || strings.Contains(body, "UISECRET") {
			t.Fatalf("a secret leaked: %s", body)
		}
	}
	got := readSettings(t, h)
	if s := got["modrinthUser"]; s.Source != "ui" || s.Value == nil || *s.Value != "ui-user" || !s.EnvSet {
		t.Errorf("modrinthUser = %+v", s)
	}
	if s := got["githubToken"]; s.Source != "ui" || s.Value != nil || !s.Set || !s.Secret {
		t.Errorf("githubToken = %+v", s)
	}
	if s := got["curseforgeApiKey"]; s.Source != "env" || s.Value != nil || !s.Set {
		t.Errorf("curseforgeApiKey = %+v", s)
	}
	// Clearing brings the environment back.
	send(h, http.MethodPut, "/api/v1/settings", `{"modrinthUser":null}`)
	if s := readSettings(t, h)["modrinthUser"]; s.Source != "env" || *s.Value != "env-user" {
		t.Errorf("after clearing: %+v", s)
	}
}

func TestSettingsRejectBadValues(t *testing.T) {
	h := serverWith(t, &config.Config{}, nil)
	for _, body := range []string{
		`{"curseforgeAuthorId":"abc"}`, `{"githubIssuesRepo":"nope"}`, `{"nothing":"x"}`,
		`{"metricsEnabled":"maybe"}`, `[1]`, `not json`, `{"githubToken":"has space"}`,
	} {
		if rec := send(h, http.MethodPut, "/api/v1/settings", body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", body, rec.Code)
		}
	}
	if s := readSettings(t, h)["githubIssuesRepo"]; s.Set {
		t.Error("a rejected update must save nothing")
	}
}

func TestSettingsChangeTheOverviewProblems(t *testing.T) {
	h := serverWith(t, &config.Config{Schedule: "0 * * * *"}, nil)
	overview := func() string { return get(t, h, "/api/v1/overview").Body.String() }
	if !strings.Contains(overview(), "CURSEFORGE_API_KEY is not set") {
		t.Fatal("with nothing configured the overview must list the missing key")
	}
	send(h, http.MethodPut, "/api/v1/settings", `{"curseforgeApiKey":"k","curseforgeAuthorId":"5"}`)
	if strings.Contains(overview(), "CURSEFORGE_API_KEY is not set") {
		t.Error("a key set in Settings must clear the setup problem")
	}
}

func TestMetricsCanBeTurnedOffInSettings(t *testing.T) {
	h := serverWith(t, &config.Config{}, nil)
	if rec := get(t, h, "/metrics"); rec.Code != http.StatusOK {
		t.Fatalf("metrics default = %d, want on", rec.Code)
	}
	send(h, http.MethodPut, "/api/v1/settings", `{"metricsEnabled":"false"}`)
	if rec := get(t, h, "/metrics"); rec.Code != http.StatusNotFound {
		t.Errorf("metrics off = %d, want 404", rec.Code)
	}
	if s := readSettings(t, h)["metricsEnabled"]; s.Source != "ui" || s.Value == nil || *s.Value != "false" {
		t.Errorf("metricsEnabled = %+v", s)
	}
	send(h, http.MethodPut, "/api/v1/settings", `{"metricsEnabled":null}`)
	if rec := get(t, h, "/metrics"); rec.Code != http.StatusOK {
		t.Errorf("metrics after clearing = %d, want on again", rec.Code)
	}
}

// draftServer has one owned mod that is a draft on Modrinth, which raises a dismissible not_approved item.
func draftServer(t *testing.T) http.Handler {
	t.Helper()
	return serverWith(t, &config.Config{Schedule: "0 * * * *"}, func(repo *repository.Repo) {
		now := time.Now()
		ps := []models.PlatformReading{{PlatformProject: models.PlatformProject{
			Platform: "modrinth", ID: "m1", Slug: "qmk", Name: "QMK", Owned: true, Status: models.StatusDraft, RawStatus: "draft"}}}
		if _, err := repo.SavePollWithProjects(context.Background(), models.Poll{StartedAt: now, FinishedAt: now}, nil, nil, ps, nil); err != nil {
			panic(err)
		}
	})
}

type overviewBody struct {
	Totals struct {
		NeedAttention int `json:"needAttention"`
	} `json:"totals"`
	Attention []struct {
		Kind        string `json:"kind"`
		Dismissible bool   `json:"dismissible"`
	} `json:"attention"`
	Dismissed []struct {
		Kind string `json:"kind"`
	} `json:"dismissed"`
	Mods []struct {
		Slug   string `json:"slug"`
		Health string `json:"health"`
	} `json:"mods"`
}

func readOverview(t *testing.T, h http.Handler) overviewBody {
	t.Helper()
	var o overviewBody
	if err := json.Unmarshal(get(t, h, "/api/v1/overview").Body.Bytes(), &o); err != nil {
		t.Fatal(err)
	}
	return o
}

func TestDismissingAnItemRemovesItAndTheModsHealthFollows(t *testing.T) {
	h := draftServer(t)
	before := readOverview(t, h)
	hasKind := func(o overviewBody, kind string) bool {
		for _, a := range o.Attention {
			if a.Kind == kind {
				return true
			}
		}
		return false
	}
	if !hasKind(before, "not_approved") || before.Mods[0].Health != "attention" || before.Totals.NeedAttention != 1 {
		t.Fatalf("setup: %+v", before)
	}
	for _, a := range before.Attention {
		if a.Kind == "not_approved" && !a.Dismissible {
			t.Error("a draft status is dismissible")
		}
	}

	if rec := send(h, http.MethodPost, "/api/v1/attention/dismiss", `{"kind":"not_approved","modSlug":"qmk"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("dismiss = %d %s", rec.Code, rec.Body)
	}
	after := readOverview(t, h)
	if hasKind(after, "not_approved") || len(after.Dismissed) != 1 || after.Dismissed[0].Kind != "not_approved" {
		t.Errorf("after dismissing: attention %+v dismissed %+v", after.Attention, after.Dismissed)
	}
	if after.Mods[0].Health != "ok" || after.Totals.NeedAttention != 0 {
		t.Errorf("a dismissed item must not count: health %q, needAttention %d", after.Mods[0].Health, after.Totals.NeedAttention)
	}
	var mod struct {
		Health    string `json:"health"`
		Attention []struct {
			Kind string `json:"kind"`
		} `json:"attention"`
	}
	if err := json.Unmarshal(get(t, h, "/api/v1/mods/qmk").Body.Bytes(), &mod); err != nil || mod.Health != "ok" {
		t.Errorf("mod detail health = %q, err %v", mod.Health, err)
	}
	for _, a := range mod.Attention {
		if a.Kind == "not_approved" {
			t.Error("the mod's own attention list must leave it out too")
		}
	}
	// Dismissing twice is fine, and restore brings it back.
	if rec := send(h, http.MethodPost, "/api/v1/attention/dismiss", `{"kind":"not_approved","modSlug":"qmk"}`); rec.Code != http.StatusNoContent {
		t.Errorf("second dismiss = %d", rec.Code)
	}
	if rec := send(h, http.MethodPost, "/api/v1/attention/restore", `{"kind":"not_approved","modSlug":"qmk"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("restore = %d", rec.Code)
	}
	back := readOverview(t, h)
	if !hasKind(back, "not_approved") || len(back.Dismissed) != 0 || back.Mods[0].Health != "attention" {
		t.Errorf("after restoring: %+v", back)
	}
}

func TestOnlySomeKindsCanBeDismissed(t *testing.T) {
	h := draftServer(t)
	for _, body := range []string{
		`{"kind":"crash_open","modSlug":"qmk"}`, `{"kind":"bug_open","modSlug":"qmk"}`, `{"kind":"source_down","modSlug":"qmk"}`,
		`{"kind":"unlinked","modSlug":"qmk"}`, `{"kind":"made_up","modSlug":"qmk"}`, `{"kind":"not_approved","modSlug":""}`, `{}`, `nope`,
	} {
		if rec := send(h, http.MethodPost, "/api/v1/attention/dismiss", body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", body, rec.Code)
		}
	}
}

func TestIssuesInAModsOwnRepoBelongToItWithoutALabel(t *testing.T) {
	h := serverWith(t, &config.Config{Schedule: "0 * * * *", GitHubIssuesRepo: "me/shared"}, func(repo *repository.Repo) {
		ctx := context.Background()
		now := time.Now().UTC()
		ps := []models.PlatformReading{{PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "1", Slug: "tower", Name: "Tower", Owned: true}}}
		id, err := repo.SavePollWithProjects(ctx, models.Poll{StartedAt: now, FinishedAt: now}, nil, nil, ps, nil)
		if err != nil {
			panic(err)
		}
		own := "me/tower-issues"
		if _, err := repo.UpdateCatalogEntry(ctx, "tower", models.CatalogUpdate{GitHubRepo: models.Patch[string]{Set: true, Value: &own}}); err != nil {
			panic(err)
		}
		issues := []models.Issue{
			{Repo: "me/tower-issues", Number: 1, Title: "crash", State: "open", Kind: "crash", CreatedAt: now, UpdatedAt: now},
			{Repo: "me/shared", Number: 1, Title: "other", State: "open", Kind: "bug", ModLabel: "ghost", CreatedAt: now, UpdatedAt: now},
		}
		if err := repo.SaveIssues(ctx, id, []string{"me/shared", own}, []string{"me/shared", own}, issues); err != nil {
			panic(err)
		}
	})
	var out struct {
		Repo   string   `json:"repo"`
		Repos  []string `json:"repos"`
		Issues []struct {
			Repo    string  `json:"repo"`
			Number  int     `json:"number"`
			ModSlug *string `json:"modSlug"`
		} `json:"issues"`
	}
	if err := json.Unmarshal(get(t, h, "/api/v1/issues").Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Repo != "me/shared" || len(out.Repos) != 2 || out.Repos[0] != "me/shared" || out.Repos[1] != "me/tower-issues" {
		t.Errorf("repo %q repos %v", out.Repo, out.Repos)
	}
	for _, is := range out.Issues {
		switch is.Repo {
		case "me/tower-issues":
			if is.ModSlug == nil || *is.ModSlug != "tower" {
				t.Errorf("an issue in the mod's own repo must belong to it: %+v", is)
			}
		case "me/shared":
			if is.ModSlug != nil {
				t.Errorf("a ghost label links to nothing: %+v", is)
			}
		}
	}
	// The mod page shows its crash, and the overview raises it.
	var o overviewBody
	_ = json.Unmarshal(get(t, h, "/api/v1/overview").Body.Bytes(), &o)
	if len(o.Attention) == 0 || o.Attention[0].Kind != "crash_open" || o.Attention[0].Dismissible {
		t.Errorf("attention = %+v, want a crash that can't be dismissed", o.Attention)
	}
}
