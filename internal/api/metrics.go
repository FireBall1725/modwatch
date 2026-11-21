// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"fmt"
	"net/http"
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

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = w.Write([]byte(b.String()))
}

// quote escapes a label value the way the exposition format wants: backslash, double quote and newline.
func quote(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`)
	return `"` + r.Replace(s) + `"`
}
