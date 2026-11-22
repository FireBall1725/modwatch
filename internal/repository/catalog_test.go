// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/fireball1725/modwatch/internal/models"
)

func proj(platform, id, slug, name string, owned bool) models.PlatformReading {
	return models.PlatformReading{
		PlatformProject: models.PlatformProject{Platform: platform, ID: id, Slug: slug, Name: name, Owned: owned},
		Downloads:       1,
	}
}

func savePoll(t *testing.T, r *Repo, at time.Time, ps ...models.PlatformReading) {
	t.Helper()
	if _, err := r.SavePollWithProjects(context.Background(), poll(at), nil, nil, ps, nil); err != nil {
		t.Fatal(err)
	}
}

func entryBySlug(t *testing.T, r *Repo, slug string) models.CatalogEntry {
	t.Helper()
	e, err := r.GetCatalogEntry(context.Background(), slug)
	if err != nil {
		t.Fatalf("entry %q: %v", slug, err)
	}
	return e
}

func TestAutoLinkBySlug(t *testing.T) {
	r := newRepo(t)
	savePoll(t, r, time.Now(),
		proj("curseforge", "10", "graves", "Graves", true),
		proj("modrinth", "abc", "graves", "Graves Reloaded", true))
	list, _ := r.ListCatalog(context.Background())
	if len(list) != 1 {
		t.Fatalf("entries = %+v", list)
	}
	e := list[0]
	if e.CurseForgeID == nil || *e.CurseForgeID != 10 || e.ModrinthID == nil || *e.ModrinthID != "abc" || !e.Auto {
		t.Errorf("entry = %+v", e)
	}
}

func TestAutoLinkByNormalisedNameWithDifferentSlugs(t *testing.T) {
	r := newRepo(t)
	savePoll(t, r, time.Now(),
		proj("curseforge", "10", "automatic-gui-scale", "Automatic Gui Scale", true),
		proj("modrinth", "ags1", "ags", "Automatic Gui Scale", true))
	list, _ := r.ListCatalog(context.Background())
	if len(list) != 1 || list[0].Slug != "automatic-gui-scale" || list[0].ModrinthID == nil {
		t.Fatalf("entries = %+v", list)
	}
}

func TestAutoLinkMismatchStaysTwoEntries(t *testing.T) {
	r := newRepo(t)
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "firecorelib", "FireCore Lib", true),
		proj("modrinth", "m1", "firecoremod", "FireCore", true))
	list, _ := r.ListCatalog(context.Background())
	if len(list) != 2 {
		t.Fatalf("entries = %+v", list)
	}
	for _, e := range list {
		if (e.CurseForgeID == nil) == (e.ModrinthID == nil) {
			t.Errorf("entry should hold one platform: %+v", e)
		}
	}
}

func TestMemberProjectsGetNoEntryAndAreUnlinked(t *testing.T) {
	r := newRepo(t)
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "mine", "Mine", true),
		proj("curseforge", "2", "ae2", "Applied Energistics 2", false))
	list, _ := r.ListCatalog(context.Background())
	if len(list) != 1 {
		t.Fatalf("entries = %+v", list)
	}
	un, err := r.ListUnlinkedProjects(context.Background())
	if err != nil || len(un) != 1 || un[0].ID != "2" || un[0].Owned {
		t.Fatalf("unlinked = %+v, %v", un, err)
	}
}

func TestRelinkIsStable(t *testing.T) {
	r := newRepo(t)
	savePoll(t, r, time.Now(), proj("curseforge", "1", "a", "A", true))
	for range 2 {
		if err := r.AutoLink(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	list, _ := r.ListCatalog(context.Background())
	if len(list) != 1 {
		t.Fatalf("entries = %+v", list)
	}
}

func TestSlugCollisionGetsSuffix(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(), proj("curseforge", "1", "same", "One", true))
	// A different mod on Modrinth with the same slug but another name: it matches by slug, so use a held slot.
	savePoll(t, r, time.Now().Add(time.Minute),
		proj("curseforge", "1", "same", "One", true),
		proj("curseforge", "2", "same", "Two", true))
	list, _ := r.ListCatalog(ctx)
	if len(list) != 2 {
		t.Fatalf("entries = %+v", list)
	}
}

func TestManualLinksSurviveRelink(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "firecorelib", "FireCore Lib", true),
		proj("modrinth", "m1", "firecoremod", "FireCore", true))
	mr := "m1"
	if _, err := r.UpdateCatalogEntry(ctx, "firecorelib", models.CatalogUpdate{ModrinthID: models.Patch[string]{Set: true, Value: &mr}}); err != nil {
		t.Fatal(err)
	}
	list, _ := r.ListCatalog(ctx)
	if len(list) != 1 || list[0].Auto || list[0].ModrinthID == nil {
		t.Fatalf("after merge: %+v", list)
	}
	// A new poll and a relink must leave the hand-made entry alone and not recreate firecoremod.
	savePoll(t, r, time.Now().Add(time.Hour),
		proj("curseforge", "1", "firecorelib", "FireCore Lib", true),
		proj("modrinth", "m1", "firecoremod", "FireCore", true))
	if err := r.AutoLink(ctx); err != nil {
		t.Fatal(err)
	}
	list, _ = r.ListCatalog(ctx)
	if len(list) != 1 || list[0].Slug != "firecorelib" {
		t.Fatalf("after relink: %+v", list)
	}
}

