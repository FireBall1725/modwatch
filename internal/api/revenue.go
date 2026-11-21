// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"log/slog"
	"net/http"

	"github.com/fireball1725/modwatch/internal/models"
)

// revenueMonths is how many months the dashboard shows.
const revenueMonths = 12

type revenueItem struct {
	Platform          string                `json:"platform"`
	Currency          string                `json:"currency"`
	Available         float64               `json:"available"`
	Pending           float64               `json:"pending"`
	WithdrawnLifetime float64               `json:"withdrawnLifetime"`
	WithdrawnYTD      float64               `json:"withdrawnYtd"`
	Months            []models.RevenueMonth `json:"months"`
	FetchedAt         string                `json:"fetchedAt"`
}

type revenueResponse struct {
	// Enabled is false when the author turned the balance off in Settings; Items is then empty.
	Enabled bool          `json:"enabled"`
	Items   []revenueItem `json:"items"`
}

// revenue answers what each platform that offers it owes the author. Only Modrinth does: CurseForge's API has no
// balance. Off in Settings, it answers 200 with nothing, so the dashboard can hide the card without an error.
func (h *handlers) revenue(w http.ResponseWriter, r *http.Request) {
	out := revenueResponse{Enabled: h.effective(r.Context()).RevenueOn(), Items: []revenueItem{}}
	if out.Enabled {
		rows, err := h.repo.Revenue(r.Context())
		if err != nil {
			slog.Error("reading revenue", "error", err)
			writeError(w, http.StatusInternalServerError, "couldn't read the revenue")
			return
		}
		for _, rev := range rows {
			months := rev.Months
			if len(months) > revenueMonths {
				months = months[len(months)-revenueMonths:]
			}
			if months == nil {
				months = []models.RevenueMonth{}
			}
			out.Items = append(out.Items, revenueItem{
				Platform: rev.Platform, Currency: rev.Currency, Available: rev.Available, Pending: rev.Pending,
				WithdrawnLifetime: rev.WithdrawnLifetime, WithdrawnYTD: rev.WithdrawnYTD, Months: months, FetchedAt: rfc3339(rev.FetchedAt),
			})
		}
	}
	writeJSON(w, http.StatusOK, out)
}
