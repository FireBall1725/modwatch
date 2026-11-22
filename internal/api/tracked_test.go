// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"reflect"
	"testing"

	"github.com/fireball1725/modwatch/internal/models"
)

func TestTrackedFilesDropsSwitchedOffVersions(t *testing.T) {
	files := []models.FileStat{
		{File: models.File{ID: "a", GameVersions: []string{"1.7.10"}}},
		{File: models.File{ID: "b", GameVersions: []string{"1.7.10", "1.12.2"}}},
		{File: models.File{ID: "c", GameVersions: []string{"1.21.1"}}},
		{File: models.File{ID: "d"}},
	}
	got := trackedFiles(files, []string{"1.7.10"})
	if len(got) != 3 {
		t.Fatalf("files = %+v", got)
	}
	if got[0].ID != "b" || !reflect.DeepEqual(got[0].GameVersions, []string{"1.12.2"}) {
		t.Errorf("mixed file = %+v", got[0])
	}
	if len(files[1].GameVersions) != 2 {
		t.Error("the input must not be changed")
	}
	if same := trackedFiles(files, nil); len(same) != 4 {
		t.Errorf("nothing switched off should keep every file, got %d", len(same))
	}
}

func TestWithoutDisabledTakesFileDownloadsOutOfTotals(t *testing.T) {
	d1, d7 := int64(5), int64(9)
	stats := []models.PlatformStat{{
		PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "1"},
		Downloads:       1000, Delta24h: &d1, Delta7d: &d7,
	}}
	mk := func(id string, dl int64, vs ...string) models.FileStat {
		return models.FileStat{
			File:      models.File{Source: "curseforge", ID: id, ProjectID: "1", GameVersions: vs},
			Downloads: dl, Delta24h: &d1, Delta7d: &d7,
		}
	}
	all := []models.FileStat{mk("a", 300, "1.20.1"), mk("b", 200, "1.21.1")}
	kept := trackedFiles(all, []string{"1.20.1"})

	got := withoutDisabled(stats, all, kept)
	if got[0].Downloads != 700 {
		t.Errorf("downloads = %d, want 700", got[0].Downloads)
	}
	if *got[0].Delta24h != 0 || *got[0].Delta7d != 0 {
		t.Errorf("deltas = %d, %d, want 0, 0", *got[0].Delta24h, *got[0].Delta7d)
	}
	if stats[0].Downloads != 1000 {
		t.Error("input stats were changed")
	}
	if same := withoutDisabled(stats, all, all); same[0].Downloads != 1000 {
		t.Error("nothing disabled should change nothing")
	}
}

func TestWithoutDisabledZeroesProjectWhenAllFilesAreDisabled(t *testing.T) {
	n := int64(7)
	stats := []models.PlatformStat{
		{PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "1"}, Downloads: 2199, Delta24h: &n, Delta7d: &n},
		{PlatformProject: models.PlatformProject{Platform: "curseforge", ID: "2"}, Downloads: 500, Delta24h: &n, Delta7d: &n},
	}
	all := []models.FileStat{
		{File: models.File{Source: "curseforge", ID: "a", ProjectID: "1", GameVersions: []string{"1.7.10"}}, Downloads: 216013},
		{File: models.File{Source: "curseforge", ID: "b", ProjectID: "2", GameVersions: []string{"1.7.10"}}, Downloads: 100},
		{File: models.File{Source: "curseforge", ID: "c", ProjectID: "2", GameVersions: []string{"1.21.1"}}, Downloads: 50},
	}
	got := withoutDisabled(stats, all, trackedFiles(all, []string{"1.7.10"}))
	if got[0].Downloads != 0 || *got[0].Delta24h != 0 || *got[0].Delta7d != 0 {
		t.Errorf("project with only disabled files = %d (%d, %d), want all 0", got[0].Downloads, *got[0].Delta24h, *got[0].Delta7d)
	}
	if got[1].Downloads != 400 {
		t.Errorf("mixed project downloads = %d, want 400", got[1].Downloads)
	}
}
