// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package config

import "testing"

func TestValidRepo(t *testing.T) {
	for in, want := range map[string]bool{
		"FireBall1725/mod-issues": true, "a/b.c_d": true,
		"": false, "nope": false, "a/b/c": false, "a/": false, "/b": false, "a b/c": false,
	} {
		if got := ValidRepo(in); got != want {
			t.Errorf("ValidRepo(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestBadIssuesRepoIsAProblemAndTurnsIssuesOff(t *testing.T) {
	c := &Config{Schedule: "0 * * * *", GitHubIssuesRepo: "nope"}
	if c.CanPollGitHub() {
		t.Error("an invalid repo must not poll")
	}
	found := false
	for _, p := range c.Problems() {
		if contains(p.Error(), "GITHUB_ISSUES_REPO") {
			found = true
		}
	}
	if !found {
		t.Error("expected a GITHUB_ISSUES_REPO problem")
	}
	if (&Config{}).CanPollGitHub() {
		t.Error("empty repo must be off")
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

func TestMissingModrinthTokenIsAProblem(t *testing.T) {
	has := func(c *Config) bool {
		for _, p := range c.Problems() {
			if p.Error() == "MODRINTH_TOKEN is not set, so Modrinth drafts and projects in review are hidden" {
				return true
			}
		}
		return false
	}
	if !has(&Config{Schedule: "0 * * * *", ModrinthUser: "someone"}) {
		t.Error("expected a MODRINTH_TOKEN problem")
	}
	if has(&Config{Schedule: "0 * * * *", ModrinthUser: "someone", ModrinthToken: "x"}) {
		t.Error("a token is set, so no problem")
	}
	if has(&Config{Schedule: "0 * * * *"}) {
		t.Error("Modrinth is off, so no problem")
	}
}
