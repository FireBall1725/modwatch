// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package config reads runtime settings from the environment.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/fireball1725/modwatch/internal/version"
	"github.com/robfig/cron/v3"
)

// Config holds everything Modwatch needs to know about whose mods it tracks.
// Nothing here defaults to a particular author, so anyone can point it at their own account.
type Config struct {
	Addr     string
	LogLevel slog.Level
	DataDir  string

	// Schedule is a five-field cron expression in the process time zone (TZ).
	Schedule string

	// CurseForgeKey is a Core API key from console.curseforge.com, sent as x-api-key.
	// The older "API Tokens" page issues upload tokens, which this API rejects with a 403.
	CurseForgeKey      string
	CurseForgeAuthorID int
	CurseForgeBaseURL  string
	CurseForgeGameID   int

	// ModrinthUser is a Modrinth username or id. Empty turns Modrinth off.
	// The token is optional; public projects need none, and it only matters for drafts and private projects.
	ModrinthUser      string
	ModrinthToken     string
	ModrinthBaseURL   string
	ModrinthUserAgent string

	// GitHubIssuesRepo is "owner/name" of the public repo that holds the mods' issues. Empty turns issues off.
	// The token is optional; without one GitHub allows 60 requests an hour, which hourly polling stays under.
	GitHubIssuesRepo string
	GitHubToken      string
	GitHubBaseURL    string
}

// Load reads the environment and fills in defaults.
func Load() *Config {
	return &Config{
		Addr:               getEnv("MODWATCH_ADDR", ":8080"),
		LogLevel:           parseLogLevel(getEnv("LOG_LEVEL", "info")),
		DataDir:            getEnv("MODWATCH_DATA_DIR", "./data"),
		Schedule:           getEnv("MODWATCH_SCHEDULE", "0 * * * *"),
		CurseForgeKey:      getEnv("CURSEFORGE_API_KEY", ""),
		CurseForgeAuthorID: getEnvInt("CURSEFORGE_AUTHOR_ID", 0),
		CurseForgeBaseURL:  strings.TrimRight(getEnv("CURSEFORGE_BASE_URL", "https://api.curseforge.com"), "/"),
		CurseForgeGameID:   getEnvInt("CURSEFORGE_GAME_ID", 432), // 432 is Minecraft
		ModrinthUser:       getEnv("MODRINTH_USER", ""),
		ModrinthToken:      getEnv("MODRINTH_TOKEN", ""),
		ModrinthBaseURL:    strings.TrimRight(getEnv("MODRINTH_BASE_URL", "https://api.modrinth.com"), "/"),
		// Modrinth asks for a descriptive agent; this names the software and nothing about who runs it.
		ModrinthUserAgent: getEnv("MODRINTH_USER_AGENT", "modwatch/"+version.String()),
		GitHubIssuesRepo:  getEnv("GITHUB_ISSUES_REPO", ""),
		GitHubToken:       getEnv("GITHUB_TOKEN", ""),
		GitHubBaseURL:     strings.TrimRight(getEnv("GITHUB_BASE_URL", "https://api.github.com"), "/"),
	}
}

// Problems lists settings that stop a feature from working, without stopping the server.
func (c *Config) Problems() []error {
	var errs []error
	if c.CurseForgeKey == "" {
		errs = append(errs, errors.New("CURSEFORGE_API_KEY is not set, so downloads can't be fetched"))
	}
	if c.CurseForgeAuthorID <= 0 {
		errs = append(errs, errors.New("CURSEFORGE_AUTHOR_ID is not set, so there is no author to look up"))
	}
	if _, err := cron.ParseStandard(c.Schedule); err != nil {
		errs = append(errs, fmt.Errorf("MODWATCH_SCHEDULE %q isn't a valid cron expression, so polls only run on demand: %w", c.Schedule, err))
	}
	if c.GitHubIssuesRepo != "" && !ValidRepo(c.GitHubIssuesRepo) {
		errs = append(errs, fmt.Errorf("GITHUB_ISSUES_REPO %q isn't in owner/name form, so issues are off", c.GitHubIssuesRepo))
	}
	if c.ModrinthUser != "" && c.ModrinthToken == "" {
		errs = append(errs, errors.New("MODRINTH_TOKEN is not set, so Modrinth drafts and projects in review are hidden"))
	}
	return errs
}

var repoPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

// ValidRepo reports whether s looks like owner/name.
func ValidRepo(s string) bool { return repoPattern.MatchString(s) }

// CanPollGitHub reports whether a valid issues repo is configured.
func (c *Config) CanPollGitHub() bool {
	return ValidRepo(c.GitHubIssuesRepo)
}

// CanPoll reports whether the CurseForge settings are complete enough to fetch anything.
func (c *Config) CanPoll() bool {
	return c.CurseForgeKey != "" && c.CurseForgeAuthorID > 0
}

// CanPollModrinth reports whether a Modrinth user is configured.
func (c *Config) CanPollModrinth() bool {
	return c.ModrinthUser != ""
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func parseLogLevel(s string) slog.Level {
	var l slog.Level
	if err := l.UnmarshalText([]byte(s)); err != nil {
		return slog.LevelInfo
	}
	return l
}
