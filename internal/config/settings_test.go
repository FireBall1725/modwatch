// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package config

import "testing"

func TestWithAppliesUIValuesOverTheEnvironment(t *testing.T) {
	base := &Config{CurseForgeKey: "env-key", CurseForgeAuthorID: 1, ModrinthUser: "env-user"}
	got := base.With(map[string]string{
		KeyCurseForgeAPIKey:   "ui-key",
		KeyCurseForgeAuthorID: "42",
		KeyGitHubIssuesRepo:   "me/issues",
		KeyModrinthUser:       "   ", // blank: the environment's stays
	})
	if got.CurseForgeKey != "ui-key" || got.CurseForgeAuthorID != 42 || got.GitHubIssuesRepo != "me/issues" || got.ModrinthUser != "env-user" {
		t.Errorf("got %+v", got)
	}
	if base.CurseForgeKey != "env-key" {
		t.Error("With must not change the base configuration")
	}
}

func TestWithSkipsABadStoredValue(t *testing.T) {
	got := (&Config{CurseForgeAuthorID: 7}).With(map[string]string{KeyCurseForgeAuthorID: "abc", KeyGitHubIssuesRepo: "no-slash"})
	if got.CurseForgeAuthorID != 7 || got.GitHubIssuesRepo != "" {
		t.Errorf("got %+v", got)
	}
}

func TestValidateSetting(t *testing.T) {
	bad := map[string]string{
		KeyCurseForgeAuthorID: "0",
		KeyGitHubIssuesRepo:   "owner",
		KeyModrinthToken:      "has space",
		KeyGitHubToken:        "tab\there",
		"nope":                "x",
	}
	for k, v := range bad {
		if ValidateSetting(k, v) == nil {
			t.Errorf("%s=%q must be rejected", k, v)
		}
	}
	good := map[string]string{KeyCurseForgeAuthorID: "8109937", KeyGitHubIssuesRepo: "FireBall1725/mod-issues", KeyModrinthUser: "FireBall1725"}
	for k, v := range good {
		if err := ValidateSetting(k, v); err != nil {
			t.Errorf("%s=%q: %v", k, v, err)
		}
	}
}

func TestValueRoundTrips(t *testing.T) {
	c := (&Config{}).With(map[string]string{KeyCurseForgeAuthorID: "5", KeyModrinthToken: "tok"})
	if c.Value(KeyCurseForgeAuthorID) != "5" || c.Value(KeyModrinthToken) != "tok" || c.Value(KeyGitHubToken) != "" {
		t.Errorf("values = %q %q %q", c.Value(KeyCurseForgeAuthorID), c.Value(KeyModrinthToken), c.Value(KeyGitHubToken))
	}
}

func TestMetricsAreOnUnlessTurnedOff(t *testing.T) {
	if !(&Config{}).MetricsOn() {
		t.Error("metrics must default to on")
	}
	off := (&Config{}).With(map[string]string{KeyMetricsEnabled: "false"})
	if off.MetricsOn() || off.Value(KeyMetricsEnabled) != "false" {
		t.Errorf("off = %v %q", off.MetricsOn(), off.Value(KeyMetricsEnabled))
	}
	if !off.With(map[string]string{KeyMetricsEnabled: "true"}).MetricsOn() {
		t.Error("true must turn them back on")
	}
	if ValidateSetting(KeyMetricsEnabled, "maybe") == nil {
		t.Error("only true or false is valid")
	}
}

func TestMetricsEnvVar(t *testing.T) {
	t.Setenv("MODWATCH_METRICS_ENABLED", "off")
	if Load().MetricsOn() {
		t.Error("MODWATCH_METRICS_ENABLED=off must turn them off")
	}
	t.Setenv("MODWATCH_METRICS_ENABLED", "garbage")
	if !Load().MetricsOn() {
		t.Error("an unreadable value means not chosen, which is on")
	}
}
