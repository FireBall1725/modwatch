// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"
)

// The web client's mock fixtures were the contract the pages were built against. These tests load them and
// check that the real handlers, run against a seeded in-memory database, produce the same recursive key set.
// An empty array, an empty object or a null carries no keys, so on either side it hides everything below it.
// A list that is null where the fixture has an array is always an error.

const fixtureDir = "../../web/src/mocks/fixtures"

// shapeOf records every path seen in a JSON tree, which kinds of value sat at each, and which paths have children.
type shapeOf struct {
	kinds    map[string]map[string]bool
	children map[string]bool
}

func newShape() *shapeOf {
	return &shapeOf{kinds: map[string]map[string]bool{}, children: map[string]bool{}}
}

func kindOf(v any) string {
	switch v.(type) {
	case nil:
		return "null"
	case map[string]any:
		return "object"
	case []any:
		return "array"
	case string:
		return "string"
	case bool:
		return "bool"
	default:
		return "number"
	}
}

// add walks v into the shape. Paths listed in dyn are maps keyed by data (slugs, versions), whose keys collapse to "*".
func (s *shapeOf) add(v any, path string, dyn map[string]bool) {
	k := kindOf(v)
	if s.kinds[path] == nil {
		s.kinds[path] = map[string]bool{}
	}
	s.kinds[path][k] = true
	switch x := v.(type) {
	case map[string]any:
		for key, child := range x {
			if dyn[path] {
				key = "*"
			}
			cp := path + "/" + key
			s.children[path] = true
			s.add(child, cp, dyn)
		}
	case []any:
		for _, child := range x {
			cp := path + "[]"
			s.children[path] = true
			s.add(child, cp, dyn)
		}
	}
}

func (s *shapeOf) nonNull(path string) map[string]bool {
	out := map[string]bool{}
	for k := range s.kinds[path] {
		if k != "null" {
			out[k] = true
		}
	}
	return out
}

// missingIn lists paths that are in s but absent from other, ignoring those below a null or empty container in other.
func (s *shapeOf) missingIn(other *shapeOf) []string {
	var out []string
	for p := range s.kinds {
		if _, ok := other.kinds[p]; ok {
			continue
		}
		anc := p
		for {
			i := strings.LastIndexAny(anc, "/[")
			if i < 0 {
				anc = ""
				break
			}
			anc = anc[:i]
			if _, ok := other.kinds[anc]; ok {
				break
			}
		}
		if other.children[anc] {
			out = append(out, p)
		}
	}
	sort.Strings(out)
	return out
}

// typeClashes lists paths where both sides have real values of different JSON kinds.
func (s *shapeOf) typeClashes(other *shapeOf) []string {
	var out []string
	for p := range s.kinds {
		a, b := s.nonNull(p), other.nonNull(p)
		if len(a) == 0 || len(b) == 0 {
			continue
		}
		same := false
		for k := range a {
			if b[k] {
				same = true
			}
		}
		if !same {
			out = append(out, p)
		}
	}
	sort.Strings(out)
	return out
}

// nullLists lists paths that are arrays in want but null in s: the nil slice that crashes the client on .length.
func (s *shapeOf) nullLists(want *shapeOf) []string {
	var out []string
	for p, k := range want.kinds {
		if k["array"] && s.kinds[p]["null"] {
			out = append(out, p)
		}
	}
	sort.Strings(out)
	return out
}

func loadFixture(t *testing.T, name string) any {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(fixtureDir, name))
	if err != nil {
		t.Fatal(err)
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return v
}

func fetchJSON(t *testing.T, h http.Handler, path string) any {
	t.Helper()
	rec := get(t, h, path)
	if rec.Code != http.StatusOK {
		t.Fatalf("%s: status %d: %s", path, rec.Code, rec.Body)
	}
	var v any
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("%s: %v", path, err)
	}
	return v
}

