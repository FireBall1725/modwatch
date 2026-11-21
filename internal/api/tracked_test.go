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
