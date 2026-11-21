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

	"github.com/fireball1725/modwatch/internal/models"
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
	DateReleased  time.Time `json:"dateReleased"`
	// Status is the review state, 1 to 10. See ReviewStatus.
	Status      int  `json:"status"`
	IsAvailable bool `json:"isAvailable"`
	ThumbsUp    int  `json:"thumbsUpCount"`
	Links       struct {
		WebsiteURL string `json:"websiteUrl"`
		SourceURL  string `json:"sourceUrl"`
		IssuesURL  string `json:"issuesUrl"`
		WikiURL    string `json:"wikiUrl"`
	} `json:"links"`
	Logo *struct {
		ThumbnailURL string `json:"thumbnailUrl"`
	} `json:"logo"`
}

// statusNames maps CurseForge's numeric project status to its raw word and the shared vocabulary.
var statusNames = map[int]struct {
	raw    string
	status models.ReviewStatus
}{
	1:  {"New", models.StatusInReview},
	2:  {"ChangesRequired", models.StatusChangesRequired},
	3:  {"UnderSoftReview", models.StatusInReview},
	4:  {"Approved", models.StatusApproved},
	5:  {"Rejected", models.StatusRejected},
	6:  {"ChangesMade", models.StatusInReview},
	7:  {"Inactive", models.StatusInactive},
	8:  {"Abandoned", models.StatusInactive},
	9:  {"Deleted", models.StatusInactive},
	10: {"UnderReview", models.StatusInReview},
}

// ReviewStatus maps a numeric status to the shared vocabulary and the raw word.
func ReviewStatus(code int) (models.ReviewStatus, string) {
	if n, ok := statusNames[code]; ok {
		return n.status, n.raw
	}
	return models.StatusUnknown, "Unknown"
}

// Review returns the mod's review state in the shared vocabulary and as CurseForge words it.
func (m Mod) Review() (models.ReviewStatus, string) { return ReviewStatus(m.Status) }

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
	var out searchResponse
	if err := c.get(ctx, "/v1/mods/search", q, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// get fetches one endpoint and decodes the JSON body into out.
func (c *Client) get(ctx context.Context, path string, q url.Values, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", c.key)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return statusError(resp.StatusCode, resp.Header.Get("Retry-After"), body)
	}
	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("curseforge: unreadable response: %w", err)
	}
	return nil
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
