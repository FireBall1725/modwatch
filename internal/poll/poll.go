// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package poll fetches the author's mods on a schedule and stores a snapshot of each download count.
package poll

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/providers/curseforge"
	"github.com/fireball1725/modwatch/internal/providers/modrinth"
	"github.com/fireball1725/modwatch/internal/repository"
)

// ErrRunning is returned by Start when a poll is already in progress.
var ErrRunning = errors.New("a poll is already running")

// ErrNotConfigured is returned by Start when the CurseForge key or author ID is missing.
var ErrNotConfigured = errors.New("CURSEFORGE_API_KEY and CURSEFORGE_AUTHOR_ID must both be set")

// CurseForge lists an author's mods and a mod's files.
type CurseForge interface {
	ListByAuthor(ctx context.Context, authorID int, ownerOnly bool) ([]curseforge.Mod, error)
	ListFiles(ctx context.Context, modID int) ([]curseforge.File, error)
}

// Modrinth lists a user's projects and a project's versions.
type Modrinth interface {
	ListProjects(ctx context.Context, user string) ([]modrinth.Project, error)
	ListVersions(ctx context.Context, projectID string) ([]modrinth.Version, error)
}

// Service runs one poll at a time.
type Service struct {
	// ctx is the process context. A poll started from a request must outlive that request.
	ctx  context.Context
	cfg  *config.Config
	repo *repository.Repo
	cf   CurseForge
	mr   Modrinth // nil when Modrinth is not configured
	now  func() time.Time

	mu      sync.Mutex
	running bool
}

func New(ctx context.Context, cfg *config.Config, repo *repository.Repo, cf CurseForge, mr Modrinth) *Service {
	return &Service{ctx: ctx, cfg: cfg, repo: repo, cf: cf, mr: mr, now: time.Now}
}

// Running reports whether a poll is in progress.
func (s *Service) Running() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// Start begins a poll in the background and returns at once.
func (s *Service) Start() error {
	if !s.cfg.CanPoll() {
		return ErrNotConfigured
	}
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return ErrRunning
	}
	s.running = true
	s.mu.Unlock()

	go func() {
		defer func() {
			s.mu.Lock()
			s.running = false
			s.mu.Unlock()
		}()
		if err := s.Run(s.ctx); err != nil {
			slog.Error("poll failed", "error", err)
		}
	}()
	return nil
}

// Run does one poll and stores the outcome, success or failure.
//
// The CurseForge mod list decides whether the poll succeeded. Per-file counts and Modrinth are extras:
// if they fail, the totals still save and the source's status says what went wrong.
func (s *Service) Run(ctx context.Context) error {
	started := s.now()
	readings, err := s.fetch(ctx)
	p := models.Poll{StartedAt: started, FinishedAt: s.now()}
	if err != nil {
		p.State, p.Error = models.PollError, err.Error()
		failed := []models.SourceStatus{{Source: models.SourceCurseForge, Error: err.Error(), CheckedAt: p.FinishedAt}}
		if saveErr := s.repo.SaveFailedPoll(ctx, p, failed); saveErr != nil {
			return errors.Join(err, saveErr)
		}
		return err
	}

	files, statuses := s.fetchFiles(ctx, readings)
	p.FinishedAt = s.now()
	for i := range statuses {
		statuses[i].CheckedAt = p.FinishedAt
		if statuses[i].OK {
			statuses[i].LastOKAt = p.FinishedAt
		}
	}
	p.State, p.Mods = models.PollOK, len(readings)
	if _, err := s.repo.SavePoll(ctx, p, readings, files, statuses); err != nil {
		return fmt.Errorf("saving poll: %w", err)
	}
	slog.Info("poll finished", "mods", len(readings), "files", len(files), "took", p.FinishedAt.Sub(p.StartedAt).Round(time.Millisecond))
	for _, st := range statuses {
		if !st.OK {
			slog.Warn("source incomplete", "source", st.Source, "error", st.Error)
		}
	}
	return nil
}

