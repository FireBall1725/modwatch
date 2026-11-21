// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/repository"
)

type issueItem struct {
	Repo      string   `json:"repo"`
	Number    int      `json:"number"`
	Title     string   `json:"title"`
	State     string   `json:"state"`
	URL       string   `json:"url"`
	ModSlug   *string  `json:"modSlug"`
	ModName   *string  `json:"modName"`
	ModLabel  *string  `json:"modLabel"`
	Kind      string   `json:"kind"`
	Labels    []string `json:"labels"`
	Author    string   `json:"author"`
	Comments  int      `json:"comments"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
	ClosedAt  *string  `json:"closedAt"`
}

type issuesByMod struct {
	Slug         string  `json:"slug"`
	Name         string  `json:"name"`
	Open         int     `json:"open"`
	Bugs         int     `json:"bugs"`
	Crashes      int     `json:"crashes"`
	OldestOpenAt *string `json:"oldestOpenAt"`
}

type issuesByKind struct {
	Kind string `json:"kind"`
	Open int    `json:"open"`
}

type issuesSummary struct {
	Open         int            `json:"open"`
	Closed       int            `json:"closed"`
	OpenBugs     int            `json:"openBugs"`
	OpenCrashes  int            `json:"openCrashes"`
	OldestOpenAt *string        `json:"oldestOpenAt"`
	ByMod        []issuesByMod  `json:"byMod"`
	ByKind       []issuesByKind `json:"byKind"`
}

type issuesResponse struct {
	// Repo is the shared issues repository; Repos is every repository being read, the shared one first.
	Repo    string        `json:"repo"`
	Repos   []string      `json:"repos"`
	Summary issuesSummary `json:"summary"`
	Issues  []issueItem   `json:"issues"`
}

func rfc3339(t time.Time) string { return t.UTC().Format(time.RFC3339) }

func rfc3339Ptr(t time.Time) *string {
	if t.IsZero() {
		return nil
	}
	s := rfc3339(t)
	return &s
}

// modOf maps an issue to its registry entry: the entry whose own repository the issue lives in, else the entry that
// claims its `mod:` label. ok is false when neither applies.
func modOf(ix *repository.CatalogIndex, is models.Issue) (slug, name string, ok bool) {
	if is.Repo != "" {
		if slug, found := ix.SlugForRepo(is.Repo); found {
			e, _ := ix.Entry(slug)
			return slug, e.Name, true
		}
	}
	if is.ModLabel == "" {
		return "", "", false
	}
	slug, found := ix.SlugForLabel(is.ModLabel)
	if !found {
		return "", "", false
	}
	e, _ := ix.Entry(slug)
	return slug, e.Name, true
}

// issueModKey is the slug for a linked issue, the raw label for an unlinked one, and "" for no label.
func issueModKey(ix *repository.CatalogIndex, is models.Issue) (key, name string) {
	if slug, n, ok := modOf(ix, is); ok {
		return slug, n
	}
	return is.ModLabel, is.ModLabel
}

func toIssueItem(ix *repository.CatalogIndex, is models.Issue) issueItem {
	it := issueItem{
		Repo: is.Repo, Number: is.Number, Title: is.Title, State: is.State, URL: is.URL, Kind: is.Kind,
		Labels: is.Labels, Author: is.Author, Comments: is.Comments,
		CreatedAt: rfc3339(is.CreatedAt), UpdatedAt: rfc3339(is.UpdatedAt), ClosedAt: rfc3339Ptr(is.ClosedAt),
	}
	if it.Labels == nil {
		it.Labels = []string{}
	}
	if is.ModLabel != "" {
		l := is.ModLabel
		it.ModLabel = &l
	}
	if slug, name, ok := modOf(ix, is); ok {
		it.ModSlug, it.ModName = &slug, &name
	}
	return it
}

// summarize counts every stored issue, whatever state the list was filtered to.
func summarize(ix *repository.CatalogIndex, all []models.Issue) issuesSummary {
	s := issuesSummary{ByMod: []issuesByMod{}, ByKind: []issuesByKind{}}
	kinds := map[string]int{}
	mods := map[string]*issuesByMod{}
	var oldest time.Time
	oldestByMod := map[string]time.Time{}
	for _, is := range all {
		if is.State != "open" {
			s.Closed++
			continue
		}
		s.Open++
		kinds[is.Kind]++
		if oldest.IsZero() || is.CreatedAt.Before(oldest) {
			oldest = is.CreatedAt
		}
		if is.Kind == models.KindBug {
			s.OpenBugs++
		}
		if is.Kind == models.KindCrash {
			s.OpenCrashes++
		}
		key, name := issueModKey(ix, is)
		if key == "" {
			continue
		}
		m := mods[key]
		if m == nil {
			m = &issuesByMod{Slug: key, Name: name}
			mods[key] = m
		}
		m.Open++
		if is.Kind == models.KindBug {
			m.Bugs++
		}
		if is.Kind == models.KindCrash {
			m.Crashes++
		}
		if o := oldestByMod[key]; o.IsZero() || is.CreatedAt.Before(o) {
			oldestByMod[key] = is.CreatedAt
		}
	}
	s.OldestOpenAt = rfc3339Ptr(oldest)
	for key, m := range mods {
		m.OldestOpenAt = rfc3339Ptr(oldestByMod[key])
		s.ByMod = append(s.ByMod, *m)
	}
	sort.Slice(s.ByMod, func(i, j int) bool {
		a, b := s.ByMod[i], s.ByMod[j]
		if a.Open != b.Open {
			return a.Open > b.Open
		}
		return strings.ToLower(a.Name) < strings.ToLower(b.Name)
	})
	for _, k := range models.IssueKinds {
		s.ByKind = append(s.ByKind, issuesByKind{Kind: k, Open: kinds[k]})
	}
	return s
}

// unlinkedLabels counts the issues carrying each label that no catalog entry claims.
func unlinkedLabels(ix *repository.CatalogIndex, all []models.Issue) []gitHubLabel {
	counts := map[string]int{}
	for _, is := range all {
		if is.ModLabel == "" {
			continue
		}
		if _, ok := ix.SlugForRepo(is.Repo); ok && is.Repo != "" {
			continue // the mod owns this repository, so its labels aren't how the issue is linked
		}
		if _, ok := ix.SlugForLabel(is.ModLabel); !ok {
			counts[is.ModLabel]++
		}
	}
	out := make([]gitHubLabel, 0, len(counts))
	for l, n := range counts {
		out = append(out, gitHubLabel{Label: l, Issues: n})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Issues != out[j].Issues {
			return out[i].Issues > out[j].Issues
		}
		return out[i].Label < out[j].Label
	})
	return out
}

// issueRepos lists the repositories being read: the shared one first, then each mod's own, without repeats.
func issueRepos(shared string, ix *repository.CatalogIndex) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, r := range append([]string{shared}, ix.Repos()...) {
		if k := strings.ToLower(r); r != "" && !seen[k] {
			seen[k] = true
			out = append(out, r)
		}
	}
	return out
}

func (h *handlers) listIssues(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	if state == "" {
		state = "open"
	}
	if state != "open" && state != "closed" && state != "all" {
		writeError(w, http.StatusBadRequest, "state must be open, closed or all")
		return
	}
	all, err := h.repo.ListIssues(r.Context(), "all")
	if err != nil {
		slog.Error("reading issues", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't read issues")
		return
	}
	ix, err := h.repo.CatalogIndex(r.Context())
	if err != nil {
		slog.Error("reading catalog", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't read the catalog")
		return
	}
	shared := h.effective(r.Context()).GitHubIssuesRepo
	out := issuesResponse{Repo: shared, Repos: issueRepos(shared, ix), Summary: summarize(ix, all), Issues: []issueItem{}}
	// ListIssues sorts newest updated first, so filtering keeps that order.
	for _, is := range all {
		if state == "all" || is.State == state {
			out.Issues = append(out.Issues, toIssueItem(ix, is))
		}
	}
	writeJSON(w, http.StatusOK, out)
}
