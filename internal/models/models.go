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
)

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
	Source    string    `json:"source"`
	OK        bool      `json:"ok"`
	Error     string    `json:"error,omitempty"`
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
