// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package github

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/fireball1725/modwatch/internal/models"
)

func issueJSON(n int, labels string, extra string) string {
	return fmt.Sprintf(`{"number":%d,"title":"t%d","state":"open","html_url":"https://github.com/o/r/issues/%d","comments":2,
		"created_at":"2026-01-02T03:04:05Z","updated_at":"2026-01-03T03:04:05Z","closed_at":null,
		"user":{"login":"bob"},"labels":[%s]%s}`, n, n, n, labels, extra)
}

func TestPagingAndPullRequestSkipping(t *testing.T) {
	var pages []string
	var gotAuth, gotUA string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth, gotUA = r.Header.Get("Authorization"), r.Header.Get("User-Agent")
		pages = append(pages, r.URL.Query().Get("page"))
		if r.URL.Path != "/repos/o/r/issues" || r.URL.Query().Get("state") != "all" {
			t.Errorf("bad request %s", r.URL)
		}
		var items []string
		if r.URL.Query().Get("page") == "1" {
			for i := 1; i <= 100; i++ {
				extra := ""
				if i%10 == 0 {
					extra = `,"pull_request":{"url":"x"}`
				}
				items = append(items, issueJSON(i, `{"name":"bug"}`, extra))
			}
		} else {
			items = append(items, issueJSON(101, `{"name":"mod: create-turbolifts"}`, ""))
		}
		_, _ = w.Write([]byte("[" + strings.Join(items, ",") + "]"))
	}))
	defer srv.Close()

	got, err := New(srv.URL, "o/r", "tok", "modwatch/test").ListIssues(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 2 || len(got) != 91 {
		t.Errorf("pages = %v, issues = %d, want 2 pages and 91 issues", pages, len(got))
	}
	if gotAuth != "Bearer tok" || gotUA != "modwatch/test" {
		t.Errorf("auth = %q, ua = %q", gotAuth, gotUA)
	}
	last := got[len(got)-1]
	if last.Number != 101 || last.ModLabel != "create-turbolifts" || last.Author != "bob" || last.Comments != 2 || !last.ClosedAt.IsZero() {
		t.Errorf("last = %+v", last)
	}
}

func TestNoTokenSendsNoAuthorization(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.Header["Authorization"]; ok {
			t.Error("Authorization header sent without a token")
		}
		_, _ = w.Write([]byte("[]"))
	}))
	defer srv.Close()
	got, err := New(srv.URL, "o/r", "", "ua").ListIssues(t.Context())
	if err != nil || got == nil || len(got) != 0 {
		t.Errorf("got %v, %v; want an empty non-nil list", got, err)
	}
}

func TestRateLimitErrors(t *testing.T) {
	for name, tc := range map[string]struct {
		status int
		hdr    map[string]string
		token  string
		want   string
	}{
		"403 exhausted": {403, map[string]string{"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1800000000"}, "", "rate limit reached (60 requests an hour without GITHUB_TOKEN"},
		"429":           {429, map[string]string{"Retry-After": "30"}, "s3cr3t", "rate limit reached (the token's hourly limit"},
		"plain 403":     {403, nil, "", "access to o/r was refused"},
	} {
		t.Run(name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				for k, v := range tc.hdr {
					w.Header().Set(k, v)
				}
				w.WriteHeader(tc.status)
			}))
			defer srv.Close()
			_, err := New(srv.URL, "o/r", tc.token, "ua").ListIssues(t.Context())
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Errorf("err = %v, want %q", err, tc.want)
			}
			if err != nil && tc.token != "" && strings.Contains(err.Error(), tc.token) {
				t.Error("error leaks the token")
			}
		})
	}
}

func TestKindPrecedenceAndModLabel(t *testing.T) {
	for _, tc := range []struct {
		labels []string
		kind   string
	}{
		{[]string{"bug", "crash"}, models.KindCrash},
		{[]string{"enhancement", "bug"}, models.KindBug},
		{[]string{"question", "compatibility"}, models.KindCompatibility},
		{[]string{"question", "enhancement"}, models.KindEnhancement},
		{[]string{"question"}, models.KindQuestion},
		{[]string{"documentation", "duplicate"}, models.KindOther},
		{nil, models.KindOther},
		{[]string{"Bug"}, models.KindBug},
	} {
		if got := Kind(tc.labels); got != tc.kind {
			t.Errorf("Kind(%v) = %q, want %q", tc.labels, got, tc.kind)
		}
	}
	if got := ModLabel([]string{"bug", "mod: auto-gui-scale", "mod: other"}); got != "auto-gui-scale" {
		t.Errorf("ModLabel = %q", got)
	}
	if ModLabel([]string{"bug", "mod:"}) != "" || ModLabel(nil) != "" {
		t.Error("expected no label")
	}
}
