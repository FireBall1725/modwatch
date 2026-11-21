// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"encoding/json"

	"github.com/fireball1725/modwatch/internal/models"
)

// SaveIssues replaces the stored issues with the ones the poll just read, and records pollID on each.
// An issue that is no longer in the list (deleted or transferred) is removed.
func (r *Repo) SaveIssues(ctx context.Context, pollID int64, issues []models.Issue) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	for _, is := range issues {
		labels, err := json.Marshal(nonNil(is.Labels))
		if err != nil {
			return err
		}
		closed := ""
		if !is.ClosedAt.IsZero() {
			closed = format(is.ClosedAt)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO issues (number, title, state, url, labels, mod_label, kind, author, comments, created_at, updated_at, closed_at, last_poll_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (number) DO UPDATE SET
				title = excluded.title, state = excluded.state, url = excluded.url, labels = excluded.labels,
				mod_label = excluded.mod_label, kind = excluded.kind, author = excluded.author, comments = excluded.comments,
				created_at = excluded.created_at, updated_at = excluded.updated_at, closed_at = excluded.closed_at,
				last_poll_id = excluded.last_poll_id`,
			is.Number, is.Title, is.State, is.URL, string(labels), is.ModLabel, is.Kind, is.Author, is.Comments,
			format(is.CreatedAt), format(is.UpdatedAt), closed, pollID); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM issues WHERE last_poll_id <> ?`, pollID); err != nil {
		return err
	}
	return tx.Commit()
}

// ListIssues returns stored issues, newest updated first. state is "open", "closed" or "all".
// Newest updated first puts the issues someone just touched at the top; oldest-first would bury them.
func (r *Repo) ListIssues(ctx context.Context, state string) ([]models.Issue, error) {
	q := `SELECT number, title, state, url, labels, mod_label, kind, author, comments, created_at, updated_at, closed_at FROM issues`
	var args []any
	if state == "open" || state == "closed" {
		q += ` WHERE state = ?`
		args = append(args, state)
	}
	q += ` ORDER BY updated_at DESC, number DESC`
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []models.Issue{}
	for rows.Next() {
		var is models.Issue
		var labels, created, updated, closed string
		if err := rows.Scan(&is.Number, &is.Title, &is.State, &is.URL, &labels, &is.ModLabel, &is.Kind, &is.Author,
			&is.Comments, &created, &updated, &closed); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(labels), &is.Labels); err != nil || is.Labels == nil {
			is.Labels = []string{}
		}
		is.CreatedAt, is.UpdatedAt, is.ClosedAt = parseTime(created), parseTime(updated), parseTime(closed)
		out = append(out, is)
	}
	return out, rows.Err()
}
