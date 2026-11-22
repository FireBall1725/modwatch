-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

CREATE TABLE issues (
    number       BIGINT      PRIMARY KEY,
    title        TEXT        NOT NULL,
    state        TEXT        NOT NULL,
    url          TEXT        NOT NULL,
    labels       JSONB       NOT NULL DEFAULT '[]',
    mod_label    TEXT        NOT NULL DEFAULT '',
    kind         TEXT        NOT NULL,
    author       TEXT        NOT NULL DEFAULT '',
    comments     INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ,
    closed_at    TIMESTAMPTZ,
    last_poll_id BIGINT      NOT NULL
);

CREATE INDEX issues_state ON issues (state, updated_at);
