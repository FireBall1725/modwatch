// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"sort"

	"github.com/fireball1725/modwatch/internal/models"
)

// totalsBy adds up downloads under each name the pick function returns for a file.
// A file that targets two Minecraft versions counts toward both, so the results overlap and shouldn't be summed.
func totalsBy(files []models.FileStat, pick func(models.File) []string) []models.VersionTotal {
	byName := map[string]*models.VersionTotal{}
	for _, f := range files {
		for _, name := range pick(f.File) {
			t := byName[name]
			if t == nil {
				t = &models.VersionTotal{Name: name}
				byName[name] = t
			}
			t.Downloads += f.Downloads
			t.Files++
		}
	}
	out := make([]models.VersionTotal, 0, len(byName))
	for _, t := range byName {
		out = append(out, *t)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Downloads != out[j].Downloads {
			return out[i].Downloads > out[j].Downloads
		}
		return out[i].Name < out[j].Name
	})
	return out
}

func gameVersionsOf(f models.File) []string { return f.GameVersions }
func loadersOf(f models.File) []string      { return f.Loaders }
