// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import "github.com/fireball1725/modwatch/internal/models"

// These structs mirror web/src/lib/types.ts field for field. A missing value is a pointer that encodes as null,
// and a list is always built non-nil so it encodes as [].

type platformInfo struct {
	Platform        string  `json:"platform"`
	ID              string  `json:"id"`
	Slug            string  `json:"slug"`
	URL             string  `json:"url"`
	Status          string  `json:"status"`
	RawStatus       string  `json:"rawStatus"`
	StatusMessage   *string `json:"statusMessage"`
	RequestedStatus *string `json:"requestedStatus"`
	QueuedAt        *string `json:"queuedAt"`
	Downloads       int64   `json:"downloads"`
	Delta24h        *int64  `json:"delta24h"`
	Delta7d         *int64  `json:"delta7d"`
	Followers       *int64  `json:"followers"`
	PublishedAt     *string `json:"publishedAt"`
	UpdatedAt       *string `json:"updatedAt"`
	Files           int     `json:"files"`
}

type githubInfo struct {
	Label           string  `json:"label"`
	Open            int     `json:"open"`
	OpenBugs        int     `json:"openBugs"`
	OpenCrashes     int     `json:"openCrashes"`
	OldestOpenBugAt *string `json:"oldestOpenBugAt"`
}

type modDownloads struct {
	Total      int64  `json:"total"`
	CurseForge int64  `json:"curseforge"`
	Modrinth   int64  `json:"modrinth"`
	Delta24h   *int64 `json:"delta24h"`
	Delta7d    *int64 `json:"delta7d"`
}

type latestRelease struct {
	Platform          string   `json:"platform"`
	Version           string   `json:"version"`
	ReleaseType       string   `json:"releaseType"`
	PublishedAt       string   `json:"publishedAt"`
	MinecraftVersions []string `json:"minecraftVersions"`
}

type attentionItem struct {
	Severity string  `json:"severity"`
	Kind     string  `json:"kind"`
	ModSlug  *string `json:"modSlug"`
	Title    string  `json:"title"`
	Detail   string  `json:"detail"`
	URL      *string `json:"url"`
}

type modSummary struct {
	Slug              string          `json:"slug"`
	Name              string          `json:"name"`
	IconURL           string          `json:"iconUrl"`
	Summary           string          `json:"summary"`
	Owned             bool            `json:"owned"`
	Legacy            bool            `json:"legacy"`
	CurseForge        *platformInfo   `json:"curseforge"`
	Modrinth          *platformInfo   `json:"modrinth"`
	Github            *githubInfo     `json:"github"`
	Downloads         modDownloads    `json:"downloads"`
	LatestRelease     *latestRelease  `json:"latestRelease"`
	MinecraftVersions []string        `json:"minecraftVersions"`
	Loaders           []string        `json:"loaders"`
	Health            string          `json:"health"`
	Attention         []attentionItem `json:"attention"`
}

type fileItem struct {
	Platform          string   `json:"platform"`
	ID                string   `json:"id"`
	ModSlug           *string  `json:"modSlug"`
	ModName           string   `json:"modName"`
	Name              string   `json:"name"`
	Version           string   `json:"version"`
	ReleaseType       string   `json:"releaseType"`
	MinecraftVersions []string `json:"minecraftVersions"`
	Loaders           []string `json:"loaders"`
	PublishedAt       *string  `json:"publishedAt"`
	Downloads         int64    `json:"downloads"`
	Delta24h          *int64   `json:"delta24h"`
	Delta7d           *int64   `json:"delta7d"`
	URL               *string  `json:"url"`
}

type modLinks struct {
	CurseForge *string `json:"curseforge"`
	Modrinth   *string `json:"modrinth"`
	Github     *string `json:"github"`
	Source     *string `json:"source"`
	Issues     *string `json:"issues"`
	Wiki       *string `json:"wiki"`
	Discord    *string `json:"discord"`
}

type modDetail struct {
	modSummary
	Files        []fileItem      `json:"files"`
	History      []downloadPoint `json:"history"`
	GameVersions []versionTotal  `json:"gameVersions"`
	Issues       []issueItem     `json:"issues"`
	Links        modLinks        `json:"links"`
}

