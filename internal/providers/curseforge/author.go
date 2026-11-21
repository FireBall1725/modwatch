// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package curseforge

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// Author is a CurseForge member as a mod lists them.
type Author struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	URL  string `json:"url"`
}

// ErrNoAuthor means no mod the search returned names this author.
var ErrNoAuthor = errors.New("no author with that name")

// profileName is the part of a members link that names the profile.
var profileName = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,40}$`)

// ParseProfile reads a CurseForge profile name from a link such as https://www.curseforge.com/members/<name>,
// or accepts a bare name. It returns "" when the text is neither.
func ParseProfile(text string) string {
	t := strings.TrimSpace(text)
	t = strings.TrimSuffix(strings.TrimSuffix(t, "/"), "/projects")
	if i := strings.Index(t, "curseforge.com/members/"); i >= 0 {
		t = t[i+len("curseforge.com/members/"):]
		if j := strings.IndexAny(t, "/?#"); j >= 0 {
			t = t[:j]
		}
	} else if strings.Contains(t, "/") || strings.Contains(t, "curseforge") {
		return ""
	}
	if !profileName.MatchString(t) {
		return ""
	}
	return t
}

// FindAuthor looks an author up by profile name the way the public site does: search the mods for the name, then
// match an author on their display name or on the last part of their profile URL. It reads three pages at most.
func (c *Client) FindAuthor(ctx context.Context, name string) (*Author, error) {
	want := strings.ToLower(name)
	for index := 0; index < 3*pageSize; index += pageSize {
		q := url.Values{}
		q.Set("gameId", strconv.Itoa(c.gameID))
		q.Set("searchFilter", name)
		q.Set("index", strconv.Itoa(index))
		q.Set("pageSize", strconv.Itoa(pageSize))
		page, err := c.search(ctx, q)
		if err != nil {
			return nil, err
		}
		for _, m := range page.Data {
			for _, a := range m.Authors {
				if strings.ToLower(a.Name) == want || strings.ToLower(lastSegment(a.URL)) == want {
					return &Author{ID: a.ID, Name: a.Name, URL: a.URL}, nil
				}
			}
		}
		if len(page.Data) < pageSize {
			break
		}
	}
	return nil, ErrNoAuthor
}

func lastSegment(u string) string {
	u = strings.TrimSuffix(u, "/")
	return u[strings.LastIndex(u, "/")+1:]
}
