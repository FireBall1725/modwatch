// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"

	"github.com/fireball1725/modwatch/internal/models"
)

// SaveIssues stores the issues a poll read and records pollID on each.
//
// configured is every repository that should have issues now and fetched the ones this poll read without error.
// An issue that is gone from a repository that was read (deleted or transferred) is removed; a repository that
// failed keeps its last stored issues; a repository nobody has configured any more loses its issues.
func (r *Repo) SaveIssues(ctx context.Context, pollID int64, configured, fetched []string, issues []models.Issue) error {
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
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO issues (repo, number, title, state, url, labels, mod_label, kind, author, comments, created_at, updated_at, closed_at, last_poll_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			ON CONFLICT (repo, number) DO UPDATE SET
				title = excluded.title, state = excluded.state, url = excluded.url, labels = excluded.labels,
				mod_label = excluded.mod_label, kind = excluded.kind, author = excluded.author, comments = excluded.comments,
				created_at = excluded.created_at, updated_at = excluded.updated_at, closed_at = excluded.closed_at,
				last_poll_id = excluded.last_poll_id`,
			is.Repo, is.Number, is.Title, is.State, is.URL, string(labels), is.ModLabel, is.Kind, is.Author, is.Comments,
			tz(is.CreatedAt), tz(is.UpdatedAt), tz(is.ClosedAt), pollID); err != nil {
			return err
		}
	}
	// Issues gone from a repository that was read are deleted, and so is everything in a repository no longer
	// configured. A repository that failed to read keeps what it had.
	if len(fetched) > 0 {
		list, args := inList(2, fetched)
		if _, err := tx.ExecContext(ctx, `DELETE FROM issues WHERE last_poll_id <> $1 AND repo IN (`+list+`)`, append([]any{pollID}, args...)...); err != nil {
			return err
		}
	}
	if len(configured) == 0 {
		if _, err := tx.ExecContext(ctx, `DELETE FROM issues`); err != nil {
			return err
		}
	} else {
		list, args := inList(1, configured)
		if _, err := tx.ExecContext(ctx, `DELETE FROM issues WHERE repo NOT IN (`+list+`)`, args...); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// inList is "$n, $n+1, ..." for a list of values, and the values as arguments, so one query reads the same in both
// databases. Postgres has = ANY($1) for an array and SQLite has no arrays.
func inList(first int, values []string) (string, []any) {
	marks := make([]string, len(values))
	args := make([]any, len(values))
	for i, v := range values {
		marks[i] = "$" + strconv.Itoa(first+i)
		args[i] = v
	}
	return strings.Join(marks, ", "), args
}

// ListIssues returns stored issues, newest updated first. state is "open", "closed" or "all".
// Newest updated first puts the issues someone just touched at the top; oldest-first would bury them.
func (r *Repo) ListIssues(ctx context.Context, state string) ([]models.Issue, error) {
	q := `SELECT repo, number, title, state, url, labels, mod_label, kind, author, comments, created_at, updated_at, closed_at FROM issues`
	var args []any
	if state == "open" || state == "closed" {
		q += ` WHERE state = $1`
		args = append(args, state)
	}
	q += ` ORDER BY updated_at DESC NULLS LAST, repo, number DESC`
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []models.Issue{}
	for rows.Next() {
		var is models.Issue
		var labels []byte
		var created, updated, closed sql.NullTime
		if err := rows.Scan(&is.Repo, &is.Number, &is.Title, &is.State, &is.URL, &labels, &is.ModLabel, &is.Kind, &is.Author,
			&is.Comments, &created, &updated, &closed); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(labels, &is.Labels); err != nil || is.Labels == nil {
			is.Labels = []string{}
		}
		is.CreatedAt, is.UpdatedAt, is.ClosedAt = fromNull(created), fromNull(updated), fromNull(closed)
		out = append(out, is)
	}
	return out, rows.Err()
}
