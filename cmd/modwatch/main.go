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
	"github.com/fireball1725/modwatch/internal/repository"
	"github.com/fireball1725/modwatch/internal/settings"
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

	conn, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database", "error", err)
		os.Exit(1)
	}
	slog.Info("database", "engine", db.Of(conn).String())
	defer func() { _ = conn.Close() }()
	repo := repository.New(conn)

	// The clients are built at the start of each poll from the environment plus whatever was set in Settings.
	polls := poll.New(ctx, cfg, repo, nil, nil).WithSettings(settings.New(cfg, repo), poll.DefaultFactory{})

	// Poll at boot so the page is current; the stored data shows until it finishes.
	if err := polls.Start(); err != nil {
		slog.Warn("no poll at startup", "reason", err.Error())
	}

	// cron uses the process time zone, so TZ decides when "0 * * * *" fires.
	sched := cron.New()
	// Always scheduled: a key set in Settings later makes the next scheduled poll work.
	if _, err := sched.AddFunc(cfg.Schedule, func() {
		err := polls.Start()
		switch {
		case err == nil, errors.Is(err, poll.ErrRunning):
		case errors.Is(err, poll.ErrNotConfigured):
			slog.Debug("scheduled poll skipped", "reason", err.Error())
		default:
			slog.Error("scheduled poll", "error", err)
		}
	}); err != nil {
		slog.Error("poll schedule not started", "schedule", cfg.Schedule, "error", err)
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
