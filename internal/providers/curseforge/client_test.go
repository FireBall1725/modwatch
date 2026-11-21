// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package curseforge

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

// fakeAPI serves total mods across pages and records the last query.
func fakeAPI(t *testing.T, total int) (*httptest.Server, *map[string]string) {
	t.Helper()
	seen := map[string]string{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "good" {
			http.Error(w, "Forbidden: API Key missing or invalid", http.StatusForbidden)
			return
		}
		q := r.URL.Query()
		for k := range q {
			seen[k] = q.Get(k)
		}
		index, _ := strconv.Atoi(q.Get("index"))
		size, _ := strconv.Atoi(q.Get("pageSize"))
		page := []map[string]any{}
		for i := index; i < total && i < index+size; i++ {
			page = append(page, map[string]any{"id": i + 1, "name": "Mod " + strconv.Itoa(i+1), "downloadCount": 100 * (i + 1)})
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data":       page,
			"pagination": map[string]int{"index": index, "resultCount": len(page), "totalCount": total},
		})
	}))
	t.Cleanup(srv.Close)
	return srv, &seen
}

func TestListByAuthorPages(t *testing.T) {
	srv, seen := fakeAPI(t, 120)
	mods, err := New(srv.URL, "good", 432).ListByAuthor(context.Background(), 77, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(mods) != 120 {
		t.Fatalf("got %d mods, want 120 across three pages", len(mods))
	}
	if (*seen)["authorId"] != "77" || (*seen)["gameId"] != "432" {
		t.Errorf("query was %v", *seen)
	}
	if mods[119].DownloadCount != 12000 {
		t.Errorf("last mod downloads = %d", mods[119].DownloadCount)
	}
}

func TestListByAuthorOwnerOnlyUsesPrimaryAuthorID(t *testing.T) {
	srv, seen := fakeAPI(t, 1)
	if _, err := New(srv.URL, "good", 432).ListByAuthor(context.Background(), 77, true); err != nil {
		t.Fatal(err)
	}
	if (*seen)["primaryAuthorId"] != "77" || (*seen)["authorId"] != "" {
		t.Errorf("query was %v", *seen)
	}
}

func TestListByAuthorEmptyIsNotNil(t *testing.T) {
	srv, _ := fakeAPI(t, 0)
	mods, err := New(srv.URL, "good", 432).ListByAuthor(context.Background(), 77, false)
	if err != nil {
		t.Fatal(err)
	}
	if mods == nil {
		t.Error("an empty result must be an empty slice, not nil")
	}
}

func TestForbiddenNamesTheLikelyCause(t *testing.T) {
	srv, _ := fakeAPI(t, 1)
	_, err := New(srv.URL, "bad-key-value", 432).ListByAuthor(context.Background(), 77, false)
	if err == nil || !strings.Contains(err.Error(), "Core API key") {
		t.Fatalf("error = %v", err)
	}
	if strings.Contains(err.Error(), "bad-key-value") {
		t.Error("the error must not echo the key")
	}
}
