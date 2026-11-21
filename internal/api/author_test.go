// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/fireball1725/modwatch/internal/config"
)

// fakeCurseForge answers the search the way the real API does for the name FireBall1725 and for nothing else.
func fakeCurseForge(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "core-key" {
			http.Error(w, `{"error":"bad key"}`, http.StatusForbidden)
			return
		}
		w.Header().Set("content-type", "application/json")
		if r.URL.Query().Get("searchFilter") == "FireBall1725" && r.URL.Query().Get("index") == "0" {
			_, _ = w.Write([]byte(`{"data":[{"id":1769863,"name":"AE2 Traffic Monitor","authors":[{"id":8109937,"name":"FireBall1725","url":"https://www.curseforge.com/members/fireball1725"}]}],"pagination":{"index":0,"resultCount":1,"totalCount":1}}`))
			return
		}
		_, _ = w.Write([]byte(`{"data":[],"pagination":{"index":0,"resultCount":0,"totalCount":0}}`))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestFindAuthorFromProfileLink(t *testing.T) {
	cf := fakeCurseForge(t)
	h := serverWith(t, &config.Config{CurseForgeKey: "core-key", CurseForgeBaseURL: cf.URL, CurseForgeGameID: 432}, nil)

	rec := send(h, http.MethodPost, "/api/v1/curseforge/author", `{"link":"https://www.curseforge.com/members/FireBall1725"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d %s", rec.Code, rec.Body)
	}
	var got struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got.ID != 8109937 || got.Name != "FireBall1725" {
		t.Errorf("got %+v, err %v", got, err)
	}
}

func TestFindAuthorExplainsFailures(t *testing.T) {
	cf := fakeCurseForge(t)
	h := serverWith(t, &config.Config{CurseForgeKey: "core-key", CurseForgeBaseURL: cf.URL, CurseForgeGameID: 432}, nil)
	cases := []struct {
		body string
		code int
		text string
	}{
		{`{"link":"https://example.com/nope"}`, http.StatusBadRequest, "paste your profile link"},
		{`{"link":"https://www.curseforge.com/members/nobody-here"}`, http.StatusNotFound, "no mod on CurseForge"},
	}
	for _, c := range cases {
		rec := send(h, http.MethodPost, "/api/v1/curseforge/author", c.body)
		if rec.Code != c.code || !strings.Contains(rec.Body.String(), c.text) {
			t.Errorf("%s -> %d %s", c.body, rec.Code, rec.Body)
		}
	}

	noKey := serverWith(t, &config.Config{CurseForgeBaseURL: cf.URL}, nil)
	if rec := send(noKey, http.MethodPost, "/api/v1/curseforge/author", `{"link":"FireBall1725"}`); rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "Core API key") {
		t.Errorf("without a key: %d %s", rec.Code, rec.Body)
	}
}
