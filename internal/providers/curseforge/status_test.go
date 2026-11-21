// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package curseforge

import (
	"encoding/json"
	"testing"

	"github.com/fireball1725/modwatch/internal/models"
)

func TestReviewStatusTable(t *testing.T) {
	for _, c := range []struct {
		code int
		raw  string
		want models.ReviewStatus
	}{
		{1, "New", models.StatusInReview},
		{2, "ChangesRequired", models.StatusChangesRequired},
		{3, "UnderSoftReview", models.StatusInReview},
		{4, "Approved", models.StatusApproved},
		{5, "Rejected", models.StatusRejected},
		{6, "ChangesMade", models.StatusInReview},
		{7, "Inactive", models.StatusInactive},
		{8, "Abandoned", models.StatusInactive},
		{9, "Deleted", models.StatusInactive},
		{10, "UnderReview", models.StatusInReview},
		{0, "Unknown", models.StatusUnknown},
		{11, "Unknown", models.StatusUnknown},
		{-3, "Unknown", models.StatusUnknown},
	} {
		got, raw := ReviewStatus(c.code)
		if got != c.want || raw != c.raw {
			t.Errorf("ReviewStatus(%d) = %q, %q; want %q, %q", c.code, got, raw, c.want, c.raw)
		}
	}
}

func TestModDecodesReviewAndMetadata(t *testing.T) {
	const body = `{"id":9,"name":"Graves","slug":"graves","summary":"s","downloadCount":5,"status":2,"isAvailable":true,
		"thumbsUpCount":12,"dateCreated":"2026-01-01T00:00:00Z","dateModified":"2026-02-01T00:00:00Z","dateReleased":"2026-01-15T00:00:00Z",
		"links":{"websiteUrl":"https://w","sourceUrl":"https://s","issuesUrl":"https://i","wikiUrl":"https://k"},
		"logo":{"thumbnailUrl":"https://l"}}`
	var m Mod
	if err := json.Unmarshal([]byte(body), &m); err != nil {
		t.Fatal(err)
	}
	st, raw := m.Review()
	if st != models.StatusChangesRequired || raw != "ChangesRequired" || !m.IsAvailable || m.ThumbsUp != 12 {
		t.Errorf("mod = %+v", m)
	}
	if m.Links.SourceURL != "https://s" || m.Links.IssuesURL != "https://i" || m.Links.WikiURL != "https://k" || m.LogoURL() != "https://l" {
		t.Errorf("links = %+v", m.Links)
	}
	if m.DateReleased.Year() != 2026 {
		t.Errorf("dateReleased = %v", m.DateReleased)
	}
}
