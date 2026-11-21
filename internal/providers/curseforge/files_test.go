// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package curseforge

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"testing"
)

func TestClassifySplitsVersionsFromLoadersAndSides(t *testing.T) {
	mc, loaders := Classify([]string{"Client", "1.21.1", "NeoForge", "Server", "Java 21", "1.21", "24w14a", "1.21-Pre1", "Fabric", "Mystery"})
	if want := []string{"1.21.1", "1.21", "24w14a", "1.21-Pre1"}; !reflect.DeepEqual(mc, want) {
		t.Errorf("minecraft = %v, want %v", mc, want)
	}
	if want := []string{"neoforge", "fabric"}; !reflect.DeepEqual(loaders, want) {
		t.Errorf("loaders = %v, want %v", loaders, want)
	}
}

func TestClassifyNeverReturnsNil(t *testing.T) {
	mc, loaders := Classify(nil)
	if mc == nil || loaders == nil {
		t.Error("empty results must be empty slices, not nil")
	}
}

func TestReleaseName(t *testing.T) {
	for n, want := range map[int]string{1: "release", 2: "beta", 3: "alpha", 9: "unknown"} {
		if got := (File{ReleaseType: n}).ReleaseName(); got != want {
			t.Errorf("release type %d = %q, want %q", n, got, want)
		}
	}
}

func TestListFilesPages(t *testing.T) {
	const total = 70
	var path string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		index, _ := strconv.Atoi(r.URL.Query().Get("index"))
		page := []map[string]any{}
		for i := index; i < total && i < index+50; i++ {
			page = append(page, map[string]any{"id": i + 1, "displayName": "f", "downloadCount": i, "gameVersions": []string{"1.21.1"}})
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": page, "pagination": map[string]int{"totalCount": total}})
	}))
	defer srv.Close()

	files, err := New(srv.URL, "k", 432).ListFiles(context.Background(), 1764471)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != total || path != "/v1/mods/1764471/files" {
		t.Errorf("got %d files from %q", len(files), path)
	}
}
