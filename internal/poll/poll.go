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
	"sync"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/providers/curseforge"
	"github.com/fireball1725/modwatch/internal/repository"
)

// ErrRunning is returned by Start when a poll is already in progress.
var ErrRunning = errors.New("a poll is already running")

// ErrNotConfigured is returned by Start when the CurseForge key or author ID is missing.
var ErrNotConfigured = errors.New("CURSEFORGE_API_KEY and CURSEFORGE_AUTHOR_ID must both be set")

// Source lists an author's mods. The CurseForge client is the only one so far; GitHub and Modrinth would be others.
type Source interface {
	ListByAuthor(ctx context.Context, authorID int, ownerOnly bool) ([]curseforge.Mod, error)
}

// Service runs one poll at a time.
type Service struct {
	// ctx is the process context. A poll started from a request must outlive that request.
	ctx  context.Context
	cfg  *config.Config
	repo *repository.Repo
	src  Source
	now  func() time.Time

	mu      sync.Mutex
	running bool
}

func New(ctx context.Context, cfg *config.Config, repo *repository.Repo, src Source) *Service {
	return &Service{ctx: ctx, cfg: cfg, repo: repo, src: src, now: time.Now}
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
func (s *Service) Run(ctx context.Context) error {
	started := s.now()
	readings, err := s.fetch(ctx)
	p := models.Poll{StartedAt: started, FinishedAt: s.now()}
	if err != nil {
		p.State, p.Error = models.PollError, err.Error()
		if saveErr := s.repo.SaveFailedPoll(ctx, p); saveErr != nil {
			return errors.Join(err, saveErr)
		}
		return err
	}
	p.State, p.Mods = models.PollOK, len(readings)
	if _, err := s.repo.SavePoll(ctx, p, readings); err != nil {
		return fmt.Errorf("saving poll: %w", err)
	}
	slog.Info("poll finished", "mods", len(readings), "took", p.FinishedAt.Sub(p.StartedAt).Round(time.Millisecond))
	return nil
}

// fetch asks for every mod the author is on, then marks the ones they own.
func (s *Service) fetch(ctx context.Context) ([]models.Reading, error) {
	member, err := s.src.ListByAuthor(ctx, s.cfg.CurseForgeAuthorID, false)
	if err != nil {
		return nil, err
	}
	owned, err := s.src.ListByAuthor(ctx, s.cfg.CurseForgeAuthorID, true)
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
