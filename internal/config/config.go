// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package config reads runtime settings from the environment.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"

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
	return errs
}

// CanPoll reports whether the CurseForge settings are complete enough to fetch anything.
func (c *Config) CanPoll() bool {
	return c.CurseForgeKey != "" && c.CurseForgeAuthorID > 0
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