type downloadPoint struct {
	At         string `json:"at"`
	CurseForge int64  `json:"curseforge"`
	Modrinth   int64  `json:"modrinth"`
}

type downloadsHistory struct {
	Days   int                        `json:"days"`
	Total  []downloadPoint            `json:"total"`
	PerMod map[string][]downloadPoint `json:"perMod"`
}

type versionTotal struct {
	Name       string `json:"name"`
	Downloads  int64  `json:"downloads"`
	CurseForge int64  `json:"curseforge"`
	Modrinth   int64  `json:"modrinth"`
	Files      int    `json:"files"`
}

type matrixCell struct {
	Downloads int64    `json:"downloads"`
	Platforms []string `json:"platforms"`
}

type matrixRow struct {
	Slug    string                `json:"slug"`
	Name    string                `json:"name"`
	IconURL string                `json:"iconUrl"`
	Cells   map[string]matrixCell `json:"cells"`
}

type versionMatrix struct {
	Versions []string    `json:"versions"`
	Rows     []matrixRow `json:"rows"`
}

type versionPoint struct {
	At        string `json:"at"`
	Downloads int64  `json:"downloads"`
}

type versionsResponse struct {
	LatestMinecraft *string        `json:"latestMinecraft"`
	GameVersions    []versionTotal `json:"gameVersions"`
	Loaders         []versionTotal `json:"loaders"`
	// NoLoader is the files that carry no loader tag at all (files from before loaders were tagged), counted exactly.
	NoLoader versionTotal              `json:"noLoader"`
	Matrix   versionMatrix             `json:"matrix"`
	History  map[string][]versionPoint `json:"history"`
}

type releaseItem struct {
	Platform          string   `json:"platform"`
	ModSlug           *string  `json:"modSlug"`
	ModName           string   `json:"modName"`
	Version           string   `json:"version"`
	Name              string   `json:"name"`
	ReleaseType       string   `json:"releaseType"`
	MinecraftVersions []string `json:"minecraftVersions"`
	Loaders           []string `json:"loaders"`
	PublishedAt       string   `json:"publishedAt"`
	Downloads         int64    `json:"downloads"`
	URL               *string  `json:"url"`
}

type sourceStatus struct {
	Source    string  `json:"source"`
	OK        bool    `json:"ok"`
	Error     string  `json:"error,omitempty"`
	Detail    string  `json:"detail,omitempty"`
	CheckedAt string  `json:"checkedAt"`
	LastOKAt  *string `json:"lastOkAt"`
}

type overviewTotals struct {
	Mods          int          `json:"mods"`
	Downloads     modDownloads `json:"downloads"`
	OpenIssues    int          `json:"openIssues"`
	OpenBugs      int          `json:"openBugs"`
	OpenCrashes   int          `json:"openCrashes"`
	NeedAttention int          `json:"needAttention"`
	InReview      int          `json:"inReview"`
}

type overviewResponse struct {
	Version        string          `json:"version"`
	Schedule       string          `json:"schedule"`
	Polling        bool            `json:"polling"`
	Totals         overviewTotals  `json:"totals"`
	Attention      []attentionItem `json:"attention"`
	Mods           []modSummary    `json:"mods"`
	RecentReleases []releaseItem   `json:"recentReleases"`
	Sources        []sourceStatus  `json:"sources"`
	LastPoll       *models.Poll    `json:"lastPoll"`
	LastOKPoll     *models.Poll    `json:"lastOkPoll"`
	Problems       []string        `json:"problems"`
}

func toSourceStatuses(in []models.SourceStatus) []sourceStatus {
	out := make([]sourceStatus, 0, len(in))
	for _, s := range in {
		out = append(out, sourceStatus{
			Source: s.Source, OK: s.OK, Error: s.Error, Detail: s.Detail,
			CheckedAt: rfc3339(s.CheckedAt), LastOKAt: rfc3339Ptr(s.LastOKAt),
		})
	}
	return out
}
