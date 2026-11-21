// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package curseforge reads an author's mods from the CurseForge Core API.
package curseforge

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// pageSize is the API's maximum. It also caps a query at 10,000 results, far past any one author.
const pageSize = 50

// Mod is the part of a CurseForge project Modwatch keeps.
type Mod struct {
	ID            int       `json:"id"`
	Name          string    `json:"name"`
	Slug          string    `json:"slug"`
	Summary       string    `json:"summary"`
	DownloadCount int64     `json:"downloadCount"`
	DateCreated   time.Time `json:"dateCreated"`
	DateModified  time.Time `json:"dateModified"`
	Links         struct {
		WebsiteURL string `json:"websiteUrl"`
	} `json:"links"`
	Logo *struct {
		ThumbnailURL string `json:"thumbnailUrl"`
	} `json:"logo"`
}

// LogoURL returns the thumbnail, or an empty string when the project has no logo.
func (m Mod) LogoURL() string {
	if m.Logo == nil {
		return ""
	}
	return m.Logo.ThumbnailURL
}

type searchResponse struct {
	Data       []Mod `json:"data"`
	Pagination struct {
		Index       int `json:"index"`
		ResultCount int `json:"resultCount"`
		TotalCount  int `json:"totalCount"`
	} `json:"pagination"`
}

// Client talks to the Core API with one key.
type Client struct {
	baseURL string
	key     string
	gameID  int
	http    *http.Client
}

// New returns a client for the given base URL (https://api.curseforge.com in production).
func New(baseURL, key string, gameID int) *Client {
	return &Client{baseURL: baseURL, key: key, gameID: gameID, http: &http.Client{Timeout: 30 * time.Second}}
}

// ListByAuthor returns every mod the author is a member of, or only the ones they own.
func (c *Client) ListByAuthor(ctx context.Context, authorID int, ownerOnly bool) ([]Mod, error) {
	param := "authorId"
	if ownerOnly {
		param = "primaryAuthorId"
	}
	mods := []Mod{}
	for index := 0; ; {
		q := url.Values{}
		q.Set("gameId", strconv.Itoa(c.gameID))
		q.Set(param, strconv.Itoa(authorID))
		q.Set("index", strconv.Itoa(index))
		q.Set("pageSize", strconv.Itoa(pageSize))

		page, err := c.search(ctx, q)
		if err != nil {
			return nil, err
		}
		mods = append(mods, page.Data...)
		index += len(page.Data)
		if len(page.Data) == 0 || index >= page.Pagination.TotalCount {
			return mods, nil
		}
	}
}

func (c *Client) search(ctx context.Context, q url.Values) (*searchResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/v1/mods/search?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", c.key)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, statusError(resp.StatusCode, resp.Header.Get("Retry-After"), body)
	}
	var out searchResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("curseforge: unreadable response: %w", err)
	}
	return &out, nil
}

// statusError names the failure without echoing the key, which never appears in a response anyway.
func statusError(code int, retryAfter string, body []byte) error {
	const max = 200
	if len(body) > max {
		body = body[:max]
	}
	switch code {
	case http.StatusForbidden, http.StatusUnauthorized:
		return fmt.Errorf("curseforge: %d, the API key is missing or invalid (it must be a Core API key from console.curseforge.com): %s", code, body)
	case http.StatusTooManyRequests:
		return fmt.Errorf("curseforge: rate limited, retry after %q", retryAfter)
	}
	return fmt.Errorf("curseforge: unexpected status %d: %s", code, body)
}
