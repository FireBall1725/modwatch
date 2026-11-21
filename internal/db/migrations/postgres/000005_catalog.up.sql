-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- One mod joined across CurseForge, Modrinth and GitHub. Project ids point at platform_projects by value, not by
-- foreign key, so a project that leaves a platform doesn't delete the link the author set by hand.
CREATE TABLE catalog (
    slug          TEXT    PRIMARY KEY,
    name          TEXT    NOT NULL,
    curseforge_id BIGINT,
    modrinth_id   TEXT,
    github_label  TEXT,
    hidden        BOOLEAN NOT NULL DEFAULT FALSE,
    auto          BOOLEAN NOT NULL DEFAULT TRUE
);

-- A project belongs to at most one entry, and a label to at most one entry. NULLs don't collide.
CREATE UNIQUE INDEX catalog_curseforge_id ON catalog (curseforge_id);
CREATE UNIQUE INDEX catalog_modrinth_id ON catalog (modrinth_id);
CREATE UNIQUE INDEX catalog_github_label ON catalog (github_label);
