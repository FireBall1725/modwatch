// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package github reads the issues of one public repository from the GitHub REST API.
package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

const (
	perPage = 100
	// maxPages stops a runaway loop; 50 pages is 5000 issues.
	maxPages = 50
)

// UnauthenticatedDetail is shown beside the GitHub source when no token is set.
const UnauthenticatedDetail = "Unauthenticated: 60 requests an hour"

// Client lists a repository's issues. The token is optional.
type Client struct {
	baseURL   string
	repo      string
	token     string
	userAgent string
	http      *http.Client
}

// New returns a client for repo, written owner/name.
func New(baseURL, repo, token, userAgent string) *Client {
	return &Client{baseURL: baseURL, repo: repo, token: token, userAgent: userAgent, http: &http.Client{Timeout: 30 * time.Second}}
}

type apiIssue struct {
	Number      int             `json:"number"`
	Title       string          `json:"title"`
	State       string          `json:"state"`
	HTMLURL     string          `json:"html_url"`
	Comments    int             `json:"comments"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	ClosedAt    *time.Time      `json:"closed_at"`
	PullRequest json.RawMessage `json:"pull_request"`
	User        *struct {
		Login string `json:"login"`
	} `json:"user"`
	Labels []struct {
		Name string `json:"name"`
	} `json:"labels"`
}

// ListIssues returns every issue, open and closed, without pull requests. It pages until a short page.
func (c *Client) ListIssues(ctx context.Context) ([]models.Issue, error) {
	out := []models.Issue{}
	for page := 1; page <= maxPages; page++ {
		items, err := c.page(ctx, page)
		if err != nil {
			return nil, err
		}
		for _, it := range items {
			if len(it.PullRequest) > 0 && string(it.PullRequest) != "null" {
				continue
			}
			out = append(out, convert(it))
		}
		if len(items) < perPage {
			break
		}
	}
	return out, nil
}

func (c *Client) page(ctx context.Context, page int) ([]apiIssue, error) {
	u := fmt.Sprintf("%s/repos/%s/issues?state=all&per_page=%d&page=%d", c.baseURL, c.repo, perPage, page)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "application/vnd.github+json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		// The URL holds no secret, but the transport error can wrap it; keep only the cause.
		var ue *url.Error
		if errors.As(err, &ue) {
			return nil, fmt.Errorf("github: %w", ue.Err)
		}
		return nil, fmt.Errorf("github: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, fmt.Errorf("github: %w", err)
	}
	switch {
	case resp.StatusCode == http.StatusOK:
	case resp.StatusCode == http.StatusTooManyRequests,
		resp.StatusCode == http.StatusForbidden && resp.Header.Get("X-RateLimit-Remaining") == "0",
		resp.StatusCode == http.StatusForbidden && resp.Header.Get("Retry-After") != "":
		return nil, c.rateLimited(resp)
	case resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized:
		return nil, fmt.Errorf("github: %d, access to %s was refused", resp.StatusCode, c.repo)
	case resp.StatusCode == http.StatusNotFound:
		return nil, fmt.Errorf("github: %s was not found, or it is private and the token can't see it", c.repo)
	default:
		if len(body) > 200 {
			body = body[:200]
		}
		return nil, fmt.Errorf("github: unexpected status %d: %s", resp.StatusCode, body)
	}
	var items []apiIssue
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("github: unreadable response: %w", err)
	}
	return items, nil
}

func (c *Client) rateLimited(resp *http.Response) error {
	limit := "60 requests an hour without GITHUB_TOKEN"
	if c.token != "" {
		limit = "the token's hourly limit"
	}
	msg := fmt.Sprintf("github: rate limit reached (%s, status %d)", limit, resp.StatusCode)
	if reset, err := strconv.ParseInt(resp.Header.Get("X-RateLimit-Reset"), 10, 64); err == nil {
		msg += ", resets at " + time.Unix(reset, 0).UTC().Format(time.RFC3339)
	} else if ra := resp.Header.Get("Retry-After"); ra != "" {
		msg += ", retry after " + ra + " seconds"
	}
	return errors.New(msg)
}

func convert(it apiIssue) models.Issue {
	labels := make([]string, 0, len(it.Labels))
	for _, l := range it.Labels {
		labels = append(labels, l.Name)
	}
	is := models.Issue{
		Number: it.Number, Title: it.Title, State: it.State, URL: it.HTMLURL,
		Labels: labels, ModLabel: ModLabel(labels), Kind: Kind(labels),
		Comments: it.Comments, CreatedAt: it.CreatedAt.UTC(), UpdatedAt: it.UpdatedAt.UTC(),
	}
	if it.User != nil {
		is.Author = it.User.Login
	}
	if it.ClosedAt != nil {
		is.ClosedAt = it.ClosedAt.UTC()
	}
	return is
}

// Kind reads the type labels. Precedence: crash, bug, compatibility, enhancement, question, otherwise other.
func Kind(labels []string) string {
	has := map[string]bool{}
	for _, l := range labels {
		has[strings.ToLower(strings.TrimSpace(l))] = true
	}
	for _, k := range []string{models.KindCrash, models.KindBug, models.KindCompatibility, models.KindEnhancement, models.KindQuestion} {
		if has[k] {
			return k
		}
	}
	return models.KindOther
}

// ModLabel returns the text after "mod:" on the first label that has that prefix, or "".
func ModLabel(labels []string) string {
	for _, l := range labels {
		l = strings.TrimSpace(l)
		if len(l) >= 4 && strings.EqualFold(l[:4], "mod:") {
			if rest := strings.TrimSpace(l[4:]); rest != "" {
				return rest
			}
		}
	}
	return ""
}