func TestAutoEntryNeverTakesAProjectAManualEntryHolds(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "lib", "Lib", true),
		proj("modrinth", "m1", "core", "Core", true))
	mr := "m1"
	_, _ = r.UpdateCatalogEntry(ctx, "lib", models.CatalogUpdate{ModrinthID: models.Patch[string]{Set: true, Value: &mr}})
	// An unrelated CurseForge project named like the Modrinth one must not join the manual entry.
	savePoll(t, r, time.Now().Add(time.Hour),
		proj("curseforge", "1", "lib", "Lib", true),
		proj("curseforge", "2", "core", "Core", true),
		proj("modrinth", "m1", "core", "Core", true))
	e := entryBySlug(t, r, "lib")
	if e.CurseForgeID == nil || *e.CurseForgeID != 1 {
		t.Errorf("manual entry changed: %+v", e)
	}
	list, _ := r.ListCatalog(ctx)
	if len(list) != 2 {
		t.Errorf("entries = %+v", list)
	}
}

func TestMovingAProjectDeletesTheEmptiedEntry(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "lib", "Lib", true),
		proj("modrinth", "m1", "core", "Core", true))
	mr := "m1"
	got, err := r.UpdateCatalogEntry(ctx, "lib", models.CatalogUpdate{ModrinthID: models.Patch[string]{Set: true, Value: &mr}})
	if err != nil {
		t.Fatal(err)
	}
	if got.Auto {
		t.Error("an edited entry should become manual")
	}
	if _, err := r.GetCatalogEntry(ctx, "core"); !errors.Is(err, ErrNotFound) {
		t.Errorf("core should be gone, err = %v", err)
	}
}

func TestMovingAProjectKeepsAnEntryThatHasOtherLinks(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "lib", "Lib", true),
		proj("curseforge", "2", "core", "Core", true),
		proj("modrinth", "m1", "core", "Core", true))
	// core holds CurseForge 2 and Modrinth m1 (same slug); move CurseForge 2 to lib.
	cf := int64(2)
	if _, err := r.UpdateCatalogEntry(ctx, "lib", models.CatalogUpdate{CurseForgeID: models.Patch[int64]{Set: true, Value: &cf}}); err != nil {
		t.Fatal(err)
	}
	core := entryBySlug(t, r, "core")
	if core.CurseForgeID != nil || core.ModrinthID == nil {
		t.Errorf("core = %+v", core)
	}
}

func TestUpdateValidation(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "a", "A", true),
		proj("curseforge", "2", "b", "B", true))
	one := "ghost"
	cf := int64(99)
	empty := " "
	upper, prefixed, ctrl := "ALPHA", "mod: beta", "bad\x00name"
	long := strings.Repeat("x", 500)
	other := "alpha"
	_, _ = r.UpdateCatalogEntry(ctx, "a", models.CatalogUpdate{GitHubLabel: models.Patch[string]{Set: true, Value: &other}})

	cases := map[string]models.CatalogUpdate{
		"unknown modrinth":  {ModrinthID: models.Patch[string]{Set: true, Value: &one}},
		"unknown cf":        {CurseForgeID: models.Patch[int64]{Set: true, Value: &cf}},
		"empty name":        {Name: &empty},
		"empty label":       {GitHubLabel: models.Patch[string]{Set: true, Value: &empty}},
		"taken label":       {GitHubLabel: models.Patch[string]{Set: true, Value: &other}},
		"taken, other case": {GitHubLabel: models.Patch[string]{Set: true, Value: &upper}},
		"mod: prefix":       {GitHubLabel: models.Patch[string]{Set: true, Value: &prefixed}},
		"long name":         {Name: &long},
		"long label":        {GitHubLabel: models.Patch[string]{Set: true, Value: &long}},
		"control chars":     {Name: &ctrl},
	}
	for name, u := range cases {
		_, err := r.UpdateCatalogEntry(ctx, "b", u)
		var bad *InvalidError
		if !errors.As(err, &bad) {
			t.Errorf("%s: err = %v, want InvalidError", name, err)
		}
	}
	if _, err := r.UpdateCatalogEntry(ctx, "nope", models.CatalogUpdate{}); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown slug: %v", err)
	}
	// A rejected edit changes nothing.
	if e := entryBySlug(t, r, "b"); e.Name != "B" || e.Auto != true {
		t.Errorf("b = %+v", e)
	}
}

