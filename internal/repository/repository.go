// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package repository holds every SQL statement Modwatch runs.
package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

type Repo struct {
	db *sql.DB
}

func New(db *sql.DB) *Repo { return &Repo{db: db} }

// ts is fixed width and always UTC. RFC3339Nano trims trailing zeros, which breaks sorting times as text.
const ts = "2006-01-02T15:04:05.000Z"

func format(t time.Time) string { return t.UTC().Format(ts) }

func parseTime(s string) time.Time {
	t, _ := time.Parse(ts, s)
	return t
}

// keepFailedPolls is how many failed polls the history keeps; successful ones are the snapshot trail and stay.
const keepFailedPolls = 50

// SavePoll records a successful poll, upserts each mod and stores its download count, in one transaction.
func (r *Repo) SavePoll(ctx context.Context, p models.Poll, readings []models.Reading) (int64, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO polls (started_at, finished_at, state, error, mods) VALUES (?, ?, ?, '', ?)`,
		format(p.StartedAt), format(p.FinishedAt), models.PollOK, len(readings))
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	for _, rd := range readings {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO mods (id, slug, name, summary, logo_url, website_url, owned, date_created, date_modified, last_poll_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (id) DO UPDATE SET
				slug = excluded.slug, name = excluded.name, summary = excluded.summary,
				logo_url = excluded.logo_url, website_url = excluded.website_url, owned = excluded.owned,
				date_created = excluded.date_created, date_modified = excluded.date_modified,
				last_poll_id = excluded.last_poll_id`,
			rd.ID, rd.Slug, rd.Name, rd.Summary, rd.LogoURL, rd.WebsiteURL, rd.Owned,
			format(rd.DateCreated), format(rd.DateModified), id); err != nil {
			return 0, err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO download_snapshots (mod_id, poll_id, taken_at, download_count) VALUES (?, ?, ?, ?)`,
			rd.ID, id, format(p.FinishedAt), rd.Downloads); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return id, nil
}

// SaveFailedPoll records a poll that didn't produce data.
func (r *Repo) SaveFailedPoll(ctx context.Context, p models.Poll) error {
	if _, err := r.db.ExecContext(ctx, `
		INSERT INTO polls (started_at, finished_at, state, error, mods) VALUES (?, ?, ?, ?, 0)`,
		format(p.StartedAt), format(p.FinishedAt), models.PollError, p.Error); err != nil {
		return err
	}
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM polls WHERE state = ? AND id NOT IN (
			SELECT id FROM polls WHERE state = ? ORDER BY id DESC LIMIT ?)`,
		models.PollError, models.PollError, keepFailedPolls)
	return err
}

// LatestPoll returns the most recent poll of any state, or nil if there has been none.
func (r *Repo) LatestPoll(ctx context.Context) (*models.Poll, error) {
	return r.onePoll(ctx, `SELECT id, started_at, finished_at, state, error, mods FROM polls ORDER BY id DESC LIMIT 1`)
}

// LatestOKPoll returns the most recent successful poll, or nil if there has been none.
func (r *Repo) LatestOKPoll(ctx context.Context) (*models.Poll, error) {
	return r.onePoll(ctx, `SELECT id, started_at, finished_at, state, error, mods FROM polls WHERE state = 'ok' ORDER BY id DESC LIMIT 1`)
}

func (r *Repo) onePoll(ctx context.Context, query string) (*models.Poll, error) {
	var p models.Poll
	var started, finished string
	err := r.db.QueryRowContext(ctx, query).Scan(&p.ID, &started, &finished, &p.State, &p.Error, &p.Mods)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.StartedAt, p.FinishedAt = parseTime(started), parseTime(finished)
	return &p, nil
}

// ListModStats returns the mods the latest successful poll saw, biggest first, with how far each moved
// over the last day and week. A delta needs a snapshot at least that old, so a new install reports none.
func (r *Repo) ListModStats(ctx context.Context, now time.Time) ([]models.ModStat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT m.id, m.slug, m.name, m.summary, m.logo_url, m.website_url, m.owned, m.date_created, m.date_modified,
		       s.download_count,
		       (SELECT p.download_count FROM download_snapshots p
		         WHERE p.mod_id = m.id AND p.taken_at <= ? ORDER BY p.taken_at DESC LIMIT 1),
		       (SELECT p.download_count FROM download_snapshots p
		         WHERE p.mod_id = m.id AND p.taken_at <= ? ORDER BY p.taken_at DESC LIMIT 1)
		FROM mods m
		JOIN download_snapshots s ON s.mod_id = m.id AND s.poll_id = m.last_poll_id
		WHERE m.last_poll_id = (SELECT id FROM polls WHERE state = 'ok' ORDER BY id DESC LIMIT 1)
		ORDER BY s.download_count DESC, m.name`,
		format(now.Add(-24*time.Hour)), format(now.Add(-7*24*time.Hour)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	out := []models.ModStat{}
	for rows.Next() {
		var s models.ModStat
		var created, modified string
		var d1, d7 sql.NullInt64
		if err := rows.Scan(&s.ID, &s.Slug, &s.Name, &s.Summary, &s.LogoURL, &s.WebsiteURL, &s.Owned,
			&created, &modified, &s.Downloads, &d1, &d7); err != nil {
			return nil, err
		}
		s.DateCreated, s.DateModified = parseTime(created), parseTime(modified)
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

// History returns the last snapshot of each UTC day since the given time, oldest first, for every mod.
func (r *Repo) History(ctx context.Context, since time.Time) (map[int][]models.Snapshot, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT s.mod_id, s.taken_at, s.download_count
		FROM download_snapshots s
		JOIN (SELECT mod_id, MAX(taken_at) AS last FROM download_snapshots
		      WHERE taken_at >= ? GROUP BY mod_id, substr(taken_at, 1, 10)) d
		  ON d.mod_id = s.mod_id AND d.last = s.taken_at
		ORDER BY s.mod_id, s.taken_at`, format(since))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	out := map[int][]models.Snapshot{}
	for rows.Next() {
		var id int
		var at string
		var n int64
		if err := rows.Scan(&id, &at, &n); err != nil {
			return nil, err
		}
		out[id] = append(out[id], models.Snapshot{At: parseTime(at), Downloads: n})
	}
	return out, rows.Err()
}
