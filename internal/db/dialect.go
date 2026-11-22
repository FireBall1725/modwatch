// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package db

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/stdlib"
	"modernc.org/sqlite"
)

// Dialect is the database in use. The repository writes the SQL both read the same way once, and asks the dialect
// for the few pieces that differ.
type Dialect int

const (
	Postgres Dialect = iota + 1
	SQLite
)

func (d Dialect) String() string {
	if d == SQLite {
		return "sqlite"
	}
	return "postgres"
}

// folder is where this dialect's migrations live.
func (d Dialect) folder() string { return d.String() }

// DialectOfURL reads the database a URL names.
func DialectOfURL(rawURL string) (Dialect, error) {
	switch {
	case strings.HasPrefix(rawURL, "postgres://"), strings.HasPrefix(rawURL, "postgresql://"):
		return Postgres, nil
	case strings.HasPrefix(rawURL, "sqlite:"):
		return SQLite, nil
	}
	return 0, fmt.Errorf("DATABASE_URL must start with postgres://, postgresql:// or sqlite:, such as sqlite:///data/modwatch.db")
}

// Of is the dialect a connection was opened with.
func Of(conn *sql.DB) Dialect {
	switch conn.Driver().(type) {
	case *sqlite.Driver:
		return SQLite
	case *stdlib.Driver:
		return Postgres
	}
	return Postgres
}

// Day is the UTC calendar day of a timestamp column, to group one snapshot per day.
func (d Dialect) Day(col string) string {
	if d == SQLite {
		return "date(" + col + ")"
	}
	return "(" + col + " AT TIME ZONE 'UTC')::date"
}
