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
	"unicode"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/providers/curseforge"
	"github.com/fireball1725/modwatch/internal/providers/github"
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

// GitHub lists the issues of the configured repository.
type GitHub interface {
	ListIssues(ctx context.Context) ([]models.Issue, error)
}

// Service runs one poll at a time.
type Service struct {
	// ctx is the process context. A poll started from a request must outlive that request.
	ctx  context.Context
	cfg  *config.Config
	repo *repository.Repo
	cf   CurseForge
	mr   Modrinth // nil when Modrinth is not configured
	gh   GitHub   // nil when issues are off
	now  func() time.Time

	mu      sync.Mutex
	running bool
	wg      sync.WaitGroup
}

// Wait blocks until a running poll has finished or timeout passes, and reports whether it finished.
// Call it after cancelling the service's context and before closing the database.
func (s *Service) Wait(timeout time.Duration) bool {
	done := make(chan struct{})
	go func() { s.wg.Wait(); close(done) }()
	select {
	case <-done:
		return true
	case <-time.After(timeout):
		return false
	}
}

func New(ctx context.Context, cfg *config.Config, repo *repository.Repo, cf CurseForge, mr Modrinth) *Service {
	return &Service{ctx: ctx, cfg: cfg, repo: repo, cf: cf, mr: mr, now: time.Now}
}

