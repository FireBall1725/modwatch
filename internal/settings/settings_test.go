// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package settings

import (
	"context"
	"errors"
	"testing"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/db/dbtest"
	"github.com/fireball1725/modwatch/internal/repository"
)

func newStore(t *testing.T, base *config.Config) *Store {
	t.Helper()
	return New(base, repository.New(dbtest.Open(t)))
}

func item(t *testing.T, items []Item, key string) Item {
	t.Helper()
	for _, it := range items {
		if it.Key == key {
			return it
		}
	}
	t.Fatalf("no item %s", key)
	return Item{}
}

func str(s string) *string { return &s }

func TestItemsReportWhereEachValueComes(t *testing.T) {
	ctx := context.Background()
	s := newStore(t, &config.Config{CurseForgeKey: "env-secret", CurseForgeAuthorID: 9, ModrinthUser: "env-user"})
	if err := s.Update(ctx, map[string]*string{config.KeyModrinthUser: str("ui-user"), config.KeyGitHubToken: str("ghp_x")}); err != nil {
		t.Fatal(err)
	}
	items, err := s.Items(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if it := item(t, items, config.KeyCurseForgeAPIKey); it.Source != SourceEnv || !it.Set || it.Value != nil || !it.EnvSet || !it.Secret {
		t.Errorf("env secret = %+v", it)
	}
	if it := item(t, items, config.KeyCurseForgeAuthorID); it.Source != SourceEnv || it.Value == nil || *it.Value != "9" {
		t.Errorf("env author id = %+v", it)
	}
	if it := item(t, items, config.KeyModrinthUser); it.Source != SourceUI || *it.Value != "ui-user" || !it.EnvSet {
		t.Errorf("ui over env = %+v", it)
	}
	if it := item(t, items, config.KeyGitHubToken); it.Source != SourceUI || it.Value != nil || it.EnvSet || !it.Set {
		t.Errorf("ui secret = %+v", it)
	}
	if it := item(t, items, config.KeyGitHubIssuesRepo); it.Source != SourceNone || it.Set || it.Value != nil {
		t.Errorf("unset = %+v", it)
	}
}

func TestEffectiveUsesTheUIValueAndClearingRestoresTheEnvironment(t *testing.T) {
	ctx := context.Background()
	s := newStore(t, &config.Config{ModrinthUser: "env-user"})
	if err := s.Update(ctx, map[string]*string{config.KeyModrinthUser: str("  ui-user  ")}); err != nil {
		t.Fatal(err)
	}
	if cfg, _ := s.Effective(ctx); cfg.ModrinthUser != "ui-user" {
		t.Errorf("effective user = %q", cfg.ModrinthUser)
	}
	if err := s.Update(ctx, map[string]*string{config.KeyModrinthUser: nil}); err != nil {
		t.Fatal(err)
	}
	if cfg, _ := s.Effective(ctx); cfg.ModrinthUser != "env-user" {
		t.Errorf("after clearing, effective user = %q, want the environment's", cfg.ModrinthUser)
	}
	// An empty string clears too.
	_ = s.Update(ctx, map[string]*string{config.KeyModrinthUser: str("again")})
	_ = s.Update(ctx, map[string]*string{config.KeyModrinthUser: str("")})
	if cfg, _ := s.Effective(ctx); cfg.ModrinthUser != "env-user" {
		t.Errorf("empty string must clear, got %q", cfg.ModrinthUser)
	}
}

func TestUpdateRejectsABadValueAndSavesNothing(t *testing.T) {
	ctx := context.Background()
	s := newStore(t, &config.Config{})
	err := s.Update(ctx, map[string]*string{config.KeyGitHubToken: str("fine"), config.KeyGitHubIssuesRepo: str("not-a-repo")})
	var bad *InvalidError
	if !errors.As(err, &bad) {
		t.Fatalf("err = %v, want InvalidError", err)
	}
	if cfg, _ := s.Effective(ctx); cfg.GitHubToken != "" {
		t.Error("a rejected update must not save the valid keys sent with it")
	}
	if err := s.Update(ctx, map[string]*string{"nope": str("x")}); !errors.As(err, &bad) {
		t.Errorf("unknown key: err = %v", err)
	}
}
