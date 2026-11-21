// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/poll"
	"github.com/fireball1725/modwatch/internal/repository"
	"github.com/fireball1725/modwatch/internal/version"
)

type handlers struct {
	cfg   *config.Config
	repo  *repository.Repo
	polls *poll.Service
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("writing response", "error", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (h *handlers) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": version.String()})
}

// totals adds up download counts and their movement over the mods that pass keep.
type totals struct {
	Mods      int    `json:"mods"`
	Downloads int64  `json:"downloads"`
	Delta24h  *int64 `json:"delta24h"`
	Delta7d   *int64 `json:"delta7d"`
}

func tally(stats []models.ModStat, keep func(models.ModStat) bool) totals {
	var t totals
	var d1, d7 int64
	var have1, have7 bool
	for _, s := range stats {
		if !keep(s) {
			continue
		}
		t.Mods++
		t.Downloads += s.Downloads
		if s.Delta24h != nil {
			d1, have1 = d1+*s.Delta24h, true
		}
		if s.Delta7d != nil {
			d7, have7 = d7+*s.Delta7d, true
		}
	}
	if have1 {
		t.Delta24h = &d1
	}
	if have7 {
		t.Delta7d = &d7
	}
	return t
}

type summaryResponse struct {
	Version  string       `json:"version"`
	Schedule string       `json:"schedule"`
	Polling  bool         `json:"polling"`
	Problems []string     `json:"problems"`
	Owned    totals       `json:"owned"`
	All      totals       `json:"all"`
	LastPoll *models.Poll `json:"lastPoll"`
	LastOK   *models.Poll `json:"lastOkPoll"`
	// Sources says whether each download source (CurseForge, Modrinth) worked last time.
	Sources []models.SourceStatus `json:"sources"`
}

func (h *handlers) summary(w http.ResponseWriter, r *http.Request) {
	stats, err := h.repo.ListModStats(r.Context(), time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read mods")
		return
	}
	last, err := h.repo.LatestPoll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read polls")
		return
	}
	lastOK, err := h.repo.LatestOKPoll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read polls")
		return
	}
	sources, err := h.repo.ListSourceStatuses(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read sources")
		return
	}
	problems := []string{}
	for _, p := range h.cfg.Problems() {
		problems = append(problems, p.Error())
	}
	writeJSON(w, http.StatusOK, summaryResponse{
		Version:  version.String(),
		Schedule: h.cfg.Schedule,
		Polling:  h.polls.Running(),
		Problems: problems,
		Owned:    tally(stats, func(s models.ModStat) bool { return s.Owned }),
		All:      tally(stats, func(models.ModStat) bool { return true }),
		LastPoll: last,
		LastOK:   lastOK,
		Sources:  sources,
	})
}

func (h *handlers) listMods(w http.ResponseWriter, r *http.Request) {
	stats, err := h.repo.ListModStats(r.Context(), time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read mods")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// history returns one point per day for every mod, keyed by mod id, so the table can draw its sparklines in one call.
func (h *handlers) history(w http.ResponseWriter, r *http.Request) {
	days := 30
	if v := r.URL.Query().Get("days"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 3650 {
			writeError(w, http.StatusBadRequest, "days must be between 1 and 3650")
			return
		}
		days = n
	}
	hist, err := h.repo.History(r.Context(), time.Now().AddDate(0, 0, -days))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read history")
		return
	}
	out := make(map[string][]models.Snapshot, len(hist))
	for id, snaps := range hist {
		out[strconv.Itoa(id)] = snaps
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *handlers) startPoll(w http.ResponseWriter, _ *http.Request) {
	err := h.polls.Start()
	switch {
	case errors.Is(err, poll.ErrNotConfigured):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, poll.ErrRunning):
		writeError(w, http.StatusConflict, err.Error())
	case err != nil:
		writeError(w, http.StatusInternalServerError, "couldn't start a poll")
	default:
		writeJSON(w, http.StatusAccepted, map[string]string{"status": "started"})
	}
}

func (h *handlers) listFiles(w http.ResponseWriter, r *http.Request) {
	files, err := h.repo.ListFileStats(r.Context(), time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read files")
		return
	}
	writeJSON(w, http.StatusOK, files)
}

type versionsResponse struct {
	GameVersions []models.VersionTotal `json:"gameVersions"`
	Loaders      []models.VersionTotal `json:"loaders"`
}

// versions answers "which Minecraft versions and loaders are people downloading for".
func (h *handlers) versions(w http.ResponseWriter, r *http.Request) {
	files, err := h.repo.ListFileStats(r.Context(), time.Now())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read files")
		return
	}
	writeJSON(w, http.StatusOK, versionsResponse{
		GameVersions: totalsBy(files, gameVersionsOf),
		Loaders:      totalsBy(files, loadersOf),
	})
}
