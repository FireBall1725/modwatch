// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package models holds the types shared between the storage, poller and API layers.
package models

import "time"

// Mod is one CurseForge project.
type Mod struct {
	ID           int       `json:"id"`
	Slug         string    `json:"slug"`
	Name         string    `json:"name"`
	Summary      string    `json:"summary"`
	LogoURL      string    `json:"logoUrl"`
	WebsiteURL   string    `json:"websiteUrl"`
	Owned        bool      `json:"owned"`
	DateCreated  time.Time `json:"dateCreated"`
	DateModified time.Time `json:"dateModified"`
}

// ModStat is a mod with its latest download count and how much that moved.
// A delta is nil when there is no snapshot old enough to compare against.
type ModStat struct {
	Mod
	Downloads int64  `json:"downloads"`
	Delta24h  *int64 `json:"delta24h"`
	Delta7d   *int64 `json:"delta7d"`
}

// Snapshot is a download count at one moment.
type Snapshot struct {
	At        time.Time `json:"at"`
	Downloads int64     `json:"downloads"`
}

// PollState is how a poll ended.
type PollState string

const (
	PollOK    PollState = "ok"
	PollError PollState = "error"
)

// Poll is one attempt to fetch the author's mods.
type Poll struct {
	ID         int64     `json:"id"`
	StartedAt  time.Time `json:"startedAt"`
	FinishedAt time.Time `json:"finishedAt"`
	State      PollState `json:"state"`
	Error      string    `json:"error,omitempty"`
	Mods       int       `json:"mods"`
}

// Reading is one mod's state as a poll saw it.
type Reading struct {
	Mod
	Downloads int64
}

// Sources the downloads come from.
const (
	SourceCurseForge = "curseforge"
	SourceModrinth   = "modrinth"
	SourceGitHub     = "github"
)

// Issue kinds, in the precedence order the labels are read.
const (
	KindCrash         = "crash"
	KindBug           = "bug"
	KindCompatibility = "compatibility"
	KindEnhancement   = "enhancement"
	KindQuestion      = "question"
	KindOther         = "other"
)

// IssueKinds lists every kind, in the order the API reports them.
var IssueKinds = []string{KindBug, KindCrash, KindEnhancement, KindCompatibility, KindQuestion, KindOther}

// Issue is one GitHub issue. Pull requests are never stored. ClosedAt is the zero time while open.
type Issue struct {
	Repo      string // owner/name; issue numbers are only unique within one repo
	Number    int
	Title     string
	State     string // "open" or "closed"
	URL       string
	Labels    []string
	ModLabel  string // the text after "mod: ", empty when the issue has no such label
	Kind      string
	Author    string
	Comments  int
	CreatedAt time.Time
	UpdatedAt time.Time
	ClosedAt  time.Time
}

// File is one downloadable file (CurseForge) or version (Modrinth) of a project.
// GameVersions holds Minecraft versions only and Loaders holds mod loaders only; each source's
// own mixed list is split before it gets here.
type File struct {
	Source       string    `json:"source"`
	ID           string    `json:"id"`
	ProjectID    string    `json:"projectId"`
	ProjectSlug  string    `json:"projectSlug"`
	ProjectName  string    `json:"projectName"`
	Name         string    `json:"name"`
	Version      string    `json:"version"`
	ReleaseType  string    `json:"releaseType"`
	GameVersions []string  `json:"gameVersions"`
	Loaders      []string  `json:"loaders"`
	PublishedAt  time.Time `json:"publishedAt"`
}

// FileReading is a file and its download count as one poll saw it.
type FileReading struct {
	File
	Downloads int64
}

// FileStat is a file with its latest download count and movement.
type FileStat struct {
	File
	Downloads int64  `json:"downloads"`
	Delta24h  *int64 `json:"delta24h"`
	Delta7d   *int64 `json:"delta7d"`
}

// SourceStatus is whether the last attempt to read a source worked.
type SourceStatus struct {
	Source string `json:"source"`
	OK     bool   `json:"ok"`
	Error  string `json:"error,omitempty"`
	// Detail is a plain-words limit on what the source can show, such as a missing token.
	Detail    string    `json:"detail,omitempty"`
	CheckedAt time.Time `json:"checkedAt"`
	LastOKAt  time.Time `json:"lastOkAt"`
}

// VersionTotal is the downloads attributed to one Minecraft version or loader.
// A file that targets several versions counts toward each of them, so the totals overlap.
type VersionTotal struct {
	Name      string `json:"name"`
	Downloads int64  `json:"downloads"`
	Files     int    `json:"files"`
}

// ReviewStatus is one vocabulary for both platforms' review states. The raw word stays in RawStatus.
type ReviewStatus string

