-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

CREATE TABLE polls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT    NOT NULL,
    finished_at TEXT    NOT NULL,
    state       TEXT    NOT NULL,
    error       TEXT    NOT NULL DEFAULT '',
    mods        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE mods (
    id            INTEGER PRIMARY KEY,
    slug          TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    summary       TEXT    NOT NULL DEFAULT '',
    logo_url      TEXT    NOT NULL DEFAULT '',
    website_url   TEXT    NOT NULL DEFAULT '',
    owned         INTEGER NOT NULL DEFAULT 0,
    date_created  TEXT    NOT NULL DEFAULT '',
    date_modified TEXT    NOT NULL DEFAULT '',
    -- The newest poll that returned this mod. A mod missing from the latest poll has been removed or transferred.
    last_poll_id  INTEGER NOT NULL REFERENCES polls (id)
);

-- Times are UTC with a fixed width, so comparing them as text sorts them correctly.
CREATE TABLE download_snapshots (
    mod_id         INTEGER NOT NULL REFERENCES mods (id) ON DELETE CASCADE,
    poll_id        INTEGER NOT NULL REFERENCES polls (id),
    taken_at       TEXT    NOT NULL,
    download_count INTEGER NOT NULL,
    PRIMARY KEY (mod_id, poll_id)
);

CREATE INDEX download_snapshots_by_time ON download_snapshots (mod_id, taken_at);
