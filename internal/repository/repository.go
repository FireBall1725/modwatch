// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package repository holds every SQL statement Modwatch runs.
package repository

import (
	"context"
	"database/sql"
	"encoding/json"
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

// SavePoll records a successful poll, upserts each mod and file and stores their download counts, in one transaction.
// Source statuses go in the same transaction so the dashboard never shows a poll without its verdicts.
func (r *Repo) SavePoll(ctx context.Context, p models.Poll, readings []models.Reading, files []models.FileReading, statuses []models.SourceStatus) (int64, error) {
	return r.SavePollWithProjects(ctx, p, readings, files, nil, statuses)
}

// SavePollWithProjects is SavePoll plus the project-level readings of both platforms, saved in the same transaction.
// A platform with no readings keeps its previous projects, so a failed Modrinth call doesn't blank its review states.
func (r *Repo) SavePollWithProjects(ctx context.Context, p models.Poll, readings []models.Reading, files []models.FileReading, projects []models.PlatformReading, statuses []models.SourceStatus) (int64, error) {
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
	for _, f := range files {
		if err := saveFile(ctx, tx, id, p.FinishedAt, f); err != nil {
			return 0, err
		}
	}
	for _, pr := range projects {
		if err := savePlatformProject(ctx, tx, id, p.FinishedAt, pr); err != nil {
			return 0, err
		}
	}
	if err := trackReviews(ctx, tx, p.FinishedAt, projects); err != nil {
		return 0, err
	}
	if len(projects) > 0 {
		if err := autoLink(ctx, tx); err != nil {
			return 0, err
		}
	}
	for _, st := range statuses {
		if err := saveSourceStatus(ctx, tx, st); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return id, nil
}

func saveFile(ctx context.Context, tx *sql.Tx, pollID int64, at time.Time, f models.FileReading) error {
	gv, err := json.Marshal(nonNil(f.GameVersions))
	if err != nil {
		return err
	}
	lo, err := json.Marshal(nonNil(f.Loaders))
	if err != nil {
		return err
	}
	published := ""
	if !f.PublishedAt.IsZero() {
		published = format(f.PublishedAt)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO files (source, id, project_id, project_slug, project_name, name, version, release_type,
		                   game_versions, loaders, published_at, last_poll_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (source, id) DO UPDATE SET
			project_id = excluded.project_id, project_slug = excluded.project_slug, project_name = excluded.project_name,
			name = excluded.name, version = excluded.version, release_type = excluded.release_type,
			game_versions = excluded.game_versions, loaders = excluded.loaders, published_at = excluded.published_at,
			last_poll_id = excluded.last_poll_id`,
		f.Source, f.ID, f.ProjectID, f.ProjectSlug, f.ProjectName, f.Name, f.Version, f.ReleaseType,
		string(gv), string(lo), published, pollID); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO file_snapshots (source, file_id, poll_id, taken_at, download_count) VALUES (?, ?, ?, ?, ?)`,
		f.Source, f.ID, pollID, format(at), f.Downloads)
	return err
}

func saveSourceStatus(ctx context.Context, tx *sql.Tx, st models.SourceStatus) error {
	lastOK := ""
	if !st.LastOKAt.IsZero() {
		lastOK = format(st.LastOKAt)
	}
	// A failed check leaves last_ok_at alone; an empty value on a failure means "keep the old one".
	_, err := tx.ExecContext(ctx, `
		INSERT INTO source_status (source, ok, error, detail, checked_at, last_ok_at) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (source) DO UPDATE SET
			ok = excluded.ok, error = excluded.error, detail = excluded.detail, checked_at = excluded.checked_at,
			last_ok_at = CASE WHEN excluded.last_ok_at = '' THEN source_status.last_ok_at ELSE excluded.last_ok_at END`,
		st.Source, st.OK, st.Error, st.Detail, format(st.CheckedAt), lastOK)
	return err
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// SaveFailedPoll records a poll that didn't produce data.
func (r *Repo) SaveFailedPoll(ctx context.Context, p models.Poll, statuses []models.SourceStatus) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO polls (started_at, finished_at, state, error, mods) VALUES (?, ?, ?, ?, 0)`,
		format(p.StartedAt), format(p.FinishedAt), models.PollError, p.Error); err != nil {
		return err
	}
	for _, st := range statuses {
		if err := saveSourceStatus(ctx, tx, st); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `
		DELETE FROM polls WHERE state = ? AND id NOT IN (
			SELECT id FROM polls WHERE state = ? ORDER BY id DESC LIMIT ?)`,
		models.PollError, models.PollError, keepFailedPolls)
	if err != nil {
		return err
	}
	return tx.Commit()
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

// ListFileStats returns every file the latest refresh of each project saw, biggest first, with day and week movement.
// "Latest refresh of each project" rather than "latest poll": if one project's files couldn't be fetched this time,
// its files keep their last counts instead of vanishing from the dashboard and the metrics.
func (r *Repo) ListFileStats(ctx context.Context, now time.Time) ([]models.FileStat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT f.source, f.id, f.project_id, f.project_slug, f.project_name, f.name, f.version, f.release_type,
		       f.game_versions, f.loaders, f.published_at, s.download_count,
		       (SELECT p.download_count FROM file_snapshots p
		         WHERE p.source = f.source AND p.file_id = f.id AND p.taken_at <= ? ORDER BY p.taken_at DESC LIMIT 1),
		       (SELECT p.download_count FROM file_snapshots p
		         WHERE p.source = f.source AND p.file_id = f.id AND p.taken_at <= ? ORDER BY p.taken_at DESC LIMIT 1)
		FROM files f
		JOIN file_snapshots s ON s.source = f.source AND s.file_id = f.id AND s.poll_id = f.last_poll_id
		WHERE f.last_poll_id = (SELECT MAX(x.last_poll_id) FROM files x WHERE x.source = f.source AND x.project_id = f.project_id)
		ORDER BY s.download_count DESC, f.project_name, f.version`,
		format(now.Add(-24*time.Hour)), format(now.Add(-7*24*time.Hour)))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	out := []models.FileStat{}
	for rows.Next() {
		var s models.FileStat
		var gv, lo, published string
		var d1, d7 sql.NullInt64
		if err := rows.Scan(&s.Source, &s.ID, &s.ProjectID, &s.ProjectSlug, &s.ProjectName, &s.Name, &s.Version, &s.ReleaseType,
			&gv, &lo, &published, &s.Downloads, &d1, &d7); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(gv), &s.GameVersions); err != nil || s.GameVersions == nil {
			s.GameVersions = []string{}
		}
		if err := json.Unmarshal([]byte(lo), &s.Loaders); err != nil || s.Loaders == nil {
			s.Loaders = []string{}
		}
		s.PublishedAt = parseTime(published)
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

// ListSourceStatuses returns the last verdict for each source that has been tried.
func (r *Repo) ListSourceStatuses(ctx context.Context) ([]models.SourceStatus, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT source, ok, error, detail, checked_at, last_ok_at FROM source_status ORDER BY source`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	out := []models.SourceStatus{}
	for rows.Next() {
		var st models.SourceStatus
		var checked, lastOK string
		if err := rows.Scan(&st.Source, &st.OK, &st.Error, &st.Detail, &checked, &lastOK); err != nil {
			return nil, err
		}
		st.CheckedAt, st.LastOKAt = parseTime(checked), parseTime(lastOK)
		out = append(out, st)
	}
	return out, rows.Err()
}