var rfc3339UTC = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$`)

// checkTimes requires every field named "at" or ending in "At" to be an RFC 3339 UTC string (or null).
func checkTimes(t *testing.T, v any, path string) {
	t.Helper()
	switch x := v.(type) {
	case map[string]any:
		for k, child := range x {
			if k == "at" || strings.HasSuffix(k, "At") {
				if s, ok := child.(string); ok {
					if _, err := time.Parse(time.RFC3339Nano, s); err != nil || !rfc3339UTC.MatchString(s) {
						t.Errorf("%s/%s = %q is not an RFC 3339 UTC time", path, k, s)
					}
				} else if child != nil {
					t.Errorf("%s/%s = %v is not a string", path, k, child)
				}
			}
			checkTimes(t, child, path+"/"+k)
		}
	case []any:
		for _, child := range x {
			checkTimes(t, child, path+"[]")
		}
	}
}

type contractCase struct {
	name    string
	fixture string
	paths   []string
	dyn     []string
	// fixtureIsMapOfDetails marks mod-detail.json, a map of slug to detail.
	fixtureIsMapOfDetails bool
}

func TestAPIMatchesMockFixtures(t *testing.T) {
	cases := []contractCase{
		{name: "overview", fixture: "overview.json", paths: []string{"/api/v1/overview"}},
		{name: "mods", fixture: "mods.json", paths: []string{"/api/v1/mods"}},
		{name: "mod detail", fixture: "mod-detail.json", paths: []string{"/api/v1/mods/tower", "/api/v1/mods/ae2"}, fixtureIsMapOfDetails: true},
		{name: "downloads history", fixture: "downloads-history.json", paths: []string{"/api/v1/downloads/history?days=90"}, dyn: []string{"/perMod"}},
		{name: "versions", fixture: "versions.json", paths: []string{"/api/v1/versions"}, dyn: []string{"/history", "/matrix/rows[]/cells"}},
		{name: "releases", fixture: "releases.json", paths: []string{"/api/v1/releases?limit=50"}},
		{name: "issues", fixture: "issues.json", paths: []string{"/api/v1/issues?state=all"}},
		{name: "catalog", fixture: "catalog.json", paths: []string{"/api/v1/catalog"}},
		{name: "summary", fixture: "summary.json", paths: []string{"/api/v1/summary"}},
		{name: "revenue", fixture: "revenue.json", paths: []string{"/api/v1/revenue"}},
	}
	seeded := fullServer(t)
	empty := newServer(t)
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dyn := map[string]bool{}
			for _, d := range c.dyn {
				dyn[d] = true
			}
			want := newShape()
			fx := loadFixture(t, c.fixture)
			if c.fixtureIsMapOfDetails {
				for _, d := range fx.(map[string]any) {
					want.add(d, "", dyn)
				}
			} else {
				want.add(fx, "", dyn)
			}
			got := newShape()
			for _, p := range c.paths {
				body := fetchJSON(t, seeded, p)
				checkTimes(t, body, p)
				got.add(body, "", dyn)
			}
			if miss := want.missingIn(got); len(miss) > 0 {
				t.Errorf("in the fixture but not in the API output:\n  %s", strings.Join(miss, "\n  "))
			}
			if extra := got.missingIn(want); len(extra) > 0 {
				t.Errorf("in the API output but not in the fixture:\n  %s", strings.Join(extra, "\n  "))
			}
			if clash := got.typeClashes(want); len(clash) > 0 {
				t.Errorf("different JSON types:\n  %s", strings.Join(clash, "\n  "))
			}
			if nl := got.nullLists(want); len(nl) > 0 {
				t.Errorf("null where the fixture has a list:\n  %s", strings.Join(nl, "\n  "))
			}

			// An empty database must still give a list wherever the fixture has one.
			emptyShape := newShape()
			for _, p := range c.paths {
				if c.fixtureIsMapOfDetails {
					continue // an unknown slug is a 404, covered below
				}
				emptyShape.add(fetchJSON(t, empty, p), "", dyn)
			}
			if nl := emptyShape.nullLists(want); len(nl) > 0 {
				t.Errorf("empty database: null where the fixture has a list:\n  %s", strings.Join(nl, "\n  "))
			}
		})
	}
}

func TestAPIEmptyDatabaseKeepsTopLevelKeys(t *testing.T) {
	// Top-level keys of an object response never depend on the data.
	empty := newServer(t)
	for _, c := range []struct{ path, fixture string }{
		{"/api/v1/overview", "overview.json"},
		{"/api/v1/downloads/history", "downloads-history.json"},
		{"/api/v1/versions", "versions.json"},
		{"/api/v1/issues?state=all", "issues.json"},
		{"/api/v1/catalog", "catalog.json"},
	} {
		want, ok := loadFixture(t, c.fixture).(map[string]any)
		got, ok2 := fetchJSON(t, empty, c.path).(map[string]any)
		if !ok || !ok2 {
			t.Fatalf("%s: not an object", c.path)
		}
		for k := range want {
			if _, has := got[k]; !has {
				t.Errorf("%s: key %q is missing on an empty database", c.path, k)
			}
		}
		for k := range got {
			if _, has := want[k]; !has {
				t.Errorf("%s: key %q is not in the fixture", c.path, k)
			}
		}
	}
}

func TestAPIErrorsAreJSON(t *testing.T) {
	h := fullServer(t)
	for _, p := range []string{
		"/api/v1/mods/nope",
		"/api/v1/downloads/history?days=0",
		"/api/v1/downloads/history?days=3651",
		"/api/v1/downloads/history?days=abc",
		"/api/v1/releases?limit=0",
		"/api/v1/releases?limit=501",
		"/api/v1/releases?limit=x",
		"/api/v1/issues?state=bogus",
	} {
		rec := get(t, h, p)
		if rec.Code != http.StatusNotFound && rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d", p, rec.Code)
			continue
		}
		var body map[string]string
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body["error"] == "" {
			t.Errorf("%s: body %q is not {\"error\": ...}", p, rec.Body)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
			t.Errorf("%s: content type %q", p, ct)
		}
	}
}

// The enums in web/src/lib/types.ts, checked against everything the seeded server returns.
func TestAPIEnumsStayInsideTypes(t *testing.T) {
	allowed := map[string]map[string]bool{
		"status":      set("approved", "in_review", "changes_required", "rejected", "draft", "unlisted", "archived", "inactive", "unknown"),
		"health":      set("ok", "attention", "problem"),
		"severity":    set("problem", "warning", "info"),
		"releaseType": set("release", "beta", "alpha", "unknown"),
		"platform":    set("curseforge", "modrinth"),
		"state":       set("open", "closed", "ok", "error"),
		"kind":        set("crash_open", "bug_open", "review_stuck", "review_pending", "not_approved", "missing_platform", "no_latest_minecraft", "stale_release", "source_down", "unlinked", "bug", "crash", "enhancement", "compatibility", "question", "other"),
	}
	h := fullServer(t)
	var visit func(path string, v any)
	visit = func(path string, v any) {
		switch x := v.(type) {
		case map[string]any:
			for k, child := range x {
				if s, ok := child.(string); ok && allowed[k] != nil && !allowed[k][s] {
					t.Errorf("%s/%s = %q is outside the contract", path, k, s)
				}
				visit(path+"/"+k, child)
			}
		case []any:
			for _, child := range x {
				visit(path+"[]", child)
			}
		}
	}
	for _, p := range []string{
		"/api/v1/overview", "/api/v1/mods", "/api/v1/mods/tower", "/api/v1/mods/ae2", "/api/v1/releases",
		"/api/v1/issues?state=all", "/api/v1/summary",
	} {
		visit(p, fetchJSON(t, h, p))
	}
}

func set(items ...string) map[string]bool {
	m := map[string]bool{}
	for _, i := range items {
		m[i] = true
	}
	return m
}