// WithGitHub turns issue polling on. A nil client leaves it off.
func (s *Service) WithGitHub(gh GitHub) *Service {
	s.gh = gh
	return s
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
	s.wg.Add(1)
	s.mu.Unlock()

	go func() {
		defer s.wg.Done()
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
	readings, cfProjects, err := s.fetch(ctx)
	p := models.Poll{StartedAt: started, FinishedAt: s.now()}
	if err != nil {
		p.State, p.Error = models.PollError, err.Error()
		failed := []models.SourceStatus{{Source: models.SourceCurseForge, Error: err.Error(), CheckedAt: p.FinishedAt}}
		// Record the failure even when the poll was cancelled by a shutdown.
		saveCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if saveErr := s.repo.SaveFailedPoll(saveCtx, p, failed); saveErr != nil {
			return errors.Join(err, saveErr)
		}
		return err
	}

	files, mrProjects, statuses := s.fetchFiles(ctx, readings)
	p.FinishedAt = s.now()
	for i := range statuses {
		statuses[i].CheckedAt = p.FinishedAt
		if statuses[i].OK {
			statuses[i].LastOKAt = p.FinishedAt
		}
	}
	issues, issuesOK, ghStatus := s.fetchIssues(ctx)
	if ghStatus != nil {
		ghStatus.CheckedAt = p.FinishedAt
		if ghStatus.OK {
			ghStatus.LastOKAt = p.FinishedAt
		}
		statuses = append(statuses, *ghStatus)
	}
	p.State, p.Mods = models.PollOK, len(readings)
	pollID, err := s.repo.SavePollWithProjects(ctx, p, readings, files, append(cfProjects, mrProjects...), statuses)
	if err != nil {
		return fmt.Errorf("saving poll: %w", err)
	}
	// A failed GitHub call leaves the last stored issues in place.
	if issuesOK {
		if err := s.repo.SaveIssues(ctx, pollID, issues); err != nil {
			slog.Warn("saving issues", "error", err)
		}
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
func (s *Service) fetch(ctx context.Context) ([]models.Reading, []models.PlatformReading, error) {
	member, err := s.cf.ListByAuthor(ctx, s.cfg.CurseForgeAuthorID, false)
	if err != nil {
		return nil, nil, err
	}
	owned, err := s.cf.ListByAuthor(ctx, s.cfg.CurseForgeAuthorID, true)
	if err != nil {
		return nil, nil, err
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

	// An empty list means a wrong author id or an upstream glitch; saving it would blank the dashboard.
	if len(byID) == 0 {
		return nil, nil, errors.New("CurseForge returned no mods for the author; keeping the last good poll")
	}

	out := make([]models.Reading, 0, len(byID))
	projects := make([]models.PlatformReading, 0, len(byID))
	for id, m := range byID {
		projects = append(projects, curseForgeProject(m, isOwned[id]))
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
	sort.Slice(projects, func(i, j int) bool { return projects[i].ID < projects[j].ID })
	return out, projects, nil
}

// zeroIfUnset keeps the zero time for a date the platform left out, which JSON decoding reads as year 1.
func zeroIfUnset(t time.Time) time.Time {
	if t.Year() <= 1 {
		return time.Time{}
	}
	return t
}

func curseForgeProject(m curseforge.Mod, owned bool) models.PlatformReading {
	st, raw := m.Review()
	return models.PlatformReading{
		PlatformProject: models.PlatformProject{
			Platform: models.SourceCurseForge, ID: strconv.Itoa(m.ID), Slug: m.Slug, Name: m.Name, Summary: m.Summary,
			IconURL: m.LogoURL(), URL: m.Links.WebsiteURL, RawStatus: raw, Status: st,
			Followers: int64(m.ThumbsUp), Owned: owned,
			PublishedAt: zeroIfUnset(m.DateReleased), UpdatedAt: zeroIfUnset(m.DateModified),
			SourceURL: m.Links.SourceURL, IssuesURL: m.Links.IssuesURL, WikiURL: m.Links.WikiURL,
		},
		Downloads: m.DownloadCount,
	}
}

func modrinthProject(pr modrinth.Project) models.PlatformReading {
	var queued time.Time
	if pr.Queued != nil {
		queued = zeroIfUnset(*pr.Queued)
	}
	return models.PlatformReading{
		PlatformProject: models.PlatformProject{
			Platform: models.SourceModrinth, ID: pr.ID, Slug: pr.Slug, Name: pr.Title, Summary: pr.Description,
			IconURL: pr.IconURL, URL: pr.URL(), RawStatus: pr.Status, Status: modrinth.ReviewStatus(pr.Status),
			StatusMessage: string(pr.ModeratorMsg), RequestedStatus: pr.Requested(), QueuedAt: queued,
			Followers: pr.Followers,
			// Everything the user endpoint returns is the user's own project.
			Owned:       true,
			PublishedAt: zeroIfUnset(pr.Published), UpdatedAt: zeroIfUnset(pr.Updated),
			SourceURL: pr.SourceURL, IssuesURL: pr.IssuesURL, WikiURL: pr.WikiURL, DiscordURL: pr.DiscordURL,
		},
		Downloads: pr.Downloads,
	}
}

// fetchFiles reads per-file counts: CurseForge files for the mods the author owns, and every Modrinth version.
// Files of mods the author is only a member of are skipped; Applied Energistics 2 alone has hundreds.
func (s *Service) fetchFiles(ctx context.Context, readings []models.Reading) ([]models.FileReading, []models.PlatformReading, []models.SourceStatus) {
	files, cfErrs := s.curseForgeFiles(ctx, readings)
	statuses := []models.SourceStatus{status(models.SourceCurseForge, cfErrs)}

	var projects []models.PlatformReading
	if s.mr != nil && s.cfg.CanPollModrinth() {
		mrFiles, mrProjects, mrErrs := s.modrinthFiles(ctx)
		files = append(files, mrFiles...)
		projects = mrProjects
		st := status(models.SourceModrinth, mrErrs)
		if s.cfg.ModrinthToken == "" {
			st.Detail = MissingTokenDetail
		}
		statuses = append(statuses, st)
	}
	return files, projects, statuses
}

// fetchIssues reads the repo's issues. It returns a nil status when issues are off.
// A failure never fails the poll; the status carries the error.
func (s *Service) fetchIssues(ctx context.Context) ([]models.Issue, bool, *models.SourceStatus) {
	if s.gh == nil || !s.cfg.CanPollGitHub() {
		return nil, false, nil
	}
	st := &models.SourceStatus{Source: models.SourceGitHub, OK: true}
	if s.cfg.GitHubToken == "" {
		st.Detail = github.UnauthenticatedDetail
	}
	issues, err := s.gh.ListIssues(ctx)
	if err != nil {
		st.OK, st.Error = false, err.Error()
		return nil, false, st
	}
	return issues, true, st
}

// MissingTokenDetail is shown beside Modrinth when no token is set.
const MissingTokenDetail = "Drafts and projects in review are hidden without MODRINTH_TOKEN"

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
	rest := trimProjectName(displayName, project)
	rest = strings.TrimLeft(rest, " \t-_:")
	// A leading "v" is a separator only when a digit follows it.
	if len(rest) > 1 && (rest[0] == 'v' || rest[0] == 'V') && rest[1] >= '0' && rest[1] <= '9' {
		rest = rest[1:]
	}
	rest = strings.TrimSpace(rest)
	// Nothing left, or only a file extension: keep the whole name.
	if rest == "" || strings.HasPrefix(rest, ".") {
		return displayName
	}
	return rest
}

// trimProjectName removes the project name from the front of a display name, ignoring case, spaces and punctuation,
// so "Graves-1.11" and "ae2ee3emcaddon-1.0" lose "Graves" and "AE2 EE3 EMC Add-on".
func trimProjectName(displayName, project string) string {
	alnum := func(r rune) bool { return unicode.IsLetter(r) || unicode.IsDigit(r) }
	want := []rune{}
	for _, r := range strings.ToLower(project) {
		if alnum(r) {
			want = append(want, r)
		}
	}
	if len(want) == 0 {
		return displayName
	}
	i := 0
	for pos, r := range displayName {
		if i == len(want) {
			return displayName[pos:]
		}
		if !alnum(r) {
			continue
		}
		if unicode.ToLower(r) != want[i] {
			return displayName
		}
		i++
	}
	if i == len(want) {
		return ""
	}
	return displayName
}

func (s *Service) modrinthFiles(ctx context.Context) ([]models.FileReading, []models.PlatformReading, []string) {
	projects, err := s.mr.ListProjects(ctx, s.cfg.ModrinthUser)
	if err != nil {
		return nil, nil, []string{err.Error()}
	}
	var out []models.FileReading
	var errs []string
	readings := make([]models.PlatformReading, 0, len(projects))
	for _, pr := range projects {
		readings = append(readings, modrinthProject(pr))
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
	return out, readings, errs
}
