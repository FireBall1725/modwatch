// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/fireball1725/modwatch/internal/mcver"
	"github.com/fireball1725/modwatch/internal/models"
)

const (
	healthOK        = "ok"
	healthAttention = "attention"
	healthProblem   = "problem"

	sevProblem = "problem"
	sevWarning = "warning"
	sevInfo    = "info"
)

const (
	// reviewStuckAfter is how long a project may sit in review before it is called stuck.
	reviewStuckAfter = 7 * 24 * time.Hour
	// recentReleaseWindow is how recent a release must be for a missing newest Minecraft version to matter.
	recentReleaseMonths = 12
)

func severityRank(s string) int {
	switch s {
	case sevProblem:
		return 0
	case sevWarning:
		return 1
	}
	return 2
}

// healthOf rolls attention items up: any problem is problem, else any warning is attention, else ok.
// Info items never change health.
func healthOf(items []attentionItem) string {
	h := healthOK
	for _, it := range items {
		switch it.Severity {
		case sevProblem:
			return healthProblem
		case sevWarning:
			h = healthAttention
		}
	}
	return h
}

// reviewSince is when a project entered review: the platform's queue time, else when Modrinth first saw it there.
func (v *view) reviewSince(p *models.PlatformStat) time.Time {
	if !p.QueuedAt.IsZero() {
		return p.QueuedAt
	}
	return v.ds.seen[keyOf(p)]
}

// attentionFor lists what is wrong or worth knowing about one owned mod, worst first.
func (v *view) attentionFor(g *group) []attentionItem {
	now := v.ds.now
	slug := g.slug
	items := []attentionItem{}
	add := func(sev, kind, title, detail string, url *string) {
		items = append(items, attentionItem{Severity: sev, Kind: kind, ModSlug: &slug, Title: title, Detail: detail, URL: url})
	}

	for _, is := range v.issuesOf[g.slug] {
		if is.State != "open" {
			continue
		}
		u := strPtr(is.URL)
		switch is.Kind {
		case models.KindCrash:
			add(sevProblem, "crash_open", fmt.Sprintf("%s has an open crash (#%d)", g.name, is.Number), is.Title, u)
		case models.KindBug:
			add(sevWarning, "bug_open", fmt.Sprintf("%s has an open bug (#%d)", g.name, is.Number), is.Title, u)
		}
	}

	for _, p := range g.projects() {
		where := platformName(p.Platform)
		detail := p.StatusMessage
		if detail == "" {
			detail = p.RawStatus
		}
		switch p.Status {
		case models.StatusRejected:
			add(sevProblem, "not_approved", fmt.Sprintf("%s was rejected on %s", g.name, where), detail, strPtr(p.URL))
		case models.StatusChangesRequired:
			add(sevProblem, "not_approved", fmt.Sprintf("%s needs changes on %s", g.name, where), detail, strPtr(p.URL))
		case models.StatusDraft:
			add(sevWarning, "not_approved", fmt.Sprintf("%s is a draft on %s", g.name, where), detail, strPtr(p.URL))
		case models.StatusUnlisted:
			add(sevWarning, "not_approved", fmt.Sprintf("%s is unlisted on %s", g.name, where), detail, strPtr(p.URL))
		case models.StatusInReview:
			since := v.reviewSince(p)
			age := time.Duration(0)
			if !since.IsZero() {
				age = now.Sub(since)
			}
			days := int(age / (24 * time.Hour))
			if age > reviewStuckAfter {
				add(sevWarning, "review_stuck", fmt.Sprintf("%s has been in review on %s for %d days", g.name, where, days), detail, strPtr(p.URL))
			} else {
				add(sevInfo, "review_pending", fmt.Sprintf("%s is in review on %s", g.name, where), detail, strPtr(p.URL))
			}
		}
	}

	if v.latestMC != "" && !g.legacy() {
		if f, ok := newestFile(v.filesOf[g.slug]); ok && f.PublishedAt.After(now.AddDate(0, -recentReleaseMonths, 0)) {
			has := false
			var targets []string
			for _, fl := range v.filesOf[g.slug] {
				targets = append(targets, fl.GameVersions...)
				if containsStr(fl.GameVersions, v.latestMC) {
					has = true
				}
			}
			if !has {
				detail := "No file targets any Minecraft version"
				if len(targets) > 0 {
					detail = "Newest target is Minecraft " + mcver.Latest(targets)
				}
				add(sevWarning, "no_latest_minecraft", fmt.Sprintf("%s has no file for Minecraft %s", g.name, v.latestMC), detail, nil)
			}
		}
	}

	if (g.cf == nil) != (g.mr == nil) {
		have, lack := platformName(platCF), platformName(platMR)
		if g.cf == nil {
			have, lack = lack, have
		}
		add(sevInfo, "missing_platform", fmt.Sprintf("%s is only on %s", g.name, have), "No "+lack+" project is linked", nil)
	}

	sortAttention(items, func(string) string { return g.name })
	return items
}

// sortAttention orders problem, warning, info, then by mod name, then by title so the order is stable.
func sortAttention(items []attentionItem, nameOf func(slug string) string) {
	name := func(it attentionItem) string {
		if it.ModSlug == nil {
			return ""
		}
		return strings.ToLower(nameOf(*it.ModSlug))
	}
	sort.SliceStable(items, func(i, j int) bool {
		a, b := items[i], items[j]
		if ra, rb := severityRank(a.Severity), severityRank(b.Severity); ra != rb {
			return ra < rb
		}
		if na, nb := name(a), name(b); na != nb {
			return na < nb
		}
		return a.Title < b.Title
	})
}

// globalAttention lists what isn't about one mod: sources that failed and issue labels nobody claims.
func (v *view) globalAttention() []attentionItem {
	items := []attentionItem{}
	for _, s := range v.ds.sources {
		if s.OK {
			continue
		}
		detail := s.Error
		if detail == "" {
			detail = "The last check failed"
		}
		items = append(items, attentionItem{
			Severity: sevWarning, Kind: "source_down", Title: platformName(s.Source) + " could not be read", Detail: detail,
		})
	}
	for _, l := range unlinkedLabels(v.ds.ix, v.ds.issues) {
		noun := "issues"
		if l.Issues == 1 {
			noun = "issue"
		}
		items = append(items, attentionItem{
			Severity: sevInfo, Kind: "unlinked", Title: fmt.Sprintf("Issue label \"mod: %s\" matches no mod", l.Label),
			Detail: fmt.Sprintf("%d %s carry it", l.Issues, noun),
		})
	}
	return items
}

// attention is the overview list: every visible owned mod's items plus the global ones.
func (v *view) attention(mods []modSummary) []attentionItem {
	items := v.globalAttention()
	names := map[string]string{}
	for _, m := range mods {
		names[m.Slug] = m.Name
		items = append(items, m.Attention...)
	}
	sortAttention(items, func(slug string) string { return names[slug] })
	return items
}
