-- SPDX-License-Identifier: AGPL-3.0-only
-- Copyright (C) 2026 FireBall1725

DROP INDEX catalog_github_repo;
ALTER TABLE catalog DROP COLUMN github_repo;
DELETE FROM issues WHERE repo <> '';
ALTER TABLE issues DROP CONSTRAINT issues_pkey;
ALTER TABLE issues ADD PRIMARY KEY (number);
ALTER TABLE issues DROP COLUMN repo;
DROP TABLE attention_dismissals;
DROP TABLE settings;
