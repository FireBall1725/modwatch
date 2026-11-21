// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"encoding/json"
	"sort"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

// SaveRevenue replaces the stored balance of the platform with the one just read.
func (r *Repo) SaveRevenue(ctx context.Context, rev models.Revenue) error {
	months, err := json.Marshal(rev.Months)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO revenue (platform, currency, available, pending, withdrawn_lifetime, withdrawn_ytd, months, fetched_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (platform) DO UPDATE SET
			currency = excluded.currency, available = excluded.available, pending = excluded.pending,
			withdrawn_lifetime = excluded.withdrawn_lifetime, withdrawn_ytd = excluded.withdrawn_ytd,
			months = excluded.months, fetched_at = excluded.fetched_at`,
		rev.Platform, rev.Currency, rev.Available, rev.Pending, rev.WithdrawnLifetime, rev.WithdrawnYTD, string(months), tz(rev.FetchedAt))
	return err
}

// Revenue returns the stored balance of each platform that has one, by platform name.
func (r *Repo) Revenue(ctx context.Context) ([]models.Revenue, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT platform, currency, available, pending, withdrawn_lifetime, withdrawn_ytd, months, fetched_at FROM revenue ORDER BY platform`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []models.Revenue{}
	for rows.Next() {
		var rev models.Revenue
		var months string
		var at time.Time
		if err := rows.Scan(&rev.Platform, &rev.Currency, &rev.Available, &rev.Pending, &rev.WithdrawnLifetime, &rev.WithdrawnYTD, &months, &at); err != nil {
			return nil, err
		}
		rev.FetchedAt = at.UTC()
		if err := json.Unmarshal([]byte(months), &rev.Months); err != nil {
			rev.Months = nil
		}
		sort.Slice(rev.Months, func(i, j int) bool { return rev.Months[i].Month < rev.Months[j].Month })
		out = append(out, rev)
	}
	return out, rows.Err()
}
