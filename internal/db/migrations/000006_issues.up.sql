-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

CREATE TABLE issues (
    number       INTEGER PRIMARY KEY,
    title        TEXT    NOT NULL,
    state        TEXT    NOT NULL,
    url          TEXT    NOT NULL,
    labels       TEXT    NOT NULL DEFAULT '[]',
    mod_label    TEXT    NOT NULL DEFAULT '',
    kind         TEXT    NOT NULL,
    author       TEXT    NOT NULL DEFAULT '',
    comments     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    closed_at    TEXT    NOT NULL DEFAULT '',
    last_poll_id INTEGER NOT NULL
);

CREATE INDEX issues_state ON issues (state, updated_at);
