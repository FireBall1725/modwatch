-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- Values the author set in the UI. They win over the environment variables; deleting a row brings the variable back.
CREATE TABLE settings (
    key        TEXT        PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Needs-attention items the author dismissed, per kind and mod.
CREATE TABLE attention_dismissals (
    kind         TEXT        NOT NULL,
    mod_slug     TEXT        NOT NULL,
    dismissed_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (kind, mod_slug)
);

-- Issues can come from several repositories now, so a number is only unique within its repo.
ALTER TABLE issues ADD COLUMN repo TEXT NOT NULL DEFAULT '';
ALTER TABLE issues DROP CONSTRAINT issues_pkey;
ALTER TABLE issues ADD PRIMARY KEY (repo, number);

-- A mod's own issues repository, for mods that don't use the shared one. One repository belongs to at most one mod.
ALTER TABLE catalog ADD COLUMN github_repo TEXT;
CREATE UNIQUE INDEX catalog_github_repo ON catalog (lower(github_repo));
