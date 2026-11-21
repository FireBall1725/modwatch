// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package config

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// The settings the author can change in the UI. Each also has an environment variable; a value set in the UI wins.
const (
	KeyCurseForgeAPIKey   = "curseforgeApiKey"
	KeyCurseForgeAuthorID = "curseforgeAuthorId"
	KeyModrinthUser       = "modrinthUser"
	KeyModrinthToken      = "modrinthToken"
	KeyGitHubToken        = "githubToken"
	KeyGitHubIssuesRepo   = "githubIssuesRepo"
	KeyMetricsEnabled     = "metricsEnabled" // "true" or "false"; unset means on
)

// Setting describes one UI-editable value.
type Setting struct {
	Key    string
	Env    string // the environment variable that sets the same thing
	Secret bool   // never sent back to the browser
}

// Settings lists them in the order the UI shows them.
var Settings = []Setting{
	{KeyCurseForgeAPIKey, "CURSEFORGE_API_KEY", true},
	{KeyCurseForgeAuthorID, "CURSEFORGE_AUTHOR_ID", false},
	{KeyModrinthUser, "MODRINTH_USER", false},
	{KeyModrinthToken, "MODRINTH_TOKEN", true},
	{KeyGitHubToken, "GITHUB_TOKEN", true},
	{KeyGitHubIssuesRepo, "GITHUB_ISSUES_REPO", false},
	{KeyMetricsEnabled, "MODWATCH_METRICS_ENABLED", false},
}

// SettingFor returns the description of a key.
func SettingFor(key string) (Setting, bool) {
	for _, s := range Settings {
		if s.Key == key {
			return s, true
		}
	}
	return Setting{}, false
}

// Value is the current value of a setting as text, "" when unset.
func (c *Config) Value(key string) string {
	switch key {
	case KeyCurseForgeAPIKey:
		return c.CurseForgeKey
	case KeyCurseForgeAuthorID:
		if c.CurseForgeAuthorID > 0 {
			return strconv.Itoa(c.CurseForgeAuthorID)
		}
	case KeyModrinthUser:
		return c.ModrinthUser
	case KeyModrinthToken:
		return c.ModrinthToken
	case KeyGitHubToken:
		return c.GitHubToken
	case KeyGitHubIssuesRepo:
		return c.GitHubIssuesRepo
	case KeyMetricsEnabled:
		if c.MetricsEnabled != nil {
			return strconv.FormatBool(*c.MetricsEnabled)
		}
	}
	return ""
}

// With returns a copy with the given UI values applied over this one. An empty or unknown value changes nothing.
// Values were checked when they were saved, so a bad one left in the database is skipped rather than fatal.
func (c *Config) With(values map[string]string) *Config {
	out := *c
	for key, v := range values {
		v = strings.TrimSpace(v)
		if v == "" || ValidateSetting(key, v) != nil {
			continue
		}
		switch key {
		case KeyCurseForgeAPIKey:
			out.CurseForgeKey = v
		case KeyCurseForgeAuthorID:
			out.CurseForgeAuthorID, _ = strconv.Atoi(v)
		case KeyModrinthUser:
			out.ModrinthUser = v
		case KeyModrinthToken:
			out.ModrinthToken = v
		case KeyGitHubToken:
			out.GitHubToken = v
		case KeyGitHubIssuesRepo:
			out.GitHubIssuesRepo = v
		case KeyMetricsEnabled:
			on := v == "true"
			out.MetricsEnabled = &on
		}
	}
	return &out
}

// MaxSettingLen bounds a setting's length; real keys are under a hundred characters.
const MaxSettingLen = 512

// ValidateSetting checks a trimmed, non-empty value. The error text is safe to show the author.
func ValidateSetting(key, v string) error {
	if _, ok := SettingFor(key); !ok {
		return fmt.Errorf("unknown setting %q", key)
	}
	if len(v) > MaxSettingLen {
		return fmt.Errorf("%s can't be longer than %d characters", key, MaxSettingLen)
	}
	for _, r := range v {
		if unicode.IsControl(r) || unicode.IsSpace(r) {
			return fmt.Errorf("%s can't contain spaces or control characters", key)
		}
	}
	switch key {
	case KeyCurseForgeAuthorID:
		if n, err := strconv.Atoi(v); err != nil || n <= 0 {
			return fmt.Errorf("%s must be a positive number", key)
		}
	case KeyGitHubIssuesRepo:
		if !ValidRepo(v) {
			return fmt.Errorf("%s must look like owner/name", key)
		}
	case KeyMetricsEnabled:
		if v != "true" && v != "false" {
			return fmt.Errorf("%s must be true or false", key)
		}
	}
	return nil
}
