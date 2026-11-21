-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- A mod that deliberately stays on old Minecraft versions: never flagged for missing the newest one.
ALTER TABLE catalog ADD COLUMN legacy INTEGER NOT NULL DEFAULT 0;