const (
	StatusApproved        ReviewStatus = "approved"
	StatusInReview        ReviewStatus = "in_review"
	StatusChangesRequired ReviewStatus = "changes_required"
	StatusRejected        ReviewStatus = "rejected"
	StatusDraft           ReviewStatus = "draft"
	StatusUnlisted        ReviewStatus = "unlisted"
	StatusArchived        ReviewStatus = "archived"
	StatusInactive        ReviewStatus = "inactive"
	StatusUnknown         ReviewStatus = "unknown"
)

// PlatformProject is a CurseForge or Modrinth project with its review state and links.
// Time fields are zero when the platform gave none.
type PlatformProject struct {
	Platform        string       `json:"platform"`
	ID              string       `json:"id"`
	Slug            string       `json:"slug"`
	Name            string       `json:"name"`
	Summary         string       `json:"summary"`
	IconURL         string       `json:"iconUrl"`
	URL             string       `json:"url"`
	RawStatus       string       `json:"rawStatus"`
	Status          ReviewStatus `json:"status"`
	StatusMessage   string       `json:"statusMessage"`
	RequestedStatus string       `json:"requestedStatus"`
	QueuedAt        time.Time    `json:"queuedAt"`
	Followers       int64        `json:"followers"`
	Owned           bool         `json:"owned"`
	PublishedAt     time.Time    `json:"publishedAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`
	SourceURL       string       `json:"sourceUrl"`
	IssuesURL       string       `json:"issuesUrl"`
	WikiURL         string       `json:"wikiUrl"`
	DiscordURL      string       `json:"discordUrl"`
}

// PlatformReading is a project and its download count as one poll saw it.
type PlatformReading struct {
	PlatformProject
	Downloads int64
}

// PlatformStat is a project with its latest download count and movement.
// A delta is nil when there is no snapshot old enough to compare against.
type PlatformStat struct {
	PlatformProject
	Downloads int64  `json:"downloads"`
	Delta24h  *int64 `json:"delta24h"`
	Delta7d   *int64 `json:"delta7d"`
}

// PlatformKey names one project across both platforms.
type PlatformKey struct {
	Platform string
	ID       string
}

// CatalogEntry joins one mod across CurseForge, Modrinth and GitHub. Nil means no link on that platform.
type CatalogEntry struct {
	Slug         string  `json:"slug"`
	Name         string  `json:"name"`
	CurseForgeID *int64  `json:"curseforgeId"`
	ModrinthID   *string `json:"modrinthId"`
	GitHubLabel  *string `json:"githubLabel"`
	// GitHubRepo is the mod's own issues repository, owner/name; every issue in it belongs to this mod.
	GitHubRepo *string `json:"githubRepo"`
	// VersionRegex is the mod's own pattern for reading its file versions, with named groups version, pre and minecraft.
	// Nil means the default reading.
	VersionRegex *string `json:"versionRegex"`
	Hidden       bool    `json:"hidden"`
	Legacy       bool    `json:"legacy"`
	Auto         bool    `json:"auto"`
}

// UnlinkedProject is a platform project no catalog entry points at.
type UnlinkedProject struct {
	Platform string `json:"platform"`
	ID       string `json:"id"`
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	IconURL  string `json:"iconUrl"`
	URL      string `json:"url"`
	Owned    bool   `json:"owned"`
}

// Patch is one field of an update: Set is false when the field was left out, and a Set field with a nil Value clears it.
type Patch[T any] struct {
	Set   bool
	Value *T
}

// CatalogUpdate is a partial edit of an entry.
type CatalogUpdate struct {
	Name         *string
	CurseForgeID Patch[int64]
	ModrinthID   Patch[string]
	GitHubLabel  Patch[string]
	GitHubRepo   Patch[string]
	VersionRegex Patch[string]
	Hidden       *bool
	Legacy       *bool
}

// Revenue is what a platform owes the author: the balance and the earnings by month, in one currency.
type Revenue struct {
	Platform          string         `json:"platform"`
	Currency          string         `json:"currency"`
	Available         float64        `json:"available"`
	Pending           float64        `json:"pending"`
	WithdrawnLifetime float64        `json:"withdrawnLifetime"`
	WithdrawnYTD      float64        `json:"withdrawnYtd"`
	Months            []RevenueMonth `json:"months"`
	FetchedAt         time.Time      `json:"fetchedAt"`
}

// RevenueMonth is the earnings the platform dates to one month, such as 2026-11.
type RevenueMonth struct {
	Month  string  `json:"month"`
	Amount float64 `json:"amount"`
}

// Dismissal is a needs-attention item the author dismissed, per kind and mod.
type Dismissal struct {
	Kind        string
	ModSlug     string
	DismissedAt time.Time
}
