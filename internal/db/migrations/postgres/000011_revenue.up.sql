-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- What a platform owes the author, as the latest poll read it. One row per platform, replaced each poll.
-- months is a JSON array of {month, amount}.
CREATE TABLE revenue (
    platform           TEXT             PRIMARY KEY,
    currency           TEXT             NOT NULL,
    available          DOUBLE PRECISION NOT NULL,
    pending            DOUBLE PRECISION NOT NULL,
    withdrawn_lifetime DOUBLE PRECISION NOT NULL,
    withdrawn_ytd      DOUBLE PRECISION NOT NULL,
    months             TEXT             NOT NULL DEFAULT '[]',
    fetched_at         TIMESTAMPTZ      NOT NULL
);
