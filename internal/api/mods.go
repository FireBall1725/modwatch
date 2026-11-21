// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/version"
)

const (
	defaultHistoryDays = 90
	maxHistoryDays     = 3650
	defaultReleases    = 50
	maxReleases        = 500
	overviewReleases   = 10
	// detailHistoryDays is how far back a mod page's chart goes.
	detailHistoryDays = 90
)

// load reads everything the composed endpoints need.
func (h *handlers) load(ctx context.Context, showLegacy bool) (*view, error) {
	now := h.now()
	cfg := h.effective(ctx)
	ds := &dataset{now: now, ghRepo: cfg.GitHubIssuesRepo, dismissed: map[dismissKey]bool{}}
	var err error
	if ds.stats, err = h.repo.ListPlatformStats(ctx, now); err != nil {
		return nil, err
	}
	if ds.files, err = h.repo.ListFileStats(ctx, now); err != nil {
		return nil, err
	}
	ds.files = trackedFiles(ds.files, cfg.DisabledMinecraftVersions)
	if ds.entries, err = h.repo.ListCatalog(ctx); err != nil {
		return nil, err
	}
	if ds.issues, err = h.repo.ListIssues(ctx, "all"); err != nil {
		return nil, err
	}
	if ds.seen, err = h.repo.ReviewSeen(ctx); err != nil {
		return nil, err
	}
	if ds.sources, err = h.repo.ListSourceStatuses(ctx); err != nil {
		return nil, err
	}
	dis, err := h.repo.Dismissals(ctx)
	if err != nil {
		return nil, err
	}
	for _, d := range dis {
		ds.dismissed[dismissKey{d.Kind, d.ModSlug}] = true
	}
	for _, p := range cfg.Problems() {
		ds.problems = append(ds.problems, p.Error())
	}
	return newView(ds, showLegacy), nil
}

// wantsLegacy reports whether the request asked for mods marked legacy (?legacy=1). The UI's switch sets it.
func wantsLegacy(r *http.Request) bool { return r.URL.Query().Get("legacy") == "1" }

func (h *handlers) loadOr500(w http.ResponseWriter, r *http.Request) *view {
	v, err := h.load(r.Context(), wantsLegacy(r))
	if err != nil {
		slog.Error("reading dashboard data", "path", r.URL.Path, "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't read the dashboard data")
		return nil
	}
	return v
}

// ownedTotals adds up the visible owned mods.
func ownedTotals(mods []modSummary) modDownloads {
	var t modDownloads
	for _, m := range mods {
		if !m.Owned {
			continue
		}
		t.CurseForge += m.Downloads.CurseForge
		t.Modrinth += m.Downloads.Modrinth
		t.Delta24h = sumDelta(t.Delta24h, m.Downloads.Delta24h)
		t.Delta7d = sumDelta(t.Delta7d, m.Downloads.Delta7d)
	}
	t.Total = t.CurseForge + t.Modrinth
	return t
}

