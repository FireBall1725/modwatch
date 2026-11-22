-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- The SQLite schema as of version 10, matching Postgres migrations 000001 to 000010 combined. Every later schema change
-- needs a file in both folders with the same number.
--
-- Times are text in a fixed UTC form, "2006-01-02 15:04:05.000+00:00", so they sort as text and date() reads them;
-- booleans are 0 and 1 and JSON arrays are text.

CREATE TABLE polls (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    started_at  DATETIME NOT NULL,
    finished_at DATETIME NOT NULL,
    state       TEXT     NOT NULL,
    error       TEXT     NOT NULL DEFAULT '',
    mods        INTEGER  NOT NULL DEFAULT 0
);

CREATE TABLE mods (
    id            INTEGER  PRIMARY KEY,
    slug          TEXT     NOT NULL,
    name          TEXT     NOT NULL,
    summary       TEXT     NOT NULL DEFAULT '',
    logo_url      TEXT     NOT NULL DEFAULT '',
    website_url   TEXT     NOT NULL DEFAULT '',
    owned         BOOLEAN  NOT NULL DEFAULT FALSE,
    date_created  DATETIME,
    date_modified DATETIME,
    last_poll_id  INTEGER  NOT NULL REFERENCES polls (id)
);

CREATE TABLE download_snapshots (
    mod_id         INTEGER  NOT NULL REFERENCES mods (id) ON DELETE CASCADE,
    poll_id        INTEGER  NOT NULL REFERENCES polls (id),
    taken_at       DATETIME NOT NULL,
    download_count INTEGER  NOT NULL,
    PRIMARY KEY (mod_id, poll_id)
);
CREATE INDEX download_snapshots_by_time ON download_snapshots (mod_id, taken_at);

CREATE TABLE files (
    source        TEXT     NOT NULL,
    id            TEXT     NOT NULL,
    project_id    TEXT     NOT NULL,
    project_slug  TEXT     NOT NULL,
    project_name  TEXT     NOT NULL,
    name          TEXT     NOT NULL,
    version       TEXT     NOT NULL,
    release_type  TEXT     NOT NULL,
    game_versions TEXT     NOT NULL DEFAULT '[]',
    loaders       TEXT     NOT NULL DEFAULT '[]',
    published_at  DATETIME,
    last_poll_id  INTEGER  NOT NULL REFERENCES polls (id),
    PRIMARY KEY (source, id)
);

CREATE TABLE file_snapshots (
    source         TEXT     NOT NULL,
    file_id        TEXT     NOT NULL,
    poll_id        INTEGER  NOT NULL REFERENCES polls (id),
    taken_at       DATETIME NOT NULL,
    download_count INTEGER  NOT NULL,
    PRIMARY KEY (source, file_id, poll_id),
    FOREIGN KEY (source, file_id) REFERENCES files (source, id) ON DELETE CASCADE
);
CREATE INDEX file_snapshots_by_time ON file_snapshots (source, file_id, taken_at);

CREATE TABLE source_status (
    source     TEXT     PRIMARY KEY,
    ok         BOOLEAN  NOT NULL,
    error      TEXT     NOT NULL DEFAULT '',
    checked_at DATETIME NOT NULL,
    last_ok_at DATETIME,
    detail     TEXT     NOT NULL DEFAULT ''
);

CREATE TABLE platform_projects (
    platform         TEXT     NOT NULL,
    id               TEXT     NOT NULL,
    slug             TEXT     NOT NULL,
    name             TEXT     NOT NULL,
    summary          TEXT     NOT NULL DEFAULT '',
    icon_url         TEXT     NOT NULL DEFAULT '',
    url              TEXT     NOT NULL DEFAULT '',
    raw_status       TEXT     NOT NULL DEFAULT '',
    status           TEXT     NOT NULL DEFAULT 'unknown',
    status_message   TEXT     NOT NULL DEFAULT '',
    requested_status TEXT     NOT NULL DEFAULT '',
    queued_at        DATETIME,
    followers        INTEGER  NOT NULL DEFAULT 0,
    owned            BOOLEAN  NOT NULL DEFAULT FALSE,
    published_at     DATETIME,
    updated_at       DATETIME,
    source_url       TEXT     NOT NULL DEFAULT '',
    issues_url       TEXT     NOT NULL DEFAULT '',
    wiki_url         TEXT     NOT NULL DEFAULT '',
    discord_url      TEXT     NOT NULL DEFAULT '',
    last_poll_id     INTEGER  NOT NULL REFERENCES polls (id),
    PRIMARY KEY (platform, id)
);

CREATE TABLE platform_snapshots (
    platform       TEXT     NOT NULL,
    project_id     TEXT     NOT NULL,
    poll_id        INTEGER  NOT NULL REFERENCES polls (id),
    taken_at       DATETIME NOT NULL,
    download_count INTEGER  NOT NULL,
    PRIMARY KEY (platform, project_id, poll_id),
    FOREIGN KEY (platform, project_id) REFERENCES platform_projects (platform, id) ON DELETE CASCADE
);
CREATE INDEX platform_snapshots_by_time ON platform_snapshots (platform, project_id, taken_at);

CREATE TABLE catalog (
    slug          TEXT    PRIMARY KEY,
    name          TEXT    NOT NULL,
    curseforge_id INTEGER,
    modrinth_id   TEXT,
    github_label  TEXT,
    github_repo   TEXT,
    version_regex TEXT,
    hidden        BOOLEAN NOT NULL DEFAULT FALSE,
    legacy        BOOLEAN NOT NULL DEFAULT FALSE,
    auto          BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX catalog_curseforge_id ON catalog (curseforge_id);
CREATE UNIQUE INDEX catalog_modrinth_id ON catalog (modrinth_id);
CREATE UNIQUE INDEX catalog_github_label ON catalog (github_label);
CREATE UNIQUE INDEX catalog_github_repo ON catalog (lower(github_repo));

CREATE TABLE issues (
    repo         TEXT     NOT NULL DEFAULT '',
    number       INTEGER  NOT NULL,
    title        TEXT     NOT NULL,
    state        TEXT     NOT NULL,
    url          TEXT     NOT NULL,
    labels       TEXT     NOT NULL DEFAULT '[]',
    mod_label    TEXT     NOT NULL DEFAULT '',
    kind         TEXT     NOT NULL,
    author       TEXT     NOT NULL DEFAULT '',
    comments     INTEGER  NOT NULL DEFAULT 0,
    created_at   DATETIME,
    updated_at   DATETIME,
    closed_at    DATETIME,
    last_poll_id INTEGER  NOT NULL,
    PRIMARY KEY (repo, number)
);
CREATE INDEX issues_state ON issues (state, updated_at);

CREATE TABLE review_seen (
    platform      TEXT     NOT NULL,
    project_id    TEXT     NOT NULL,
    first_seen_at DATETIME NOT NULL,
    PRIMARY KEY (platform, project_id)
);

CREATE TABLE settings (
    key        TEXT     PRIMARY KEY,
    value      TEXT     NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE attention_dismissals (
    kind         TEXT     NOT NULL,
    mod_slug     TEXT     NOT NULL,
    dismissed_at DATETIME NOT NULL,
    PRIMARY KEY (kind, mod_slug)
);
