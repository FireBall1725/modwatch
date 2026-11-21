-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

-- A mod's own pattern for reading its file versions, with named groups version, pre and minecraft.
ALTER TABLE catalog ADD COLUMN version_regex TEXT;
