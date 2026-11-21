// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package api holds the JSON endpoints the embedded UI calls, and the Prometheus endpoint.
package api

import (
	"net/http"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/poll"
	"github.com/fireball1725/modwatch/internal/repository"
	"github.com/fireball1725/modwatch/internal/ui"
)

// NewRouter wires every route; reading this file gives the whole HTTP surface.
// There's no login: the chart puts this behind an internal-only ingress.
func NewRouter(cfg *config.Config, repo *repository.Repo, polls *poll.Service) http.Handler {
	h := &handlers{cfg: cfg, repo: repo, polls: polls}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", h.health)
	mux.HandleFunc("GET /metrics", h.metrics)
	mux.HandleFunc("GET /api/v1/summary", h.summary)
	mux.HandleFunc("GET /api/v1/mods", h.listMods)
	mux.HandleFunc("GET /api/v1/history", h.history)
	mux.HandleFunc("POST /api/v1/poll", h.startPoll)
	mux.Handle("/api/", http.NotFoundHandler())

	mux.Handle("/", ui.Handler())
	return mux
}