func TestNullClearsALink(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "a", "A", true),
		proj("modrinth", "m", "a", "A", true))
	if _, err := r.UpdateCatalogEntry(ctx, "a", models.CatalogUpdate{ModrinthID: models.Patch[string]{Set: true}}); err != nil {
		t.Fatal(err)
	}
	if e := entryBySlug(t, r, "a"); e.ModrinthID != nil || e.CurseForgeID == nil {
		t.Errorf("a = %+v", e)
	}
}

func TestCatalogIndex(t *testing.T) {
	cf := int64(5)
	mr := "m5"
	label := "mod: five"
	ix := NewCatalogIndex([]models.CatalogEntry{{Slug: "five", CurseForgeID: &cf, ModrinthID: &mr, GitHubLabel: &label}, {Slug: "six"}})
	if s, ok := ix.SlugFor("curseforge", "5"); !ok || s != "five" {
		t.Error("curseforge lookup")
	}
	if s, ok := ix.SlugFor("modrinth", "m5"); !ok || s != "five" {
		t.Error("modrinth lookup")
	}
	if s, ok := ix.SlugForLabel("mod: five"); !ok || s != "five" {
		t.Error("label lookup")
	}
	if s, ok := ix.SlugForLabel("six"); !ok || s != "six" {
		t.Error("label equal to slug")
	}
	if len(ix.Keys("five")) != 2 || ix.Keys("nope") != nil {
		t.Error("keys")
	}
}

func TestNormalizeName(t *testing.T) {
	if NormalizeName("Automatic Gui-Scale!") != "automaticguiscale" {
		t.Error("normalise")
	}
}

func TestSlugForLabelIgnoresSlugWhenTheEntryHasItsOwnLabel(t *testing.T) {
	label := "other"
	ix := NewCatalogIndex([]models.CatalogEntry{{Slug: "six", GitHubLabel: &label}})
	if _, ok := ix.SlugForLabel("six"); ok {
		t.Error("slug must not match once githubLabel is set")
	}
	if s, ok := ix.SlugForLabel("other"); !ok || s != "six" {
		t.Error("label must match")
	}
}

func TestLabelLookupIgnoresCase(t *testing.T) {
	label := "Gamma"
	ix := NewCatalogIndex([]models.CatalogEntry{{Slug: "g", GitHubLabel: &label}})
	if s, ok := ix.SlugForLabel("gamma"); !ok || s != "g" {
		t.Errorf("lookup = %q %v", s, ok)
	}
}

func TestClearingEveryLinkDeletesTheEntryAndRelinkKeepsTheSlug(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(),
		proj("curseforge", "1", "beta", "Beta", true),
		proj("modrinth", "m", "beta", "Beta", true))
	null := models.CatalogUpdate{
		CurseForgeID: models.Patch[int64]{Set: true},
		ModrinthID:   models.Patch[string]{Set: true},
		GitHubLabel:  models.Patch[string]{Set: true},
	}
	if _, err := r.UpdateCatalogEntry(ctx, "beta", null); err != nil {
		t.Fatal(err)
	}
	if _, err := r.GetCatalogEntry(ctx, "beta"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("empty entry should be gone, err = %v", err)
	}
	if err := r.AutoLink(ctx); err != nil {
		t.Fatal(err)
	}
	list, _ := r.ListCatalog(ctx)
	if len(list) != 1 || list[0].Slug != "beta" {
		t.Errorf("entries = %+v", list)
	}
}

func TestLegacyFlagSavesAndLeavesTheEntryAutomatic(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	savePoll(t, r, time.Now(), proj("curseforge", "1", "a", "A", true))
	if entryBySlug(t, r, "a").Legacy {
		t.Fatal("legacy must default to false")
	}
	yes := true
	if _, err := r.UpdateCatalogEntry(ctx, "a", models.CatalogUpdate{Legacy: &yes}); err != nil {
		t.Fatal(err)
	}
	if e := entryBySlug(t, r, "a"); !e.Legacy || !e.Auto {
		t.Errorf("a = %+v", e)
	}
	no := false
	if _, err := r.UpdateCatalogEntry(ctx, "a", models.CatalogUpdate{Legacy: &no}); err != nil {
		t.Fatal(err)
	}
	if entryBySlug(t, r, "a").Legacy {
		t.Error("legacy should clear")
	}
	name := "Renamed"
	if _, err := r.UpdateCatalogEntry(ctx, "a", models.CatalogUpdate{Name: &name}); err != nil {
		t.Fatal(err)
	}
	if entryBySlug(t, r, "a").Auto {
		t.Error("a rename should make the entry hand-made")
	}
}
