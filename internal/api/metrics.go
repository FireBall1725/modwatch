// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/repository"
	"github.com/fireball1725/modwatch/internal/version"
)

// metrics writes the Prometheus text format by hand; a handful of series don't need a client library.
//
// The per-mod series is typed counter so rate() and increase() work on it. CurseForge occasionally
// recounts downward, which Prometheus reads as a counter reset and handles.
func (h *handlers) metrics(w http.ResponseWriter, r *http.Request) {
	// Answering 404 rather than an empty page makes the Prometheus target show as down, which is the truth.
	if !h.effective(r.Context()).MetricsOn() {
		http.Error(w, "metrics are turned off in Settings", http.StatusNotFound)
		return
	}
	stats, err := h.repo.ListModStats(r.Context(), time.Now())
	if err != nil {
		http.Error(w, "couldn't read mods", http.StatusInternalServerError)
		return
	}
	last, err := h.repo.LatestPoll(r.Context())
	if err != nil {
		http.Error(w, "couldn't read polls", http.StatusInternalServerError)
		return
	}
	lastOK, err := h.repo.LatestOKPoll(r.Context())
	if err != nil {
		http.Error(w, "couldn't read polls", http.StatusInternalServerError)
		return
	}

	files, err := h.repo.ListFileStats(r.Context(), time.Now())
	if err != nil {
		http.Error(w, "couldn't read files", http.StatusInternalServerError)
		return
	}
	sources, err := h.repo.ListSourceStatuses(r.Context())
	if err != nil {
		http.Error(w, "couldn't read sources", http.StatusInternalServerError)
		return
	}

	issues, err := h.repo.ListIssues(r.Context(), "open")
	if err != nil {
		http.Error(w, "couldn't read issues", http.StatusInternalServerError)
		return
	}
	ix, err := h.repo.CatalogIndex(r.Context())
	if err != nil {
		http.Error(w, "couldn't read the catalog", http.StatusInternalServerError)
		return
	}

	v, err := h.load(r.Context(), true)
	if err != nil {
		http.Error(w, "couldn't read the dashboard data", http.StatusInternalServerError)
		return
	}

	var b strings.Builder
	head := func(name, kind, help string) {
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s %s\n", name, help, name, kind)
	}

	head("modwatch_build_info", "gauge", "Always 1; the version label carries the running build.")
	fmt.Fprintf(&b, "modwatch_build_info{version=%s} 1\n", quote(version.String()))

	head("modwatch_mod_downloads_total", "counter", "Lifetime downloads CurseForge reports for a mod, as of the last successful poll.")
	for _, s := range stats {
		fmt.Fprintf(&b, "modwatch_mod_downloads_total{id=%s,slug=%s,name=%s,owned=%s} %d\n",
			quote(strconv.Itoa(s.ID)), quote(s.Slug), quote(s.Name), quote(strconv.FormatBool(s.Owned)), s.Downloads)
	}

	owned, member := 0, 0
	for _, g := range v.groups {
		if g.owned {
			owned++
		} else {
			member++
		}
	}
	head("modwatch_mods", "gauge", "Mods on the dashboard (registry entries, any platform), by whether the author owns them or is only a member.")
	fmt.Fprintf(&b, "modwatch_mods{owned=\"true\"} %d\nmodwatch_mods{owned=\"false\"} %d\n", owned, member)

	if last != nil {
		ok := 0
		if last.State == models.PollOK {
			ok = 1
		}
		head("modwatch_last_poll_success", "gauge", "1 if the most recent poll succeeded.")
		fmt.Fprintf(&b, "modwatch_last_poll_success %d\n", ok)
		head("modwatch_last_poll_timestamp_seconds", "gauge", "When the most recent poll finished.")
		fmt.Fprintf(&b, "modwatch_last_poll_timestamp_seconds %d\n", last.FinishedAt.Unix())
		head("modwatch_last_poll_duration_seconds", "gauge", "How long the most recent poll took.")
		fmt.Fprintf(&b, "modwatch_last_poll_duration_seconds %.3f\n", last.FinishedAt.Sub(last.StartedAt).Seconds())
	}
	if lastOK != nil {
		head("modwatch_last_success_timestamp_seconds", "gauge", "When the most recent successful poll finished; alert on this going stale.")
		fmt.Fprintf(&b, "modwatch_last_success_timestamp_seconds %d\n", lastOK.FinishedAt.Unix())
	}

	writeFileMetrics(&b, head, v, files)
	writeIssueMetrics(&b, head, ix, issues, time.Now())
	writeProjectMetrics(&b, head, v)

	if len(sources) > 0 {
		head("modwatch_source_up", "gauge", "1 if the last attempt to read a source fully worked. The mod list can succeed while a source's files fail.")
		for _, st := range sources {
			up := 0
			if st.OK {
				up = 1
			}
			fmt.Fprintf(&b, "modwatch_source_up{source=%s} %d\n", quote(st.Source), up)
		}
		head("modwatch_source_last_success_timestamp_seconds", "gauge", "When a source was last read without any error.")
		for _, st := range sources {
			if !st.LastOKAt.IsZero() {
				fmt.Fprintf(&b, "modwatch_source_last_success_timestamp_seconds{source=%s} %d\n", quote(st.Source), st.LastOKAt.Unix())
			}
		}
	}

	if h.effective(r.Context()).RevenueOn() {
		if rows, err := h.repo.Revenue(r.Context()); err == nil && len(rows) > 0 {
			for _, m := range []struct {
				name, help string
				pick       func(models.Revenue) float64
			}{
				{"modwatch_revenue_available", "What the platform owes the author and has released for payout, in the currency label.", func(x models.Revenue) float64 { return x.Available }},
				{"modwatch_revenue_pending", "What the platform owes the author that isn't released for payout yet.", func(x models.Revenue) float64 { return x.Pending }},
				{"modwatch_revenue_withdrawn_ytd", "What the author has withdrawn from the platform this year.", func(x models.Revenue) float64 { return x.WithdrawnYTD }},
				{"modwatch_revenue_withdrawn_lifetime", "What the author has withdrawn from the platform in total.", func(x models.Revenue) float64 { return x.WithdrawnLifetime }},
			} {
				head(m.name, "gauge", m.help)
				for _, rev := range rows {
					fmt.Fprintf(&b, "%s{platform=%s,currency=%s} %g\n", m.name, quote(rev.Platform), quote(rev.Currency), m.pick(rev))
				}
			}
		}
	}

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = w.Write([]byte(b.String()))
}

