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
	"github.com/fireball1725/modwatch/internal/version"
)

// metrics writes the Prometheus text format by hand; a handful of series don't need a client library.
//
// The per-mod series is typed counter so rate() and increase() work on it. CurseForge occasionally
// recounts downward, which Prometheus reads as a counter reset and handles.
func (h *handlers) metrics(w http.ResponseWriter, r *http.Request) {
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

	var b strings.Builder
	head := func(name, kind, help string) {
		fmt.Fprintf(&b, "# HELP %s %s\n# TYPE %s %s\n", name, help, name, kind)
	}

	head("modwatch_build_info", "gauge", "Always 1; the version label carries the running build.")
	fmt.Fprintf(&b, "modwatch_build_info{version=%s} 1\n", quote(version.String()))

	head("modwatch_mod_downloads_total", "counter", "Lifetime downloads CurseForge reports for a mod, as of the last successful poll.")
	owned, member := 0, 0
	for _, s := range stats {
		fmt.Fprintf(&b, "modwatch_mod_downloads_total{id=%s,slug=%s,name=%s,owned=%s} %d\n",
			quote(strconv.Itoa(s.ID)), quote(s.Slug), quote(s.Name), quote(strconv.FormatBool(s.Owned)), s.Downloads)
		if s.Owned {
			owned++
		} else {
			member++
		}
	}

	head("modwatch_mods", "gauge", "Mods the last successful poll found, by whether the author owns them or is only a member.")
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

	writeFileMetrics(&b, head, files)

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
func writeFileMetrics(b *strings.Builder, head func(name, kind, help string), files []models.FileStat) {
	if len(files) == 0 {
		return
	}
	head("modwatch_file_downloads_total", "counter", "Downloads of one file (CurseForge) or version (Modrinth). CurseForge's per-file counts don't add up to the mod's total.")
	for _, f := range files {
		fmt.Fprintf(b, "modwatch_file_downloads_total{source=%s,slug=%s,name=%s,version=%s,release_type=%s,game_versions=%s,loaders=%s} %d\n",
			quote(f.Source), quote(f.ProjectSlug), quote(f.ProjectName), quote(f.Version), quote(f.ReleaseType),
			quote(strings.Join(f.GameVersions, ",")), quote(strings.Join(f.Loaders, ",")), f.Downloads)
	}

	type key struct{ source, slug, name, value string }
	rollup := func(pick func(models.File) []string) ([]key, map[key]int64) {
		sums := map[key]int64{}
		for _, f := range files {
			for _, v := range pick(f.File) {
				sums[key{f.Source, f.ProjectSlug, f.ProjectName, v}] += f.Downloads
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
