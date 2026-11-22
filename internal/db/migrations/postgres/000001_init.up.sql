-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

CREATE TABLE polls (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    state       TEXT        NOT NULL,
    error       TEXT        NOT NULL DEFAULT '',
    mods        INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE mods (
    id            BIGINT      PRIMARY KEY,
    slug          TEXT        NOT NULL,
    name          TEXT        NOT NULL,
    summary       TEXT        NOT NULL DEFAULT '',
    logo_url      TEXT        NOT NULL DEFAULT '',
    website_url   TEXT        NOT NULL DEFAULT '',
    owned         BOOLEAN     NOT NULL DEFAULT FALSE,
    date_created  TIMESTAMPTZ,
    date_modified TIMESTAMPTZ,
    -- The newest poll that returned this mod. A mod missing from the latest poll has been removed or transferred.
    last_poll_id  BIGINT      NOT NULL REFERENCES polls (id)
);

CREATE TABLE download_snapshots (
    mod_id         BIGINT      NOT NULL REFERENCES mods (id) ON DELETE CASCADE,
    poll_id        BIGINT      NOT NULL REFERENCES polls (id),
    taken_at       TIMESTAMPTZ NOT NULL,
    download_count BIGINT      NOT NULL,
    PRIMARY KEY (mod_id, poll_id)
);

CREATE INDEX download_snapshots_by_time ON download_snapshots (mod_id, taken_at);
