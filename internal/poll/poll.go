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
	"github.com/fireball1725/modwatch/internal/settings"
	"github.com/fireball1725/modwatch/internal/version"
)

// ErrRunning is returned by Start when a poll is already in progress.
var ErrRunning = errors.New("a poll is already running")

// ErrNotConfigured is returned by Start when the CurseForge key or author ID is missing.
var ErrNotConfigured = errors.New("the CurseForge API key and author ID must both be set, as environment variables or in Settings")

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

// GitHub lists the issues of a repository, written owner/name.
type GitHub interface {
	ListIssues(ctx context.Context, repo string) ([]models.Issue, error)
}

// Factory builds the API clients from a configuration, so a change in Settings reaches the next poll.
type Factory interface {
	CurseForge(cfg *config.Config) CurseForge
	// Modrinth returns nil when no Modrinth user is set.
	Modrinth(cfg *config.Config) Modrinth
	GitHub(cfg *config.Config) GitHub
}

// DefaultFactory builds the real clients.
type DefaultFactory struct{}

func (DefaultFactory) CurseForge(cfg *config.Config) CurseForge {
	return curseforge.New(cfg.CurseForgeBaseURL, cfg.CurseForgeKey, cfg.CurseForgeGameID)
}

func (DefaultFactory) Modrinth(cfg *config.Config) Modrinth {
	if !cfg.CanPollModrinth() {
		return nil
	}
	return modrinth.New(cfg.ModrinthBaseURL, cfg.ModrinthToken, cfg.ModrinthUserAgent)
}

func (DefaultFactory) GitHub(cfg *config.Config) GitHub {
	return github.New(cfg.GitHubBaseURL, cfg.GitHubToken, "modwatch/"+version.String())
}