// fetch asks for every mod the author is on, then marks the ones they own.
func (s *Service) fetch(ctx context.Context) ([]models.Reading, error) {
	member, err := s.cf.ListByAuthor(ctx, s.cfg.CurseForgeAuthorID, false)
	if err != nil {
		return nil, err
	}
	owned, err := s.cf.ListByAuthor(ctx, s.cfg.CurseForgeAuthorID, true)
	if err != nil {
		return nil, err
	}

	byID := map[int]curseforge.Mod{}
	isOwned := map[int]bool{}
	for _, m := range member {
		byID[m.ID] = m
	}
	// A mod can show up as owned without showing as a membership; keep it either way.
	for _, m := range owned {
		byID[m.ID] = m
		isOwned[m.ID] = true
	}

	out := make([]models.Reading, 0, len(byID))
	for id, m := range byID {
		out = append(out, models.Reading{
			Mod: models.Mod{
				ID: id, Slug: m.Slug, Name: m.Name, Summary: m.Summary, LogoURL: m.LogoURL(),
				WebsiteURL: m.Links.WebsiteURL, Owned: isOwned[id],
				DateCreated: m.DateCreated, DateModified: m.DateModified,
			},
			Downloads: m.DownloadCount,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

// fetchFiles reads per-file counts: CurseForge files for the mods the author owns, and every Modrinth version.
// Files of mods the author is only a member of are skipped; Applied Energistics 2 alone has hundreds.
func (s *Service) fetchFiles(ctx context.Context, readings []models.Reading) ([]models.FileReading, []models.SourceStatus) {
	files, cfErrs := s.curseForgeFiles(ctx, readings)
	statuses := []models.SourceStatus{status(models.SourceCurseForge, cfErrs)}

	if s.mr != nil && s.cfg.CanPollModrinth() {
		mrFiles, mrErrs := s.modrinthFiles(ctx)
		files = append(files, mrFiles...)
		statuses = append(statuses, status(models.SourceModrinth, mrErrs))
	}
	return files, statuses
}

func status(source string, errs []string) models.SourceStatus {
	st := models.SourceStatus{Source: source, OK: len(errs) == 0}
	if len(errs) > 0 {
		st.Error = strings.Join(errs, "; ")
	}
	return st
}

func (s *Service) curseForgeFiles(ctx context.Context, readings []models.Reading) ([]models.FileReading, []string) {
	var out []models.FileReading
	var errs []string
	for _, rd := range readings {
		if !rd.Owned {
			continue
		}
		files, err := s.cf.ListFiles(ctx, rd.ID)
		if err != nil {
			errs = append(errs, fmt.Sprintf("files of %s: %v", rd.Slug, err))
			continue
		}
		for _, f := range files {
			mc, loaders := curseforge.Classify(f.GameVersions)
			out = append(out, models.FileReading{
				File: models.File{
					Source: models.SourceCurseForge, ID: strconv.Itoa(f.ID),
					ProjectID: strconv.Itoa(rd.ID), ProjectSlug: rd.Slug, ProjectName: rd.Name,
					Name: f.DisplayName, Version: versionOf(f.DisplayName, rd.Name), ReleaseType: f.ReleaseName(),
					GameVersions: mc, Loaders: loaders, PublishedAt: f.FileDate,
				},
				Downloads: f.DownloadCount,
			})
		}
	}
	return out, errs
}

// versionOf drops the project name from a CurseForge display name ("Create: Turbolifts 26.11.0-rc.2" becomes "26.11.0-rc.2").
func versionOf(displayName, project string) string {
	v := strings.TrimSpace(strings.TrimPrefix(displayName, project))
	if v == "" {
		return displayName
	}
	return v
}

func (s *Service) modrinthFiles(ctx context.Context) ([]models.FileReading, []string) {
	projects, err := s.mr.ListProjects(ctx, s.cfg.ModrinthUser)
	if err != nil {
		return nil, []string{err.Error()}
	}
	var out []models.FileReading
	var errs []string
	for _, pr := range projects {
		versions, err := s.mr.ListVersions(ctx, pr.ID)
		if err != nil {
			errs = append(errs, fmt.Sprintf("versions of %s: %v", pr.Slug, err))
			continue
		}
		for _, v := range versions {
			out = append(out, models.FileReading{
				File: models.File{
					Source: models.SourceModrinth, ID: v.ID,
					ProjectID: pr.ID, ProjectSlug: pr.Slug, ProjectName: pr.Title,
					Name: v.Name, Version: v.VersionNumber, ReleaseType: v.VersionType,
					GameVersions: v.GameVersions, Loaders: v.Loaders, PublishedAt: v.DatePublished,
				},
				Downloads: v.Downloads,
			})
		}
	}
	return out, errs
}
