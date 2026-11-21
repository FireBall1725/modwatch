// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package modrinth reads a user's projects and their versions from the Modrinth API.
package modrinth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Project is the part of a Modrinth project Modwatch keeps.
type Project struct {
	ID        string `json:"id"`
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	Downloads int64  `json:"downloads"`
}

// Version is one release of a project. Unlike CurseForge, game versions and loaders arrive as separate lists.
type Version struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	VersionNumber string    `json:"version_number"`
	VersionType   string    `json:"version_type"`
	Downloads     int64     `json:"downloads"`
	GameVersions  []string  `json:"game_versions"`
	Loaders       []string  `json:"loaders"`
	DatePublished time.Time `json:"date_published"`
}

// Client talks to the Modrinth API. The token is optional: public projects need none, and it only
// matters for drafts and private projects.
type Client struct {
	baseURL   string
	token     string
	userAgent string
	http      *http.Client
}

// New returns a client. Modrinth rejects requests without a descriptive User-Agent.
func New(baseURL, token, userAgent string) *Client {
	return &Client{baseURL: baseURL, token: token, userAgent: userAgent, http: &http.Client{Timeout: 30 * time.Second}}
}

// ListProjects returns the projects a user (name or id) is a member of.
func (c *Client) ListProjects(ctx context.Context, user string) ([]Project, error) {
	out := []Project{}
	if err := c.get(ctx, "/v2/user/"+url.PathEscape(user)+"/projects", &out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListVersions returns every version of a project.
func (c *Client) ListVersions(ctx context.Context, projectID string) ([]Version, error) {
	out := []Version{}
	if err := c.get(ctx, "/v2/project/"+url.PathEscape(projectID)+"/version", &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", c.token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return err
	}
	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusTooManyRequests:
		return fmt.Errorf("modrinth: rate limited, retry after %q seconds", resp.Header.Get("X-Ratelimit-Reset"))
	case http.StatusUnauthorized, http.StatusForbidden:
		return fmt.Errorf("modrinth: %d, the token was refused", resp.StatusCode)
	default:
		if len(body) > 200 {
			body = body[:200]
		}
		return fmt.Errorf("modrinth: unexpected status %d: %s", resp.StatusCode, body)
	}
	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("modrinth: unreadable response: %w", err)
	}
	return nil
}