func (h *handlers) overview(w http.ResponseWriter, r *http.Request) {
	v := h.loadOr500(w, r)
	if v == nil {
		return
	}
	last, err := h.repo.LatestPoll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read polls")
		return
	}
	lastOK, err := h.repo.LatestOKPoll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "couldn't read polls")
		return
	}
	all := v.summaries()
	owned := make([]modSummary, 0, len(all))
	for _, m := range all {
		if m.Owned {
			owned = append(owned, m)
		}
	}
	issues := summarize(v.ds.ix, v.ds.issues)
	legacyMods := 0
	for _, g := range v.all {
		if g.owned && g.legacy() && !g.hidden() {
			legacyMods++
		}
	}
	out := overviewResponse{
		Version: version.String(), Schedule: h.effective(r.Context()).Schedule, Polling: h.polls.Running(),
		Totals: overviewTotals{
			Mods: len(owned), Downloads: ownedTotals(owned),
			OpenIssues: issues.Open, OpenBugs: issues.OpenBugs, OpenCrashes: issues.OpenCrashes,
			LegacyMods: legacyMods,
		},
		Attention: v.attention(owned), Dismissed: v.dismissed(owned), Mods: owned, RecentReleases: v.releases(overviewReleases),
		Sources: toSourceStatuses(v.ds.sources), LastPoll: last, LastOKPoll: lastOK, Problems: nonNilStrings(v.ds.problems),
	}
	for _, m := range owned {
		if m.Health != healthOK {
			out.Totals.NeedAttention++
		}
		for _, p := range []*platformInfo{m.CurseForge, m.Modrinth} {
			if p != nil && p.Status == string(models.StatusInReview) {
				out.Totals.InReview++
			}
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *handlers) listMods(w http.ResponseWriter, r *http.Request) {
	v := h.loadOr500(w, r)
	if v == nil {
		return
	}
	writeJSON(w, http.StatusOK, v.summaries())
}

func (h *handlers) getMod(w http.ResponseWriter, r *http.Request) {
	v := h.loadOr500(w, r)
	if v == nil {
		return
	}
	g := v.bySlug[r.PathValue("slug")]
	if g == nil {
		writeError(w, http.StatusNotFound, "no such mod")
		return
	}
	d := v.detail(g)
	days := dayRange(v.ds.now, detailHistoryDays)
	snaps, err := h.repo.PlatformHistory(r.Context(), days[0])
	if err != nil {
		slog.Error("reading history", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't read history")
		return
	}
	d.History = points([]seriesSet{v.groupSeries(g, snaps)}, days)
	writeJSON(w, http.StatusOK, d)
}

// intParam reads an optional integer query parameter within [lo, hi].
func intParam(r *http.Request, name string, def, lo, hi int) (int, bool) {
	s := r.URL.Query().Get(name)
	if s == "" {
		return def, true
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < lo || n > hi {
		return 0, false
	}
	return n, true
}

func (h *handlers) downloadsHistory(w http.ResponseWriter, r *http.Request) {
	n, ok := intParam(r, "days", defaultHistoryDays, 1, maxHistoryDays)
	if !ok {
		writeError(w, http.StatusBadRequest, "days must be between 1 and 3650")
		return
	}
	v := h.loadOr500(w, r)
	if v == nil {
		return
	}
	days := dayRange(v.ds.now, n)
	snaps, err := h.repo.PlatformHistory(r.Context(), days[0])
	if err != nil {
		slog.Error("reading history", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't read history")
		return
	}
	writeJSON(w, http.StatusOK, v.history(snaps, days))
}

// trackedFiles drops the Minecraft versions the author switched off in Settings. A file keeps only its tracked
// versions, and a file with none left is dropped. Nothing is deleted from the database, so switching a version
// back on brings its history back.
func trackedFiles(files []models.FileStat, disabled []string) []models.FileStat {
	if len(disabled) == 0 {
		return files
	}
	off := make(map[string]bool, len(disabled))
	for _, v := range disabled {
		off[v] = true
	}
	out := files[:0:0]
	for _, f := range files {
		var keep []string
		for _, v := range f.GameVersions {
			if !off[v] {
				keep = append(keep, v)
			}
		}
		if len(keep) == 0 && len(f.GameVersions) > 0 {
			continue
		}
		f.GameVersions = keep
		out = append(out, f)
	}
	return out
}

// versions answers "which Minecraft versions and loaders are people downloading for".
func (h *handlers) versions(w http.ResponseWriter, r *http.Request) {
	v := h.loadOr500(w, r)
	if v == nil {
		return
	}
	days := dayRange(v.ds.now, defaultHistoryDays)
	snaps, err := h.repo.FileHistory(r.Context(), days[0])
	if err != nil {
		slog.Error("reading file history", "error", err)
		writeError(w, http.StatusInternalServerError, "couldn't read history")
		return
	}
	writeJSON(w, http.StatusOK, v.versions(snaps, days))
}

func (h *handlers) listReleases(w http.ResponseWriter, r *http.Request) {
	n, ok := intParam(r, "limit", defaultReleases, 1, maxReleases)
	if !ok {
		writeError(w, http.StatusBadRequest, "limit must be between 1 and 500")
		return
	}
	v := h.loadOr500(w, r)
	if v == nil {
		return
	}
	writeJSON(w, http.StatusOK, v.releases(n))
}
