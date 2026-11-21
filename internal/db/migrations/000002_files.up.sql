-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- A downloadable file on CurseForge or a version on Modrinth. Ids are text because Modrinth's are.
CREATE TABLE files (
    source        TEXT    NOT NULL,
    id            TEXT    NOT NULL,
    project_id    TEXT    NOT NULL,
    project_slug  TEXT    NOT NULL,
    project_name  TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    version       TEXT    NOT NULL,
    release_type  TEXT    NOT NULL,
    -- JSON arrays of strings. Minecraft versions and loaders are kept apart.
    game_versions TEXT    NOT NULL DEFAULT '[]',
    loaders       TEXT    NOT NULL DEFAULT '[]',
    published_at  TEXT    NOT NULL DEFAULT '',
    -- The newest poll that refreshed this file's project. A file missing from that poll was removed.
    last_poll_id  INTEGER NOT NULL REFERENCES polls (id),
    PRIMARY KEY (source, id)
);

CREATE TABLE file_snapshots (
    source         TEXT    NOT NULL,
    file_id        TEXT    NOT NULL,
    poll_id        INTEGER NOT NULL REFERENCES polls (id),
    taken_at       TEXT    NOT NULL,
    download_count INTEGER NOT NULL,
    PRIMARY KEY (source, file_id, poll_id),
    FOREIGN KEY (source, file_id) REFERENCES files (source, id) ON DELETE CASCADE
);

CREATE INDEX file_snapshots_by_time ON file_snapshots (source, file_id, taken_at);

-- One row per source: did the latest attempt work, and when did one last work.
CREATE TABLE source_status (
    source     TEXT    PRIMARY KEY,
    ok         INTEGER NOT NULL,
    error      TEXT    NOT NULL DEFAULT '',
    checked_at TEXT    NOT NULL,
    last_ok_at TEXT    NOT NULL DEFAULT ''
);
