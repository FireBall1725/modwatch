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
				INSERT OR IGNORE INTO review_seen (platform, project_id, first_seen_at) VALUES (?, ?, ?)`,
				pr.Platform, pr.ID, format(at)); err != nil {
				return err
			}
			continue
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM review_seen WHERE platform = ? AND project_id = ?`, pr.Platform, pr.ID); err != nil {
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
		var at string
		if err := rows.Scan(&k.Platform, &k.ID, &at); err != nil {
			return nil, err
		}
		out[k] = parseTime(at)
	}
	return out, rows.Err()
}

// FileHistory returns the last snapshot of each UTC day since the given time, oldest first, for every file.
func (r *Repo) FileHistory(ctx context.Context, since time.Time) (map[models.PlatformKey][]models.Snapshot, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT s.source, s.file_id, s.taken_at, s.download_count
		FROM file_snapshots s
		JOIN (SELECT source, file_id, MAX(taken_at) AS last FROM file_snapshots
		      WHERE taken_at >= ? GROUP BY source, file_id, substr(taken_at, 1, 10)) d
		  ON d.source = s.source AND d.file_id = s.file_id AND d.last = s.taken_at
		ORDER BY s.source, s.file_id, s.taken_at`, format(since))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	out := map[models.PlatformKey][]models.Snapshot{}
	for rows.Next() {
		var k models.PlatformKey
		var at string
		var n int64
		if err := rows.Scan(&k.Platform, &k.ID, &at, &n); err != nil {
			return nil, err
		}
		out[k] = append(out[k], models.Snapshot{At: parseTime(at), Downloads: n})
	}
	return out, rows.Err()
}
