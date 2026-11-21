// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/release"
)

// ErrNotFound is returned for an entry slug that doesn't exist.
var ErrNotFound = errors.New("no such catalog entry")

// InvalidError is a rejected edit; its text is safe to show the author.
type InvalidError struct{ Msg string }

func (e *InvalidError) Error() string { return e.Msg }

// Platform names as stored in platform_projects.
const (
	PlatformCurseForge = "curseforge"
	PlatformModrinth   = "modrinth"
)

// NormalizeName lowercases a name and keeps only letters and digits, so "Automatic Gui Scale" and "automatic-gui-scale" match.
func NormalizeName(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

type queryer interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

const entryColumns = `slug, name, curseforge_id, modrinth_id, github_label, github_repo, version_regex, hidden, legacy, auto`

type rowScanner interface{ Scan(dest ...any) error }

func scanEntry(row rowScanner) (models.CatalogEntry, error) {
	var e models.CatalogEntry
	var cf sql.NullInt64
	var mr, gh, repo, vre sql.NullString
	if err := row.Scan(&e.Slug, &e.Name, &cf, &mr, &gh, &repo, &vre, &e.Hidden, &e.Legacy, &e.Auto); err != nil {
		return e, err
	}
	if cf.Valid {
		e.CurseForgeID = &cf.Int64
	}
	if mr.Valid {
		e.ModrinthID = &mr.String
	}
	if gh.Valid {
		e.GitHubLabel = &gh.String
	}
	if repo.Valid {
		e.GitHubRepo = &repo.String
	}
	if vre.Valid {
		e.VersionRegex = &vre.String
	}
	return e, nil
}

func listEntries(ctx context.Context, q queryer) ([]models.CatalogEntry, error) {
	rows, err := q.QueryContext(ctx, `SELECT `+entryColumns+` FROM catalog ORDER BY lower(name), slug`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []models.CatalogEntry{}
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ListCatalog returns every entry sorted by name, never nil.
func (r *Repo) ListCatalog(ctx context.Context) ([]models.CatalogEntry, error) {
	return listEntries(ctx, r.db)
}

// GetCatalogEntry returns one entry or ErrNotFound.
func (r *Repo) GetCatalogEntry(ctx context.Context, slug string) (models.CatalogEntry, error) {
	e, err := scanEntry(r.db.QueryRowContext(ctx, `SELECT `+entryColumns+` FROM catalog WHERE slug = $1`, slug))
	if errors.Is(err, sql.ErrNoRows) {
		return e, ErrNotFound
	}
	return e, err
}

// ListUnlinkedProjects returns the projects of each platform's latest refresh that no entry holds, by name.
func (r *Repo) ListUnlinkedProjects(ctx context.Context) ([]models.UnlinkedProject, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT p.platform, p.id, p.slug, p.name, p.icon_url, p.url, p.owned
		FROM platform_projects p
		WHERE p.last_poll_id = (SELECT MAX(x.last_poll_id) FROM platform_projects x WHERE x.platform = p.platform)
		  AND NOT EXISTS (SELECT 1 FROM catalog c
		       WHERE (p.platform = 'curseforge' AND CAST(c.curseforge_id AS TEXT) = p.id)
		          OR (p.platform = 'modrinth' AND c.modrinth_id = p.id))
		ORDER BY lower(p.name), p.platform, p.id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []models.UnlinkedProject{}
	for rows.Next() {
		var u models.UnlinkedProject
		if err := rows.Scan(&u.Platform, &u.ID, &u.Slug, &u.Name, &u.IconURL, &u.URL, &u.Owned); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

type projectRef struct{ slug, name string }

// currentOwned returns the owned projects the latest refresh of each platform saw, keyed by platform and id.
func currentOwned(ctx context.Context, q queryer) ([]models.UnlinkedProject, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT p.platform, p.id, p.slug, p.name, p.icon_url, p.url, p.owned
		FROM platform_projects p
		WHERE p.owned
		  AND p.last_poll_id = (SELECT MAX(x.last_poll_id) FROM platform_projects x WHERE x.platform = p.platform)
		ORDER BY p.platform, p.id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []models.UnlinkedProject
	for rows.Next() {
		var u models.UnlinkedProject
		if err := rows.Scan(&u.Platform, &u.ID, &u.Slug, &u.Name, &u.IconURL, &u.URL, &u.Owned); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func lookupProject(ctx context.Context, q queryer, platform, id string) (projectRef, bool, error) {
	var p projectRef
	err := q.QueryRowContext(ctx, `SELECT slug, name FROM platform_projects WHERE platform = $1 AND id = $2`, platform, id).Scan(&p.slug, &p.name)
	if errors.Is(err, sql.ErrNoRows) {
		return p, false, nil
	}
	return p, err == nil, err
}

// AutoLink links every owned project no entry holds: into an automatic entry that has the other platform's project with
// the same slug or normalised name, or into a new single-platform entry. Hand-made entries are never touched.
func (r *Repo) AutoLink(ctx context.Context) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := autoLink(ctx, tx); err != nil {
		return err
	}
	return tx.Commit()
}

func autoLink(ctx context.Context, q queryer) error {
	entries, err := listEntries(ctx, q)
	if err != nil {
		return err
	}
	projects, err := currentOwned(ctx, q)
	if err != nil {
		return err
	}

	held := map[models.PlatformKey]bool{}
	slugs := map[string]bool{}
	for _, e := range entries {
		slugs[e.Slug] = true
		if e.CurseForgeID != nil {
			held[models.PlatformKey{Platform: PlatformCurseForge, ID: strconv.FormatInt(*e.CurseForgeID, 10)}] = true
		}
		if e.ModrinthID != nil {
			held[models.PlatformKey{Platform: PlatformModrinth, ID: *e.ModrinthID}] = true
		}
	}

	for _, p := range projects {
		key := models.PlatformKey{Platform: p.Platform, ID: p.ID}
		if held[key] {
			continue
		}
		cfID, cfErr := strconv.ParseInt(p.ID, 10, 64)
		if p.Platform == PlatformCurseForge && cfErr != nil {
			continue
		}

		target, err := matchEntry(ctx, q, entries, p)
		if err != nil {
			return err
		}
		if target >= 0 {
			e := &entries[target]
			if p.Platform == PlatformCurseForge {
				e.CurseForgeID = &cfID
				_, err = q.ExecContext(ctx, `UPDATE catalog SET curseforge_id = $1 WHERE slug = $2`, cfID, e.Slug)
			} else {
				id := p.ID
				e.ModrinthID = &id
				_, err = q.ExecContext(ctx, `UPDATE catalog SET modrinth_id = $1 WHERE slug = $2`, id, e.Slug)
			}
			if err != nil {
				return err
			}
			held[key] = true
			continue
		}

		e := models.CatalogEntry{Slug: freeSlug(slugs, p), Name: p.Name, Auto: true}
		if p.Platform == PlatformCurseForge {
			e.CurseForgeID = &cfID
		} else {
			id := p.ID
			e.ModrinthID = &id
		}
		if _, err := q.ExecContext(ctx, `
			INSERT INTO catalog (slug, name, curseforge_id, modrinth_id, github_label, hidden, legacy, auto) VALUES ($1, $2, $3, $4, NULL, FALSE, FALSE, TRUE)`,
			e.Slug, e.Name, e.CurseForgeID, e.ModrinthID); err != nil {
			return err
		}
		slugs[e.Slug] = true
		held[key] = true
		entries = append(entries, e)
	}
	return nil
}

// matchEntry finds an automatic entry with an empty slot for p's platform whose other-platform project shares p's slug
// (preferred) or normalised name. It returns -1 when there is none.
func matchEntry(ctx context.Context, q queryer, entries []models.CatalogEntry, p models.UnlinkedProject) (int, error) {
	norm := NormalizeName(p.Name)
	byName := -1
	for i, e := range entries {
		if !e.Auto {
			continue
		}
		var other projectRef
		var ok bool
		var err error
		switch {
		case p.Platform == PlatformCurseForge && e.CurseForgeID == nil && e.ModrinthID != nil:
			other, ok, err = lookupProject(ctx, q, PlatformModrinth, *e.ModrinthID)
		case p.Platform == PlatformModrinth && e.ModrinthID == nil && e.CurseForgeID != nil:
			other, ok, err = lookupProject(ctx, q, PlatformCurseForge, strconv.FormatInt(*e.CurseForgeID, 10))
		default:
			continue
		}
		if err != nil {
			return -1, err
		}
		if !ok {
			continue
		}
		if p.Slug != "" && strings.EqualFold(other.slug, p.Slug) {
			return i, nil
		}
		if byName < 0 && norm != "" && NormalizeName(other.name) == norm {
			byName = i
		}
	}
	return byName, nil
}

// freeSlug picks the project's slug, or a suffixed one when an entry already uses it.
func freeSlug(taken map[string]bool, p models.UnlinkedProject) string {
	base := strings.ToLower(strings.TrimSpace(p.Slug))
	if base == "" {
		base = NormalizeName(p.Name)
	}
	if base == "" {
		base = p.Platform + "-" + p.ID
	}
	if !taken[base] {
		return base
	}
	if c := base + "-" + p.Platform; !taken[c] {
		return c
	}
	for n := 2; ; n++ {
		if c := fmt.Sprintf("%s-%s-%d", base, p.Platform, n); !taken[c] {
			return c
		}
	}
}

func invalid(format string, a ...any) error { return &InvalidError{Msg: fmt.Sprintf(format, a...)} }

// Limits on hand-typed catalog text.
const (
	MaxNameRunes  = 120
	MaxLabelRunes = 100
)

func hasControl(s string) bool {
	for _, r := range s {
		if unicode.IsControl(r) {
			return true
		}
	}
	return false
}

// UpdateCatalogEntry applies a partial edit in one transaction. The edited entry becomes a hand-made one. A project
// another entry holds moves here, and that entry is deleted if it is left with no links. It returns *InvalidError for a
// rejected edit and ErrNotFound for an unknown slug.
func (r *Repo) UpdateCatalogEntry(ctx context.Context, slug string, u models.CatalogUpdate) (models.CatalogEntry, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return models.CatalogEntry{}, err
	}
	defer func() { _ = tx.Rollback() }()

	e, err := scanEntry(tx.QueryRowContext(ctx, `SELECT `+entryColumns+` FROM catalog WHERE slug = $1`, slug))
	if errors.Is(err, sql.ErrNoRows) {
		return e, ErrNotFound
	}
	if err != nil {
		return e, err
	}

	if u.Name != nil {
		name := strings.TrimSpace(*u.Name)
		if name == "" {
			return e, invalid("name can't be empty")
		}
		if utf8.RuneCountInString(name) > MaxNameRunes {
			return e, invalid("name can't be longer than %d characters", MaxNameRunes)
		}
		if hasControl(name) {
			return e, invalid("name can't contain control characters")
		}
		e.Name = name
	}
	if u.Hidden != nil {
		e.Hidden = *u.Hidden
	}

	if u.Legacy != nil {
		e.Legacy = *u.Legacy
	}

	var donors []string
	if u.CurseForgeID.Set {
		e.CurseForgeID = u.CurseForgeID.Value
		if e.CurseForgeID != nil {
			id := strconv.FormatInt(*e.CurseForgeID, 10)
			if _, ok, err := lookupProject(ctx, tx, PlatformCurseForge, id); err != nil {
				return e, err
			} else if !ok {
				return e, invalid("no CurseForge project with id %s", id)
			}
			var holder string
			err := tx.QueryRowContext(ctx, `SELECT slug FROM catalog WHERE curseforge_id = $1 AND slug <> $2`, *e.CurseForgeID, slug).Scan(&holder)
			if err == nil {
				if _, err := tx.ExecContext(ctx, `UPDATE catalog SET curseforge_id = NULL WHERE slug = $1`, holder); err != nil {
					return e, err
				}
				donors = append(donors, holder)
			} else if !errors.Is(err, sql.ErrNoRows) {
				return e, err
			}
		}
	}
	if u.ModrinthID.Set {
		e.ModrinthID = u.ModrinthID.Value
		if e.ModrinthID != nil {
			if _, ok, err := lookupProject(ctx, tx, PlatformModrinth, *e.ModrinthID); err != nil {
				return e, err
			} else if !ok {
				return e, invalid("no Modrinth project with id %s", *e.ModrinthID)
			}
			var holder string
			err := tx.QueryRowContext(ctx, `SELECT slug FROM catalog WHERE modrinth_id = $1 AND slug <> $2`, *e.ModrinthID, slug).Scan(&holder)
			if err == nil {
				if _, err := tx.ExecContext(ctx, `UPDATE catalog SET modrinth_id = NULL WHERE slug = $1`, holder); err != nil {
					return e, err
				}
				donors = append(donors, holder)
			} else if !errors.Is(err, sql.ErrNoRows) {
				return e, err
			}
		}
	}
	if u.GitHubLabel.Set {
		e.GitHubLabel = u.GitHubLabel.Value
		if e.GitHubLabel != nil {
			label := strings.TrimSpace(*e.GitHubLabel)
			if label == "" {
				return e, invalid("githubLabel can't be empty; send null to clear it")
			}
			if utf8.RuneCountInString(label) > MaxLabelRunes {
				return e, invalid("githubLabel can't be longer than %d characters", MaxLabelRunes)
			}
			if hasControl(label) {
				return e, invalid("githubLabel can't contain control characters")
			}
			if len(label) >= 4 && strings.EqualFold(label[:4], "mod:") {
				return e, invalid("githubLabel is the text after \"mod: \"; leave the prefix off")
			}
			e.GitHubLabel = &label
			var holder string
			err := tx.QueryRowContext(ctx, `SELECT slug FROM catalog WHERE lower(github_label) = lower($1) AND slug <> $2`, label, slug).Scan(&holder)
			if err == nil {
				return e, invalid("label %q is already linked to %s", label, holder)
			} else if !errors.Is(err, sql.ErrNoRows) {
				return e, err
			}
		}
	}

	if u.GitHubRepo.Set {
		e.GitHubRepo = u.GitHubRepo.Value
		if e.GitHubRepo != nil {
			repo := strings.TrimSpace(*e.GitHubRepo)
			if !config.ValidRepo(repo) {
				return e, invalid("githubRepo must look like owner/name; send null to clear it")
			}
			e.GitHubRepo = &repo
			var holder string
			err := tx.QueryRowContext(ctx, `SELECT slug FROM catalog WHERE lower(github_repo) = lower($1) AND slug <> $2`, repo, slug).Scan(&holder)
			if err == nil {
				return e, invalid("repository %q is already linked to %s", repo, holder)
			} else if !errors.Is(err, sql.ErrNoRows) {
				return e, err
			}
		}
	}

	if u.VersionRegex.Set {
		e.VersionRegex = u.VersionRegex.Value
		if e.VersionRegex != nil {
			pattern := strings.TrimSpace(*e.VersionRegex)
			if pattern == "" {
				return e, invalid("versionRegex can't be empty; send null to use the default reading")
			}
			if _, err := release.Compile(pattern); err != nil {
				return e, invalid("%s", err.Error())
			}
			e.VersionRegex = &pattern
		}
	}

	// Only a change to the name or the links makes an entry hand-made. Flipping hidden or legacy leaves it as the matcher had it.
	if u.Name != nil || u.CurseForgeID.Set || u.ModrinthID.Set || u.GitHubLabel.Set || u.GitHubRepo.Set {
		e.Auto = false
	}
	// An edit that clears every link leaves nothing to show; drop the entry so a relink can reuse its slug.
	if e.CurseForgeID == nil && e.ModrinthID == nil && e.GitHubLabel == nil && e.GitHubRepo == nil &&
		(u.CurseForgeID.Set || u.ModrinthID.Set || u.GitHubLabel.Set || u.GitHubRepo.Set) {
		if _, err := tx.ExecContext(ctx, `DELETE FROM catalog WHERE slug = $1`, slug); err != nil {
			return e, err
		}
		for _, d := range donors {
			if _, err := tx.ExecContext(ctx, `
				DELETE FROM catalog WHERE slug = $1 AND curseforge_id IS NULL AND modrinth_id IS NULL AND github_label IS NULL AND github_repo IS NULL`, d); err != nil {
				return e, err
			}
		}
		if err := tx.Commit(); err != nil {
			return e, err
		}
		return e, nil
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE catalog SET name = $1, curseforge_id = $2, modrinth_id = $3, github_label = $4, github_repo = $5, version_regex = $6, hidden = $7, legacy = $8, auto = $9 WHERE slug = $10`,
		e.Name, e.CurseForgeID, e.ModrinthID, e.GitHubLabel, e.GitHubRepo, e.VersionRegex, e.Hidden, e.Legacy, e.Auto, slug); err != nil {
		return e, err
	}
	for _, d := range donors {
		if _, err := tx.ExecContext(ctx, `
			DELETE FROM catalog WHERE slug = $1 AND curseforge_id IS NULL AND modrinth_id IS NULL AND github_label IS NULL AND github_repo IS NULL`, d); err != nil {
			return e, err
		}
	}
	if err := tx.Commit(); err != nil {
		return e, err
	}
	return e, nil
}

// CatalogIndex resolves platform projects and labels to entry slugs and back without more queries.
type CatalogIndex struct {
	entries map[string]models.CatalogEntry
	byKey   map[models.PlatformKey]string
	byLabel map[string]string
	byRepo  map[string]string
}

// NewCatalogIndex indexes a list of entries.
func NewCatalogIndex(entries []models.CatalogEntry) *CatalogIndex {
	ix := &CatalogIndex{
		entries: make(map[string]models.CatalogEntry, len(entries)),
		byKey:   map[models.PlatformKey]string{},
		byLabel: map[string]string{},
		byRepo:  map[string]string{},
	}
	for _, e := range entries {
		ix.entries[e.Slug] = e
		if e.CurseForgeID != nil {
			ix.byKey[models.PlatformKey{Platform: PlatformCurseForge, ID: strconv.FormatInt(*e.CurseForgeID, 10)}] = e.Slug
		}
		if e.ModrinthID != nil {
			ix.byKey[models.PlatformKey{Platform: PlatformModrinth, ID: *e.ModrinthID}] = e.Slug
		}
		if e.GitHubLabel != nil {
			ix.byLabel[strings.ToLower(*e.GitHubLabel)] = e.Slug
		}
		if e.GitHubRepo != nil {
			ix.byRepo[strings.ToLower(*e.GitHubRepo)] = e.Slug
		}
	}
	return ix
}

// CatalogIndex reads the entries and indexes them.
func (r *Repo) CatalogIndex(ctx context.Context) (*CatalogIndex, error) {
	entries, err := r.ListCatalog(ctx)
	if err != nil {
		return nil, err
	}
	return NewCatalogIndex(entries), nil
}

// SlugFor returns the slug of the entry holding a platform project.
func (ix *CatalogIndex) SlugFor(platform, id string) (string, bool) {
	s, ok := ix.byKey[models.PlatformKey{Platform: platform, ID: id}]
	return s, ok
}

// SlugForRepo returns the slug of the entry whose own issues repository is repo.
func (ix *CatalogIndex) SlugForRepo(repo string) (string, bool) {
	s, ok := ix.byRepo[strings.ToLower(repo)]
	return s, ok
}

// Repos returns every per-mod issues repository, sorted.
func (ix *CatalogIndex) Repos() []string {
	out := []string{}
	for _, e := range ix.entries {
		if e.GitHubRepo != nil {
			out = append(out, *e.GitHubRepo)
		}
	}
	sort.Strings(out)
	return out
}

// SlugForLabel returns the slug of the entry whose githubLabel is label, or whose slug equals it
// when that entry has no githubLabel of its own. The label is the text after "mod: ".
func (ix *CatalogIndex) SlugForLabel(label string) (string, bool) {
	if s, ok := ix.byLabel[strings.ToLower(label)]; ok {
		return s, true
	}
	if e, ok := ix.entries[strings.ToLower(label)]; ok && (e.GitHubLabel == nil || *e.GitHubLabel == "") {
		return e.Slug, true
	}
	return "", false
}

// Entry returns the entry for a slug.
func (ix *CatalogIndex) Entry(slug string) (models.CatalogEntry, bool) {
	e, ok := ix.entries[slug]
	return e, ok
}

// Keys returns the platform projects an entry holds, CurseForge first.
func (ix *CatalogIndex) Keys(slug string) []models.PlatformKey {
	e, ok := ix.entries[slug]
	if !ok {
		return nil
	}
	var out []models.PlatformKey
	if e.CurseForgeID != nil {
		out = append(out, models.PlatformKey{Platform: PlatformCurseForge, ID: strconv.FormatInt(*e.CurseForgeID, 10)})
	}
	if e.ModrinthID != nil {
		out = append(out, models.PlatformKey{Platform: PlatformModrinth, ID: *e.ModrinthID})
	}
	return out
}
