// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

func savePlatformProject(ctx context.Context, tx *sql.Tx, pollID int64, at time.Time, pr models.PlatformReading) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO platform_projects (platform, id, slug, name, summary, icon_url, url, raw_status, status, status_message,
		                               requested_status, queued_at, followers, owned, published_at, updated_at,
		                               source_url, issues_url, wiki_url, discord_url, last_poll_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
		ON CONFLICT (platform, id) DO UPDATE SET
			slug = excluded.slug, name = excluded.name, summary = excluded.summary, icon_url = excluded.icon_url,
			url = excluded.url, raw_status = excluded.raw_status, status = excluded.status,
			status_message = excluded.status_message, requested_status = excluded.requested_status,
			queued_at = excluded.queued_at, followers = excluded.followers, owned = excluded.owned,
			published_at = excluded.published_at, updated_at = excluded.updated_at, source_url = excluded.source_url,
			issues_url = excluded.issues_url, wiki_url = excluded.wiki_url, discord_url = excluded.discord_url,
			last_poll_id = excluded.last_poll_id`,
		pr.Platform, pr.ID, pr.Slug, pr.Name, pr.Summary, pr.IconURL, pr.URL, pr.RawStatus, string(pr.Status),
		pr.StatusMessage, pr.RequestedStatus, tz(pr.QueuedAt), pr.Followers, pr.Owned,
		tz(pr.PublishedAt), tz(pr.UpdatedAt), pr.SourceURL, pr.IssuesURL, pr.WikiURL, pr.DiscordURL, pollID); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `
		INSERT INTO platform_snapshots (platform, project_id, poll_id, taken_at, download_count) VALUES ($1, $2, $3, $4, $5)`,
		pr.Platform, pr.ID, pollID, tz(at), pr.Downloads)
	return err
}

// ListPlatformStats returns every project the latest refresh of each platform saw, biggest first, with day and week
// movement. Per platform rather than per poll: if Modrinth couldn't be read this time, its projects keep their last
// state instead of vanishing.
func (r *Repo) ListPlatformStats(ctx context.Context, now time.Time) ([]models.PlatformStat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT p.platform, p.id, p.slug, p.name, p.summary, p.icon_url, p.url, p.raw_status, p.status, p.status_message,
		       p.requested_status, p.queued_at, p.followers, p.owned, p.published_at, p.updated_at,
		       p.source_url, p.issues_url, p.wiki_url, p.discord_url, s.download_count,
		       (SELECT o.download_count FROM platform_snapshots o
		         WHERE o.platform = p.platform AND o.project_id = p.id AND o.taken_at <= $1 ORDER BY o.taken_at DESC LIMIT 1),
		       (SELECT o.download_count FROM platform_snapshots o
		         WHERE o.platform = p.platform AND o.project_id = p.id AND o.taken_at <= $2 ORDER BY o.taken_at DESC LIMIT 1)
		FROM platform_projects p
		JOIN platform_snapshots s ON s.platform = p.platform AND s.project_id = p.id AND s.poll_id = p.last_poll_id
		WHERE p.last_poll_id = (SELECT MAX(x.last_poll_id) FROM platform_projects x WHERE x.platform = p.platform)
		ORDER BY s.download_count DESC, p.name, p.platform`,
		tz(now.Add(-24*time.Hour)), tz(now.Add(-7*24*time.Hour)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	out := []models.PlatformStat{}
	for rows.Next() {
		var s models.PlatformStat
		var status string
		var queued, published, updated sql.NullTime
		var d1, d7 sql.NullInt64
		if err := rows.Scan(&s.Platform, &s.ID, &s.Slug, &s.Name, &s.Summary, &s.IconURL, &s.URL, &s.RawStatus, &status,
			&s.StatusMessage, &s.RequestedStatus, &queued, &s.Followers, &s.Owned, &published, &updated,
			&s.SourceURL, &s.IssuesURL, &s.WikiURL, &s.DiscordURL, &s.Downloads, &d1, &d7); err != nil {
			return nil, err
		}
		s.Status = models.ReviewStatus(status)
		s.QueuedAt, s.PublishedAt, s.UpdatedAt = fromNull(queued), fromNull(published), fromNull(updated)
		if d1.Valid {
			v := s.Downloads - d1.Int64
			s.Delta24h = &v
		}
		if d7.Valid {
			v := s.Downloads - d7.Int64
			s.Delta7d = &v
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// PlatformHistory returns the last snapshot of each UTC day since the given time, oldest first, for every project.
func (r *Repo) PlatformHistory(ctx context.Context, since time.Time) (map[models.PlatformKey][]models.Snapshot, error) {
	rows, err := r.db.QueryContext(ctx, r.dailyLast("platform, project_id", "platform_snapshots"), tz(since))
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
