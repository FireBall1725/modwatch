// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/fireball1725/modwatch/internal/providers/curseforge"
)

type authorRequest struct {
	Link string `json:"link"`
}

// findAuthor takes a CurseForge profile link (or a bare name) and returns the author ID CurseForge gives it.
// It saves nothing: the author confirms the ID before it goes into Settings.
func (h *handlers) findAuthor(w http.ResponseWriter, r *http.Request) {
	var body authorRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, `the body must be {"link": "<your CurseForge profile link>"}`)
		return
	}
	name := curseforge.ParseProfile(body.Link)
	if name == "" {
		writeError(w, http.StatusBadRequest, "paste your profile link, such as https://www.curseforge.com/members/<name>")
		return
	}
	cfg := h.effective(r.Context())
	if cfg.CurseForgeKey == "" {
		writeError(w, http.StatusBadRequest, "set the Core API key first")
		return
	}
	client := curseforge.New(cfg.CurseForgeBaseURL, cfg.CurseForgeKey, cfg.CurseForgeGameID)
	author, err := client.FindAuthor(r.Context(), name)
	if errors.Is(err, curseforge.ErrNoAuthor) {
		writeError(w, http.StatusNotFound, "no mod on CurseForge lists "+name+" as an author. Check the link, or enter the author id yourself.")
		return
	}
	if err != nil {
		slog.Error("looking up author", "error", err)
		writeError(w, http.StatusBadGateway, "CurseForge didn't answer the author lookup. Try again in a minute.")
		return
	}
	writeJSON(w, http.StatusOK, author)
}
