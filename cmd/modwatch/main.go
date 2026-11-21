// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Command modwatch serves the mod dashboard's API, Prometheus metrics and web UI from one binary.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	// Embeds the zone database so TZ works in a minimal image with no /usr/share/zoneinfo.
	_ "time/tzdata"

	"github.com/fireball1725/modwatch/internal/api"
	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/db"
	"github.com/fireball1725/modwatch/internal/poll"
	"github.com/fireball1725/modwatch/internal/providers/curseforge"
	"github.com/fireball1725/modwatch/internal/providers/github"
	"github.com/fireball1725/modwatch/internal/providers/modrinth"
	"github.com/fireball1725/modwatch/internal/repository"
	"github.com/fireball1725/modwatch/internal/version"
	"github.com/robfig/cron/v3"
)

func main() {
	cfg := config.Load()
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel})))

	slog.Info("modwatch starting", "version", version.String(), "author", cfg.CurseForgeAuthorID, "schedule", cfg.Schedule)
	for _, p := range cfg.Problems() {
		slog.Warn("config", "problem", p.Error())
	}

	ctx, stop := context.WithCancel(context.Background())
	defer stop()

	if cfg.DatabaseURL == "" {
		slog.Error("database", "error", "DATABASE_URL is not set")
		os.Exit(1)
	}
	conn, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database", "error", err)
		os.Exit(1)
	}
	defer func() { _ = conn.Close() }()
	repo := repository.New(conn)

	cf := curseforge.New(cfg.CurseForgeBaseURL, cfg.CurseForgeKey, cfg.CurseForgeGameID)
	// Leave mr nil when Modrinth is off; a typed nil inside the interface would look configured.
	var mr poll.Modrinth
	if cfg.CanPollModrinth() {
		mr = modrinth.New(cfg.ModrinthBaseURL, cfg.ModrinthToken, cfg.ModrinthUserAgent)
	}
	polls := poll.New(ctx, cfg, repo, cf, mr)
	if cfg.CanPollGitHub() {
		polls.WithGitHub(github.New(cfg.GitHubBaseURL, cfg.GitHubIssuesRepo, cfg.GitHubToken, "modwatch/"+version.String()))
	}

	// Poll at boot so the page is current; the stored data shows until it finishes.
	if err := polls.Start(); err != nil {
		slog.Warn("no poll at startup", "reason", err.Error())
	}

	// cron uses the process time zone, so TZ decides when "0 * * * *" fires.
	sched := cron.New()
	if cfg.CanPoll() {
		if _, err := sched.AddFunc(cfg.Schedule, func() {
			if err := polls.Start(); err != nil && !errors.Is(err, poll.ErrRunning) {
				slog.Error("scheduled poll", "error", err)
			}
		}); err != nil {
			slog.Error("poll schedule not started", "schedule", cfg.Schedule, "error", err)
		}
	}
	sched.Start()
	defer sched.Stop()

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.NewRouter(cfg, repo, polls),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		slog.Info("listening", "addr", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down")
	stop()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("forced shutdown", "error", err)
	}
	// Let a running poll finish or record its failure before the deferred conn.Close().
	if !polls.Wait(15 * time.Second) {
		slog.Warn("poll still running at shutdown")
	}
}
