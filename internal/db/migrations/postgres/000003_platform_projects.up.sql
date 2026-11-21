-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- A project on CurseForge or Modrinth with its review state. Ids are text because Modrinth's are.
-- A time is NULL when the platform gave none.
CREATE TABLE platform_projects (
    platform         TEXT        NOT NULL,
    id               TEXT        NOT NULL,
    slug             TEXT        NOT NULL,
    name             TEXT        NOT NULL,
    summary          TEXT        NOT NULL DEFAULT '',
    icon_url         TEXT        NOT NULL DEFAULT '',
    url              TEXT        NOT NULL DEFAULT '',
    raw_status       TEXT        NOT NULL DEFAULT '',
    status           TEXT        NOT NULL DEFAULT 'unknown',
    status_message   TEXT        NOT NULL DEFAULT '',
    requested_status TEXT        NOT NULL DEFAULT '',
    queued_at        TIMESTAMPTZ,
    followers        BIGINT      NOT NULL DEFAULT 0,
    owned            BOOLEAN     NOT NULL DEFAULT FALSE,
    published_at     TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ,
    source_url       TEXT        NOT NULL DEFAULT '',
    issues_url       TEXT        NOT NULL DEFAULT '',
    wiki_url         TEXT        NOT NULL DEFAULT '',
    discord_url      TEXT        NOT NULL DEFAULT '',
    -- The newest poll that refreshed this platform's projects. A project missing from it was removed.
    last_poll_id     BIGINT      NOT NULL REFERENCES polls (id),
    PRIMARY KEY (platform, id)
);

CREATE TABLE platform_snapshots (
    platform       TEXT        NOT NULL,
    project_id     TEXT        NOT NULL,
    poll_id        BIGINT      NOT NULL REFERENCES polls (id),
    taken_at       TIMESTAMPTZ NOT NULL,
    download_count BIGINT      NOT NULL,
    PRIMARY KEY (platform, project_id, poll_id),
    FOREIGN KEY (platform, project_id) REFERENCES platform_projects (platform, id) ON DELETE CASCADE
);

CREATE INDEX platform_snapshots_by_time ON platform_snapshots (platform, project_id, taken_at);
