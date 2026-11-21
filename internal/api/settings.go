// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/fireball1725/modwatch/internal/settings"
)

type settingsResponse struct {
	Items []settings.Item `json:"items"`
}

func (h *handlers) getSettings(w http.ResponseWriter, r *http.Request) {
	items, err := h.store.Items(r.Context())
	if err != nil {
		slog.Error("reading settings", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't read the settings")
		return
	}
	writeJSON(w, http.StatusOK, settingsResponse{Items: items})
}

// putSettings applies a partial change: a string sets a value, null or "" clears the one set here.
func (h *handlers) putSettings(w http.ResponseWriter, r *http.Request) {
	var body map[string]*string
	dec := json.NewDecoder(io.LimitReader(r.Body, 64<<10))
	if err := dec.Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "the body must be a JSON object of setting names and text values or null")
		return
	}
	if err := h.store.Update(r.Context(), body); err != nil {
		var bad *settings.InvalidError
		if errors.As(err, &bad) {
			writeError(w, http.StatusBadRequest, bad.Msg)
			return
		}
		slog.Error("saving settings", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't save the settings")
		return
	}
	h.getSettings(w, r)
}

type attentionRef struct {
	Kind    string `json:"kind"`
	ModSlug string `json:"modSlug"`
}

// readRef decodes a dismiss or restore body and checks it.
func readRef(w http.ResponseWriter, r *http.Request) (attentionRef, bool) {
	var ref attentionRef
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&ref); err != nil {
		writeError(w, http.StatusBadRequest, `the body must be {"kind": ..., "modSlug": ...}`)
		return ref, false
	}
	ref.ModSlug = strings.TrimSpace(ref.ModSlug)
	if ref.ModSlug == "" {
		writeError(w, http.StatusBadRequest, "modSlug is required")
		return ref, false
	}
	if !dismissible(ref.Kind) {
		writeError(w, http.StatusBadRequest, "that kind of item can't be dismissed")
		return ref, false
	}
	return ref, true
}

func (h *handlers) dismissAttention(w http.ResponseWriter, r *http.Request) {
	ref, ok := readRef(w, r)
	if !ok {
		return
	}
	if err := h.repo.Dismiss(r.Context(), ref.Kind, ref.ModSlug, h.now()); err != nil {
		slog.Error("dismissing", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't save that")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handlers) restoreAttention(w http.ResponseWriter, r *http.Request) {
	ref, ok := readRef(w, r)
	if !ok {
		return
	}
	if err := h.repo.Restore(r.Context(), ref.Kind, ref.ModSlug); err != nil {
		slog.Error("restoring", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't save that")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
