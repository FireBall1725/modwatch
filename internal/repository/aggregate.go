// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

// trackReviews keeps review_seen in step with the projects a poll just read.
// A platform the poll didn't read keeps its rows, so an outage doesn't restart anyone's clock.
func trackReviews(ctx context.Context, tx *sql.Tx, at time.Time, projects []models.PlatformReading) error {
	for _, pr := range projects {
		if pr.Status == models.StatusInReview {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO review_seen (platform, project_id, first_seen_at) VALUES ($1, $2, $3)
				ON CONFLICT DO NOTHING`,
				pr.Platform, pr.ID, tz(at)); err != nil {
				return err
			}
			continue
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM review_seen WHERE platform = $1 AND project_id = $2`, pr.Platform, pr.ID); err != nil {
			return err
		}
	}
	return nil
}

// ReviewSeen returns when each project now in review was first seen there.
func (r *Repo) ReviewSeen(ctx context.Context) (map[models.PlatformKey]time.Time, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT platform, project_id, first_seen_at FROM review_seen`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := map[models.PlatformKey]time.Time{}
	for rows.Next() {
		var k models.PlatformKey
		var at time.Time
		if err := rows.Scan(&k.Platform, &k.ID, &at); err != nil {
			return nil, err
		}
		out[k] = at.UTC()
	}
	return out, rows.Err()
}

// FileHistory returns the last snapshot of each UTC day since the given time, oldest first, for every file.
func (r *Repo) FileHistory(ctx context.Context, since time.Time) (map[models.PlatformKey][]models.Snapshot, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT DISTINCT ON (source, file_id, (taken_at AT TIME ZONE 'UTC')::date) source, file_id, taken_at, download_count
		FROM file_snapshots
		WHERE taken_at >= $1
		ORDER BY source, file_id, (taken_at AT TIME ZONE 'UTC')::date, taken_at DESC`, tz(since))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	out := map[models.PlatformKey][]models.Snapshot{}
	for rows.Next() {
		var k models.PlatformKey
		var at time.Time
		var n int64
		if err := rows.Scan(&k.Platform, &k.ID, &at, &n); err != nil {
			return nil, err
		}
		out[k] = append(out[k], models.Snapshot{At: at.UTC(), Downloads: n})
	}
	return out, rows.Err()
}
