// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package modrinth

import (
	"encoding/json"
	"testing"

	"github.com/fireball1725/modwatch/internal/models"
)

func TestReviewStatusTable(t *testing.T) {
	for in, want := range map[string]models.ReviewStatus{
		"approved":   models.StatusApproved,
		"processing": models.StatusInReview,
		"draft":      models.StatusDraft,
		"rejected":   models.StatusRejected,
		"unlisted":   models.StatusUnlisted,
		"scheduled":  models.StatusUnlisted,
		"archived":   models.StatusArchived,
		"withheld":   models.StatusArchived,
		"private":    models.StatusUnknown,
		"unknown":    models.StatusUnknown,
		"":           models.StatusUnknown,
		"Approved":   models.StatusUnknown,
	} {
		if got := ReviewStatus(in); got != want {
			t.Errorf("ReviewStatus(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestProjectDecodesReviewFields(t *testing.T) {
	const processing = `{"id":"P1","slug":"ae-lights","title":"AE Lights","description":"d","project_type":"mod","status":"processing",
		"requested_status":"approved","moderator_message":{"message":"Add a licence.","body":null},"queued":"2026-11-10T08:00:00Z",
		"published":"2026-11-01T00:00:00Z","updated":"2026-11-12T00:00:00Z","followers":3,"icon_url":"https://i",
		"source_url":"https://s","issues_url":"https://b","wiki_url":null,"discord_url":null,"downloads":9}`
	var p Project
	if err := json.Unmarshal([]byte(processing), &p); err != nil {
		t.Fatal(err)
	}
	if p.Status != "processing" || p.Requested() != "approved" || string(p.ModeratorMsg) != "Add a licence." {
		t.Errorf("project = %+v", p)
	}
	if p.Queued == nil || p.Queued.Day() != 10 || p.Followers != 3 || p.WikiURL != "" || p.URL() != "https://modrinth.com/mod/ae-lights" {
		t.Errorf("project = %+v", p)
	}

	const plain = `{"id":"P2","slug":"ags","title":"AGS","status":"approved","requested_status":null,"moderator_message":null,"queued":null,"downloads":1}`
	p = Project{}
	if err := json.Unmarshal([]byte(plain), &p); err != nil {
		t.Fatal(err)
	}
	if p.Requested() != "" || p.ModeratorMsg != "" || p.Queued != nil || p.URL() != "https://modrinth.com/mod/ags" {
		t.Errorf("project = %+v", p)
	}
}

func TestModeratorMessageForms(t *testing.T) {
	for in, want := range map[string]string{
		`null`:                         "",
		`{"message":"hi","body":"b"}`:  "hi",
		`{"message":null,"body":null}`: "",
		`"bare"`:                       "bare",
		`{}`:                           "",
	} {
		var m ModeratorMessage
		if err := json.Unmarshal([]byte(in), &m); err != nil || string(m) != want {
			t.Errorf("%s -> %q, %v; want %q", in, m, err, want)
		}
	}
	var m ModeratorMessage
	if err := json.Unmarshal([]byte(`[1]`), &m); err == nil {
		t.Error("an array is not a moderator message")
	}
}

func TestProjectURLUsesItsType(t *testing.T) {
	if got := (Project{Slug: "x", ProjectType: "modpack"}).URL(); got != "https://modrinth.com/modpack/x" {
		t.Errorf("url = %q", got)
	}
}
