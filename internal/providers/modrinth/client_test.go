// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package modrinth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRequestsCarryTheUserAgentAndOptionalToken(t *testing.T) {
	var gotUA, gotAuth, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUA, gotAuth, gotPath = r.Header.Get("User-Agent"), r.Header.Get("Authorization"), r.URL.Path
		_, _ = w.Write([]byte(`[{"id":"P1","slug":"graves","title":"Graves","downloads":7}]`))
	}))
	defer srv.Close()

	projects, err := New(srv.URL, "", "modwatch/test").ListProjects(context.Background(), "some user")
	if err != nil {
		t.Fatal(err)
	}
	if len(projects) != 1 || projects[0].Downloads != 7 {
		t.Errorf("projects = %+v", projects)
	}
	if gotUA != "modwatch/test" || gotAuth != "" {
		t.Errorf("agent %q, auth %q: a client with no token must send no Authorization header", gotUA, gotAuth)
	}
	if !strings.HasSuffix(gotPath, "/v2/user/some user/projects") && !strings.Contains(gotPath, "some") {
		t.Errorf("path = %q", gotPath)
	}

	if _, err := New(srv.URL, "tok", "modwatch/test").ListVersions(context.Background(), "P1"); err != nil {
		t.Fatal(err)
	}
	if gotAuth != "tok" {
		t.Errorf("auth = %q, want the token", gotAuth)
	}
}

func TestListVersionsDecodesDownloadsAndTargets(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`[{"id":"V1","name":"n","version_number":"1.0","version_type":"beta","downloads":14,"game_versions":["1.21.1"],"loaders":["neoforge"],"date_published":"2026-11-15T00:00:00Z"}]`))
	}))
	defer srv.Close()
	vs, err := New(srv.URL, "", "ua").ListVersions(context.Background(), "P1")
	if err != nil || len(vs) != 1 {
		t.Fatalf("%v %v", vs, err)
	}
	v := vs[0]
	if v.Downloads != 14 || v.GameVersions[0] != "1.21.1" || v.Loaders[0] != "neoforge" || v.VersionType != "beta" {
		t.Errorf("version = %+v", v)
	}
}

func TestErrorsNameTheProblemWithoutTheToken(t *testing.T) {
	for code, want := range map[int]string{http.StatusUnauthorized: "refused", http.StatusTooManyRequests: "rate limited", http.StatusTeapot: "418"} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(code) }))
		_, err := New(srv.URL, "secret-token", "ua").ListProjects(context.Background(), "u")
		srv.Close()
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("status %d: error = %v, want it to mention %q", code, err, want)
		}
		if err != nil && strings.Contains(err.Error(), "secret-token") {
			t.Errorf("status %d: the error leaked the token", code)
		}
	}
}

func TestBalanceReadsTheDecimalStringsAndGroupsByMonth(t *testing.T) {
	var gotPath, gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotAuth = r.URL.Path, r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"available":"0.2971","pending":"0.0884","withdrawn_lifetime":"3.5","withdrawn_ytd":"1.25",
			"dates":{"2026-10-01T00:00:00Z":"0.01","2026-10-15T00:00:00Z":"0.02","2026-11-01T00:00:00Z":"0.05"}}`))
	}))
	defer srv.Close()
	b, err := New(srv.URL, "tok", "modwatch/test").Balance(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if gotPath != "/v3/payout/balance" || gotAuth != "tok" {
		t.Errorf("path %q auth %q", gotPath, gotAuth)
	}
	if b.Available != 0.2971 || b.Pending != 0.0884 || b.WithdrawnLifetime != 3.5 || b.WithdrawnYTD != 1.25 {
		t.Errorf("balance = %+v", b)
	}
	if len(b.Months) != 2 || b.Months["2026-10"] < 0.0299 || b.Months["2026-10"] > 0.0301 || b.Months["2026-11"] != 0.05 {
		t.Errorf("months = %v", b.Months)
	}
}
