// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

func TestRevenueIsKeptPerPlatformAndReplacedEachTime(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	if got, err := r.Revenue(ctx); err != nil || got == nil || len(got) != 0 {
		t.Fatalf("empty = %v, %v; want an empty non-nil list", got, err)
	}
	at := time.Date(2026, 11, 21, 18, 0, 0, 0, time.UTC)
	first := models.Revenue{Platform: "modrinth", Currency: "USD", Available: 0.3, Pending: 0.09, WithdrawnYTD: 1.5, WithdrawnLifetime: 4, FetchedAt: at,
		Months: []models.RevenueMonth{{Month: "2026-11", Amount: 0.05}, {Month: "2026-10", Amount: 0.02}}}
	if err := r.SaveRevenue(ctx, first); err != nil {
		t.Fatal(err)
	}
	first.Available = 0.4
	first.FetchedAt = at.Add(time.Hour)
	if err := r.SaveRevenue(ctx, first); err != nil {
		t.Fatal(err)
	}
	got, err := r.Revenue(ctx)
	if err != nil || len(got) != 1 {
		t.Fatalf("got %v, %v; want one row", got, err)
	}
	g := got[0]
	if g.Available != 0.4 || g.Pending != 0.09 || g.WithdrawnYTD != 1.5 || g.WithdrawnLifetime != 4 || g.Currency != "USD" {
		t.Errorf("balance = %+v", g)
	}
	if !g.FetchedAt.Equal(at.Add(time.Hour)) {
		t.Errorf("fetchedAt = %v", g.FetchedAt)
	}
	if len(g.Months) != 2 || g.Months[0].Month != "2026-10" {
		t.Errorf("months should come back oldest first: %+v", g.Months)
	}
}
