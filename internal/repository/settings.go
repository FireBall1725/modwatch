// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

// Settings returns every value the author set in the UI, by key.
func (r *Repo) Settings(ctx context.Context) (map[string]string, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

// SaveSettings sets the given keys and deletes the keys whose value is nil, in one transaction.
func (r *Repo) SaveSettings(ctx context.Context, changes map[string]*string, at time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	for k, v := range changes {
		if v == nil {
			if _, err := tx.ExecContext(ctx, `DELETE FROM settings WHERE key = $1`, k); err != nil {
				return err
			}
			continue
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3)
			ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
			k, *v, tz(at)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Dismissals returns every dismissed needs-attention item.
func (r *Repo) Dismissals(ctx context.Context) ([]models.Dismissal, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT kind, mod_slug, dismissed_at FROM attention_dismissals ORDER BY kind, mod_slug`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []models.Dismissal{}
	for rows.Next() {
		var d models.Dismissal
		if err := rows.Scan(&d.Kind, &d.ModSlug, &d.DismissedAt); err != nil {
			return nil, err
		}
		d.DismissedAt = d.DismissedAt.UTC()
		out = append(out, d)
	}
	return out, rows.Err()
}

// Dismiss records a dismissal; dismissing twice changes nothing.
func (r *Repo) Dismiss(ctx context.Context, kind, modSlug string, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO attention_dismissals (kind, mod_slug, dismissed_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		kind, modSlug, tz(at))
	return err
}

// Restore undoes a dismissal; restoring one that isn't there changes nothing.
func (r *Repo) Restore(ctx context.Context, kind, modSlug string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM attention_dismissals WHERE kind = $1 AND mod_slug = $2`, kind, modSlug)
	return err
}
