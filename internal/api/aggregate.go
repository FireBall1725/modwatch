// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import "github.com/fireball1725/modwatch/internal/models"

func gameVersionsOf(f models.File) []string { return f.GameVersions }
func loadersOf(f models.File) []string      { return f.Loaders }