// quote escapes a label value the way the exposition format wants: backslash, double quote and newline.
func quote(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`)
	return `"` + r.Replace(s) + `"`
}

// writeFileMetrics writes the per-file series and the per-mod Minecraft version and loader roll-ups.
//
// The roll-ups attribute a file to every version or loader it targets, so summing a roll-up across
// versions counts a multi-version file once per version. Use the file series for exact totals.
func writeFileMetrics(b *strings.Builder, head func(name, kind, help string), v *view, files []models.FileStat) {
	if len(files) == 0 {
		return
	}
	// The slug is the registry slug, as on the project series; a file with no registry entry keeps its platform slug.
	slugOf := func(f models.FileStat) string {
		if g := v.byKey[fileKey(f)]; g != nil {
			return g.slug
		}
		return f.ProjectSlug
	}
	head("modwatch_file_downloads_total", "counter", "Downloads of one file (CurseForge) or version (Modrinth); id is the platform's file or version id. CurseForge's per-file counts don't add up to the mod's total.")
	for _, f := range files {
		fmt.Fprintf(b, "modwatch_file_downloads_total{source=%s,slug=%s,name=%s,id=%s,version=%s,release_type=%s,game_versions=%s,loaders=%s} %d\n",
			quote(f.Source), quote(slugOf(f)), quote(f.ProjectName), quote(f.ID), quote(f.Version), quote(f.ReleaseType),
			quote(strings.Join(f.GameVersions, ",")), quote(strings.Join(f.Loaders, ",")), f.Downloads)
	}

	type key struct{ source, slug, name, value string }
	rollup := func(pick func(models.File) []string) ([]key, map[key]int64) {
		sums := map[key]int64{}
		for _, f := range files {
			for _, val := range pick(f.File) {
				sums[key{f.Source, slugOf(f), f.ProjectName, val}] += f.Downloads
			}
		}
		keys := make([]key, 0, len(sums))
		for k := range sums {
			keys = append(keys, k)
		}
		sort.Slice(keys, func(i, j int) bool {
			a, c := keys[i], keys[j]
			return a.source+"\x00"+a.slug+"\x00"+a.value < c.source+"\x00"+c.slug+"\x00"+c.value
		})
		return keys, sums
	}

	head("modwatch_game_version_downloads_total", "counter", "File downloads per mod and Minecraft version targeted. A file targeting several versions counts toward each.")
	keys, sums := rollup(gameVersionsOf)
	for _, k := range keys {
		fmt.Fprintf(b, "modwatch_game_version_downloads_total{source=%s,slug=%s,name=%s,game_version=%s} %d\n",
			quote(k.source), quote(k.slug), quote(k.name), quote(k.value), sums[k])
	}
	head("modwatch_loader_downloads_total", "counter", "File downloads per mod and mod loader targeted. A file targeting several loaders counts toward each.")
	keys, sums = rollup(loadersOf)
	for _, k := range keys {
		fmt.Fprintf(b, "modwatch_loader_downloads_total{source=%s,slug=%s,name=%s,loader=%s} %d\n",
			quote(k.source), quote(k.slug), quote(k.name), quote(k.value), sums[k])
	}
}

// writeIssueMetrics writes open issues per mod and kind, and the age of the oldest open bug or crash per mod.
// The mod label is the registry slug, the raw GitHub label for an unlinked one, and "unlabelled" for none.
func writeIssueMetrics(b *strings.Builder, head func(name, kind, help string), ix *repository.CatalogIndex, open []models.Issue, now time.Time) {
	type key struct{ mod, kind string }
	counts := map[key]int{}
	oldestBug := map[string]time.Time{}
	for _, is := range open {
		mod, _ := issueModKey(ix, is)
		if mod == "" {
			mod = "unlabelled"
		}
		counts[key{mod, is.Kind}]++
		if is.Kind == models.KindBug || is.Kind == models.KindCrash {
			if o, ok := oldestBug[mod]; !ok || is.CreatedAt.Before(o) {
				oldestBug[mod] = is.CreatedAt
			}
		}
	}
	if len(counts) == 0 {
		return
	}
	keys := make([]key, 0, len(counts))
	for k := range counts {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].mod != keys[j].mod {
			return keys[i].mod < keys[j].mod
		}
		return keys[i].kind < keys[j].kind
	})
	head("modwatch_issues_open", "gauge", "Open GitHub issues per mod and kind.")
	for _, k := range keys {
		fmt.Fprintf(b, "modwatch_issues_open{mod=%s,kind=%s} %d\n", quote(k.mod), quote(k.kind), counts[k])
	}
	if len(oldestBug) == 0 {
		return
	}
	mods := make([]string, 0, len(oldestBug))
	for m := range oldestBug {
		mods = append(mods, m)
	}
	sort.Strings(mods)
	head("modwatch_oldest_open_bug_age_seconds", "gauge", "Age of the oldest open bug or crash issue, for mods that have one.")
	for _, m := range mods {
		fmt.Fprintf(b, "modwatch_oldest_open_bug_age_seconds{mod=%s} %d\n", quote(m), int64(now.Sub(oldestBug[m]).Seconds()))
	}
}

// writeProjectMetrics writes the per-project series and each mod's health.
// The slug label is the registry slug, so the series join to the issue metrics and to each other.
func writeProjectMetrics(b *strings.Builder, head func(name, kind, help string), v *view) {
	groups := append([]*group{}, v.groups...)
	sort.Slice(groups, func(i, j int) bool { return groups[i].slug < groups[j].slug })

	type row struct {
		g *group
		p *models.PlatformStat
	}
	var rows []row
	for _, g := range groups {
		for _, p := range g.projects() {
			rows = append(rows, row{g, p})
		}
	}
	if len(rows) == 0 {
		return
	}

	head("modwatch_project_downloads_total", "counter", "Lifetime downloads a platform reports for a project, as of the last poll that read that platform.")
	for _, r := range rows {
		fmt.Fprintf(b, "modwatch_project_downloads_total{platform=%s,slug=%s,name=%s} %d\n",
			quote(r.p.Platform), quote(r.g.slug), quote(r.p.Name), r.p.Downloads)
	}
	head("modwatch_project_review_status", "gauge", "1 for the project's current review status; the status label is the shared vocabulary.")
	for _, r := range rows {
		fmt.Fprintf(b, "modwatch_project_review_status{platform=%s,slug=%s,status=%s} 1\n",
			quote(r.p.Platform), quote(r.g.slug), quote(string(r.p.Status)))
	}

	wroteQueue := false
	for _, r := range rows {
		if r.p.Status != models.StatusInReview {
			continue
		}
		since := v.reviewSince(r.p)
		if since.IsZero() {
			continue
		}
		if !wroteQueue {
			head("modwatch_project_review_queue_seconds", "gauge", "How long a project has been in review, while it is.")
			wroteQueue = true
		}
		fmt.Fprintf(b, "modwatch_project_review_queue_seconds{platform=%s,slug=%s} %d\n",
			quote(r.p.Platform), quote(r.g.slug), int64(v.ds.now.Sub(since).Seconds()))
	}

	wroteHealth := false
	for _, g := range groups {
		if !g.owned {
			continue
		}
		if !wroteHealth {
			head("modwatch_mod_health", "gauge", "1 for the mod's current health: ok, attention or problem.")
			wroteHealth = true
		}
		fmt.Fprintf(b, "modwatch_mod_health{slug=%s,health=%s} 1\n", quote(g.slug), quote(v.summary(g).Health))
	}
}
