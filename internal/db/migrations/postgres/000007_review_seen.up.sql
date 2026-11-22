-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- When Modwatch first saw a project in review, for platforms that don't say when it was queued.
-- The row goes when the project leaves review, so the next review starts a new clock.
CREATE TABLE review_seen (
    platform      TEXT        NOT NULL,
    project_id    TEXT        NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (platform, project_id)
);
