// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/repository"
)

// gitHubLabel is an issue label and how many issues carry it.
type gitHubLabel struct {
	Label  string `json:"label"`
	Issues int    `json:"issues"`
}

type catalogResponse struct {
	Entries  []models.CatalogEntry `json:"entries"`
	Unlinked struct {
		Projects     []models.UnlinkedProject `json:"projects"`
		GitHubLabels []gitHubLabel            `json:"githubLabels"`
	} `json:"unlinked"`
}

func (h *handlers) readCatalog(r *http.Request) (catalogResponse, error) {
	var out catalogResponse
	var err error
	if out.Entries, err = h.repo.ListCatalog(r.Context()); err != nil {
		return out, err
	}
	if out.Unlinked.Projects, err = h.repo.ListUnlinkedProjects(r.Context()); err != nil {
		return out, err
	}
	issues, err := h.repo.ListIssues(r.Context(), "all")
	if err != nil {
		return out, err
	}
	out.Unlinked.GitHubLabels = unlinkedLabels(repository.NewCatalogIndex(out.Entries), issues)
	return out, nil
}

func (h *handlers) getCatalog(w http.ResponseWriter, r *http.Request) {
	out, err := h.readCatalog(r)
	if err != nil {
		slog.Error("reading catalog", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't read the catalog")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// PUT and relink both answer with the whole catalog, because a move can delete another entry.
func (h *handlers) relinkCatalog(w http.ResponseWriter, r *http.Request) {
	if err := h.repo.AutoLink(r.Context()); err != nil {
		slog.Error("relinking catalog", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't relink")
		return
	}
	h.getCatalog(w, r)
}

// patchOf reads a field that may be absent, null or a value of type T.
func patchOf[T any](raw map[string]json.RawMessage, key string) (models.Patch[T], error) {
	var p models.Patch[T]
	b, ok := raw[key]
	if !ok {
		return p, nil
	}
	p.Set = true
	if bytes.Equal(bytes.TrimSpace(b), []byte("null")) {
		return p, nil
	}
	var v T
	if err := json.Unmarshal(b, &v); err != nil {
		return p, errors.New(key + " has the wrong type")
	}
	p.Value = &v
	return p, nil
}

// parseCatalogUpdate decodes a CatalogUpdate body, telling a missing field from null.
func parseCatalogUpdate(body []byte) (models.CatalogUpdate, error) {
	var u models.CatalogUpdate
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil || raw == nil {
		return u, errors.New("body must be a JSON object")
	}
	for k := range raw {
		switch k {
		case "name", "curseforgeId", "modrinthId", "githubLabel", "githubRepo", "versionRegex", "hidden", "legacy":
		default:
			return u, errors.New("unknown field " + k)
		}
	}
	var err error
	if b, ok := raw["name"]; ok {
		if err = json.Unmarshal(b, &u.Name); err != nil || u.Name == nil {
			return u, errors.New("name must be a string")
		}
	}
	if b, ok := raw["hidden"]; ok {
		if err = json.Unmarshal(b, &u.Hidden); err != nil || u.Hidden == nil {
			return u, errors.New("hidden must be true or false")
		}
	}
	if b, ok := raw["legacy"]; ok {
		if err = json.Unmarshal(b, &u.Legacy); err != nil || u.Legacy == nil {
			return u, errors.New("legacy must be true or false")
		}
	}
	if u.CurseForgeID, err = patchOf[int64](raw, "curseforgeId"); err != nil {
		return u, errors.New("curseforgeId must be a number or null")
	}
	if u.ModrinthID, err = patchOf[string](raw, "modrinthId"); err != nil {
		return u, errors.New("modrinthId must be a string or null")
	}
	if u.GitHubLabel, err = patchOf[string](raw, "githubLabel"); err != nil {
		return u, errors.New("githubLabel must be a string or null")
	}
	if u.GitHubRepo, err = patchOf[string](raw, "githubRepo"); err != nil {
		return u, errors.New("githubRepo must be a string or null")
	}
	if u.VersionRegex, err = patchOf[string](raw, "versionRegex"); err != nil {
		return u, errors.New("versionRegex must be a string or null")
	}
	return u, nil
}

func (h *handlers) updateCatalogEntry(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
	var tooBig *http.MaxBytesError
	if errors.As(err, &tooBig) {
		writeError(w, http.StatusRequestEntityTooLarge, "the request body is too large")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, "couldn't read the request body")
		return
	}
	u, err := parseCatalogUpdate(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_, err = h.repo.UpdateCatalogEntry(r.Context(), slug, u)
	var bad *repository.InvalidError
	switch {
	case errors.Is(err, repository.ErrNotFound):
		writeError(w, http.StatusNotFound, "no such catalog entry")
	case errors.As(err, &bad):
		writeError(w, http.StatusBadRequest, bad.Msg)
	case err != nil:
		slog.Error("updating catalog entry", "slug", slug, "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't save the entry")
	default:
		h.getCatalog(w, r)
	}
}