// runner is what one poll uses: the configuration and clients as they stand when the poll starts.
type runner struct {
	cfg *config.Config
	cf  CurseForge
	mr  Modrinth // nil when Modrinth is not configured
	gh  GitHub   // nil when issues are off
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

	// store and factory, when set, make every poll read the current Settings and build its clients afresh.
	store   *settings.Store
	factory Factory

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

// WithSettings makes each poll use the effective configuration (environment plus Settings) and build its clients
// from it with factory.
func (s *Service) WithSettings(store *settings.Store, factory Factory) *Service {
	s.store, s.factory = store, factory
	return s
}

// config is the configuration the next poll uses: the environment's with the values set in Settings over it.
func (s *Service) config(ctx context.Context) (*config.Config, error) {
	if s.store == nil {
		return s.cfg, nil
	}
	cfg, err := s.store.Effective(ctx)
	if err != nil {
		return nil, fmt.Errorf("reading settings: %w", err)
	}
	return cfg, nil
}

// runner resolves what the next poll uses.
func (s *Service) runner(ctx context.Context) (*runner, error) {
	cfg, err := s.config(ctx)
	if err != nil {
		return nil, err
	}
	if s.store == nil {
		return &runner{cfg: cfg, cf: s.cf, mr: s.mr, gh: s.gh}, nil
	}
	return &runner{cfg: cfg, cf: s.factory.CurseForge(cfg), mr: s.factory.Modrinth(cfg), gh: s.factory.GitHub(cfg)}, nil
}

// Running reports whether a poll is in progress.
func (s *Service) Running() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// Start begins a poll in the background and returns at once.
func (s *Service) Start() error {
	cfg, err := s.config(s.ctx)
	if err != nil {
		return err
	}
	if !cfg.CanPoll() {
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
	r, err := s.runner(ctx)
	if err != nil {
		return err
	}
	readings, cfProjects, err := r.fetch(ctx)
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

	files, mrProjects, statuses := r.fetchFiles(ctx, readings)
	p.FinishedAt = s.now()
	for i := range statuses {
		statuses[i].CheckedAt = p.FinishedAt
		if statuses[i].OK {
			statuses[i].LastOKAt = p.FinishedAt
		}
	}
	var perModRepos []string
	if ix, err := s.repo.CatalogIndex(ctx); err == nil {
		perModRepos = ix.Repos()
	}
	issues, configuredRepos, fetchedRepos, ghStatus := r.fetchIssues(ctx, perModRepos)
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
	// A repository that failed keeps its last stored issues; the others are replaced.
	if ghStatus != nil {
		if err := s.repo.SaveIssues(ctx, pollID, configuredRepos, fetchedRepos, issues); err != nil {
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
func (r *runner) fetch(ctx context.Context) ([]models.Reading, []models.PlatformReading, error) {
	member, err := r.cf.ListByAuthor(ctx, r.cfg.CurseForgeAuthorID, false)
	if err != nil {
		return nil, nil, err
	}
	owned, err := r.cf.ListByAuthor(ctx, r.cfg.CurseForgeAuthorID, true)
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
func (r *runner) fetchFiles(ctx context.Context, readings []models.Reading) ([]models.FileReading, []models.PlatformReading, []models.SourceStatus) {
	files, cfErrs := r.curseForgeFiles(ctx, readings)
	statuses := []models.SourceStatus{status(models.SourceCurseForge, cfErrs)}

	var projects []models.PlatformReading
	if r.mr != nil && r.cfg.CanPollModrinth() {
		mrFiles, mrProjects, mrErrs := r.modrinthFiles(ctx)
		files = append(files, mrFiles...)
		projects = mrProjects
		st := status(models.SourceModrinth, mrErrs)
		if r.cfg.ModrinthToken == "" {
			st.Detail = MissingTokenDetail
		}
		statuses = append(statuses, st)
	}
	return files, projects, statuses
}

// issueRepos lists the repositories to read: the shared one, then each mod's own, without repeats.
func (r *runner) issueRepos(perMod []string) []string {
	var out []string
	seen := map[string]bool{}
	add := func(repo string) {
		if k := strings.ToLower(repo); repo != "" && !seen[k] {
			seen[k] = true
			out = append(out, repo)
		}
	}
	if r.cfg.CanPollGitHub() {
		add(r.cfg.GitHubIssuesRepo)
	}
	for _, repo := range perMod {
		add(repo)
	}
	return out
}

// fetchIssues reads the issues of every configured repository. It returns a nil status when issues are off.
// configured is every repository that should have issues and fetched the ones read without error. A failure never
// fails the poll; the status carries the errors, one per repository that failed.
func (r *runner) fetchIssues(ctx context.Context, perMod []string) (issues []models.Issue, configured, fetched []string, st *models.SourceStatus) {
	configured = r.issueRepos(perMod)
	if r.gh == nil || len(configured) == 0 {
		return nil, nil, nil, nil
	}
	st = &models.SourceStatus{Source: models.SourceGitHub, OK: true}
	if r.cfg.GitHubToken == "" {
		st.Detail = github.UnauthenticatedDetail
	}
	var errs []string
	for _, repo := range configured {
		got, err := r.gh.ListIssues(ctx, repo)
		if err != nil {
			errs = append(errs, repo+": "+err.Error())
			continue
		}
		for i := range got {
			got[i].Repo = repo
		}
		issues = append(issues, got...)
		fetched = append(fetched, repo)
	}
	if len(errs) > 0 {
		st.OK, st.Error = false, strings.Join(errs, "; ")
	}
	return issues, configured, fetched, st
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

func (r *runner) curseForgeFiles(ctx context.Context, readings []models.Reading) ([]models.FileReading, []string) {
	var out []models.FileReading
	var errs []string
	for _, rd := range readings {
		if !rd.Owned {
			continue
		}
		files, err := r.cf.ListFiles(ctx, rd.ID)
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

func (r *runner) modrinthFiles(ctx context.Context) ([]models.FileReading, []models.PlatformReading, []string) {
	projects, err := r.mr.ListProjects(ctx, r.cfg.ModrinthUser)
	if err != nil {
		return nil, nil, []string{err.Error()}
	}
	var out []models.FileReading
	var errs []string
	readings := make([]models.PlatformReading, 0, len(projects))
	for _, pr := range projects {
		readings = append(readings, modrinthProject(pr))
		versions, err := r.mr.ListVersions(ctx, pr.ID)
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
