// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package curseforge

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// File is the part of a CurseForge project file Modwatch keeps.
type File struct {
	ID            int       `json:"id"`
	DisplayName   string    `json:"displayName"`
	FileName      string    `json:"fileName"`
	DownloadCount int64     `json:"downloadCount"`
	ReleaseType   int       `json:"releaseType"`
	FileDate      time.Time `json:"fileDate"`
	// GameVersions mixes Minecraft versions, loaders and sides ("1.21.1", "NeoForge", "Client").
	GameVersions []string `json:"gameVersions"`
}

type filesResponse struct {
	Data       []File `json:"data"`
	Pagination struct {
		TotalCount int `json:"totalCount"`
	} `json:"pagination"`
}

// ReleaseName maps CurseForge's numeric release type to the words Modrinth uses.
func (f File) ReleaseName() string {
	switch f.ReleaseType {
	case 1:
		return "release"
	case 2:
		return "beta"
	case 3:
		return "alpha"
	}
	return "unknown"
}

// ListFiles returns every file of a mod, newest first as the API gives them.
func (c *Client) ListFiles(ctx context.Context, modID int) ([]File, error) {
	files := []File{}
	for index := 0; ; {
		q := url.Values{}
		q.Set("index", strconv.Itoa(index))
		q.Set("pageSize", strconv.Itoa(pageSize))

		var page filesResponse
		if err := c.get(ctx, fmt.Sprintf("/v1/mods/%d/files", modID), q, &page); err != nil {
			return nil, err
		}
		files = append(files, page.Data...)
		index += len(page.Data)
		if len(page.Data) == 0 || index >= page.Pagination.TotalCount {
			return files, nil
		}
	}
}

// loaders is the set of names CurseForge uses for mod loaders in a file's game versions.
var loaders = map[string]string{
	"forge": "forge", "neoforge": "neoforge", "fabric": "fabric", "quilt": "quilt",
	"liteloader": "liteloader", "rift": "rift", "risugami's modloader": "modloader",
}

// minecraftVersion matches release versions ("1.21.1"), pre-releases and snapshots ("1.21-Pre1", "24w14a").
var minecraftVersion = regexp.MustCompile(`^(\d+\.\d+(\.\d+)?(-[A-Za-z0-9.]+)?|\d{2}w\d{2}[a-z])$`)

// Classify splits a file's mixed game-version list into Minecraft versions and loaders.
// Sides ("Client", "Server") and Java versions are dropped. Anything unrecognised is dropped too,
// so a new tag CurseForge invents can't end up as a bogus Minecraft version.
func Classify(gameVersions []string) (minecraft, modLoaders []string) {
	minecraft, modLoaders = []string{}, []string{}
	for _, v := range gameVersions {
		v = strings.TrimSpace(v)
		if l, ok := loaders[strings.ToLower(v)]; ok {
			modLoaders = append(modLoaders, l)
		} else if minecraftVersion.MatchString(v) {
			minecraft = append(minecraft, v)
		}
	}
	return minecraft, modLoaders
}
