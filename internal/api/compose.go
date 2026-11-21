// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package api

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/fireball1725/modwatch/internal/mcver"
	"github.com/fireball1725/modwatch/internal/models"
	"github.com/fireball1725/modwatch/internal/release"
	"github.com/fireball1725/modwatch/internal/repository"
)

const (
	platCF = repository.PlatformCurseForge
	platMR = repository.PlatformModrinth
)

// dataset is everything the composition reads, loaded once per request so the pure functions below need no database.
type dataset struct {
	now     time.Time
	ghRepo  string
	stats   []models.PlatformStat
	files   []models.FileStat
	entries []models.CatalogEntry
	issues  []models.Issue // every state
	// dismissed holds the needs-attention items the author dismissed, by kind and mod.
	dismissed map[dismissKey]bool
	seen      map[models.PlatformKey]time.Time
	sources   []models.SourceStatus
	ix        *repository.CatalogIndex
	problems  []string
}

// group is one mod: a catalog entry with the projects it holds, or a lone project no entry holds.
type group struct {
	slug  string
	name  string
	entry *models.CatalogEntry
	cf    *models.PlatformStat
	mr    *models.PlatformStat
	owned bool
}

// dismissKey names one dismissible item: a kind of attention for one mod.
type dismissKey struct{ kind, modSlug string }

func (g *group) hidden() bool { return g.entry != nil && g.entry.Hidden }

// legacy reports whether the author marked the mod as one that deliberately stays on old Minecraft versions.
func (g *group) legacy() bool { return g.entry != nil && g.entry.Legacy }

func (g *group) projects() []*models.PlatformStat {
	var out []*models.PlatformStat
	if g.cf != nil {
		out = append(out, g.cf)
	}
	if g.mr != nil {
		out = append(out, g.mr)
	}
	return out
}

// view is a dataset joined up: groups, each group's files and issues, and the newest Minecraft version.
type view struct {
	ds     *dataset
	groups []*group // the mods the lists show, biggest combined downloads first
	all    []*group // including hidden and legacy ones, so a mod page still opens for them
	// showLegacy says whether mods marked legacy are in groups and the roll-ups. They stay out unless asked for,
	// because a 1.7.10 mod with a million downloads flattens every chart it shares with the current mods.
	showLegacy bool
	bySlug     map[string]*group
	byKey      map[models.PlatformKey]*group
	filesOf    map[string][]models.FileStat
	issuesOf   map[string][]models.Issue
	latestMC   string
	patterns   map[string]*regexp.Regexp
}

func keyOf(p *models.PlatformStat) models.PlatformKey {
	return models.PlatformKey{Platform: p.Platform, ID: p.ID}
}

func fileKey(f models.FileStat) models.PlatformKey {
	return models.PlatformKey{Platform: f.Source, ID: f.ProjectID}
}

func newView(ds *dataset, showLegacy bool) *view {
	v := &view{
		ds:         ds,
		showLegacy: showLegacy,
		bySlug:     map[string]*group{},
		byKey:      map[models.PlatformKey]*group{},
		filesOf:    map[string][]models.FileStat{},
		issuesOf:   map[string][]models.Issue{},
	}
	if ds.ix == nil {
		ds.ix = repository.NewCatalogIndex(ds.entries)
	}
	stats := map[models.PlatformKey]*models.PlatformStat{}
	for i := range ds.stats {
		stats[keyOf(&ds.stats[i])] = &ds.stats[i]
	}
	used := map[models.PlatformKey]bool{}
	add := func(g *group) {
		v.all = append(v.all, g)
		v.bySlug[g.slug] = g
		for _, p := range g.projects() {
			v.byKey[keyOf(p)] = g
			used[keyOf(p)] = true
			g.owned = g.owned || p.Owned
		}
	}
	for i := range ds.entries {
		e := &ds.entries[i]
		g := &group{slug: e.Slug, name: e.Name, entry: e}
		for _, k := range ds.ix.Keys(e.Slug) {
			p := stats[k]
			if p == nil {
				continue // the entry points at a project that has left the latest refresh
			}
			if k.Platform == platCF {
				g.cf = p
			} else {
				g.mr = p
			}
		}
		add(g)
	}
	// A project no entry holds is still a mod to show, such as one the author is only a member of.
	var loose []*models.PlatformStat
	for i := range ds.stats {
		if !used[keyOf(&ds.stats[i])] {
			loose = append(loose, &ds.stats[i])
		}
	}
	sort.Slice(loose, func(i, j int) bool {
		if loose[i].Platform != loose[j].Platform {
			return loose[i].Platform < loose[j].Platform
		}
		return loose[i].ID < loose[j].ID
	})
	for _, p := range loose {
		slug := p.Slug
		if v.bySlug[slug] != nil {
			slug = p.Slug + "-" + p.Platform
		}
		for n := 2; v.bySlug[slug] != nil; n++ {
			slug = p.Slug + "-" + p.Platform + "-" + strconv.Itoa(n)
		}
		g := &group{slug: slug, name: p.Name}
		if p.Platform == platCF {
			g.cf = p
		} else {
			g.mr = p
		}
		add(g)
	}

	for _, f := range ds.files {
		if g := v.byKey[fileKey(f)]; g != nil {
			v.filesOf[g.slug] = append(v.filesOf[g.slug], f)
		}
	}
	for _, is := range ds.issues {
		if slug, _, ok := modOf(ds.ix, is); ok {
			v.issuesOf[slug] = append(v.issuesOf[slug], is)
		}
	}

	for _, g := range v.all {
		if v.listed(g) {
			v.groups = append(v.groups, g)
		}
	}
	sort.SliceStable(v.groups, func(i, j int) bool {
		a, b := totalDownloads(v.groups[i]), totalDownloads(v.groups[j])
		if a != b {
			return a > b
		}
		return strings.ToLower(v.groups[i].name) < strings.ToLower(v.groups[j].name)
	})

	var versions []string
	for _, g := range v.groups {
		if g.owned {
			for _, f := range v.filesOf[g.slug] {
				versions = append(versions, f.GameVersions...)
			}
		}
	}
	v.latestMC = mcver.Latest(versions)
	return v
}

func totalDownloads(g *group) int64 {
	var n int64
	for _, p := range g.projects() {
		n += p.Downloads
	}
	return n
}

// listed reports whether a mod shows in the lists and roll-ups.
func (v *view) listed(g *group) bool {
	return !g.hidden() && (v.showLegacy || !g.legacy())
}

// inScope reports whether a file counts toward version, loader and release views: its project is a visible owned
// mod, or unknown to the platform tables (files stored without a project row).
func (v *view) inScope(f models.FileStat) bool {
	g := v.byKey[fileKey(f)]
	if g == nil {
		return true
	}
	return g.owned && v.listed(g)
}

func (v *view) scopedFiles() []models.FileStat {
	var out []models.FileStat
	for _, f := range v.ds.files {
		if v.inScope(f) {
			out = append(out, f)
		}
	}
	return out
}

// ---- small conversions ----------------------------------------------------------------------

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func sumDelta(a, b *int64) *int64 {
	if a == nil && b == nil {
		return nil
	}
	var n int64
	if a != nil {
		n += *a
	}
	if b != nil {
		n += *b
	}
	return &n
}

func downloadsOf(g *group) modDownloads {
	var d modDownloads
	var d1, d7 *int64
	if g.cf != nil {
		d.CurseForge = g.cf.Downloads
		d1, d7 = g.cf.Delta24h, g.cf.Delta7d
	}
	if g.mr != nil {
		d.Modrinth = g.mr.Downloads
		d1, d7 = sumDelta(d1, g.mr.Delta24h), sumDelta(d7, g.mr.Delta7d)
	}
	d.Total = d.CurseForge + d.Modrinth
	d.Delta24h, d.Delta7d = d1, d7
	return d
}

func releaseTypeOf(s string) string {
	switch strings.ToLower(s) {
	case "release", "beta", "alpha":
		return strings.ToLower(s)
	}
	return "unknown"
}

func platformName(p string) string {
	switch p {
	case platCF:
		return "CurseForge"
	case platMR:
		return "Modrinth"
	case models.SourceGitHub:
		return "GitHub"
	}
	return p
}

func nonNilStrings(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func unionVersions(files []models.FileStat, pick func(models.File) []string, sortFn func([]string)) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, f := range files {
		for _, x := range pick(f.File) {
			if !seen[x] {
				seen[x] = true
				out = append(out, x)
			}
		}
	}
	sortFn(out)
	return out
}

// fileURL builds a link to one file from its project's page; the stored file has no URL of its own.
func (v *view) fileURL(f models.FileStat) *string {
	g := v.byKey[fileKey(f)]
	if g == nil {
		return nil
	}
	p := g.cf
	seg := "/files/"
	if f.Source == platMR {
		p, seg = g.mr, "/version/"
	}
	if p == nil || p.URL == "" {
		return nil
	}
	u := strings.TrimRight(p.URL, "/") + seg + f.ID
	return &u
}

func (v *view) toFileItem(g *group, f models.FileStat) fileItem {
	it := fileItem{
		Platform: f.Source, ID: f.ID, ModName: f.ProjectName, Name: f.Name, Version: f.Version,
		ReleaseType:       releaseTypeOf(f.ReleaseType),
		MinecraftVersions: sortedCopy(f.GameVersions), Loaders: sortedStrings(f.Loaders),
		PublishedAt: rfc3339Ptr(f.PublishedAt), Downloads: f.Downloads, Delta24h: f.Delta24h, Delta7d: f.Delta7d,
		URL: v.fileURL(f),
	}
	if g != nil {
		slug := g.slug
		it.ModSlug, it.ModName = &slug, g.name
	}
	info := v.releaseInfo(g, f.File)
	it.Release, it.Prerelease = info.Name(), info.Pre != ""
	return it
}

// releaseInfo reads a file's version text with the mod's own pattern when it has one, else the default reading.
func (v *view) releaseInfo(g *group, f models.File) release.Info {
	var re *regexp.Regexp
	if g != nil && g.entry != nil && g.entry.VersionRegex != nil {
		re = v.versionPattern(*g.entry.VersionRegex)
	}
	text := f.Version
	if text == "" {
		text = f.Name
	}
	return release.Parse(text, f.GameVersions, re)
}

// versionPattern compiles a mod's own version pattern once per request. A pattern that no longer compiles reads
// as no pattern, so the default reading still applies.
func (v *view) versionPattern(pattern string) *regexp.Regexp {
	if re, ok := v.patterns[pattern]; ok {
		return re
	}
	if v.patterns == nil {
		v.patterns = map[string]*regexp.Regexp{}
	}
	re, err := release.Compile(pattern)
	if err != nil {
		re = nil
	}
	v.patterns[pattern] = re
	return re
}

func sortedCopy(in []string) []string {
	out := append([]string{}, in...)
	mcver.Sort(out)
	return out
}

func sortedStrings(in []string) []string {
	out := append([]string{}, in...)
	sort.Strings(out)
	return out
}

func newestFile(files []models.FileStat) (models.FileStat, bool) {
	var best models.FileStat
	found := false
	for _, f := range files {
		if f.PublishedAt.IsZero() {
			continue
		}
		if !found || f.PublishedAt.After(best.PublishedAt) {
			best, found = f, true
		}
	}
	return best, found
}

// latestRelease finds the release that came out most recently. Files are grouped by the release their version names,
// so the same release on both platforms and for each Minecraft version is one release. The newest is the one whose
// first file is newest; a later file added to an old release (a backport) doesn't make it the latest.
func (v *view) latestRelease(g *group, files []models.FileStat) *latestRelease {
	type grp struct {
		first, last models.FileStat
		files       []models.FileStat
	}
	groups := map[string]*grp{}
	for _, f := range files {
		if f.PublishedAt.IsZero() {
			continue
		}
		name := v.releaseInfo(g, f.File).Name()
		x := groups[name]
		if x == nil {
			x = &grp{first: f, last: f}
			groups[name] = x
		}
		x.files = append(x.files, f)
		if f.PublishedAt.Before(x.first.PublishedAt) {
			x.first = f
		}
		if f.PublishedAt.After(x.last.PublishedAt) {
			x.last = f
		}
	}
	bestName := ""
	for name, x := range groups {
		b := groups[bestName]
		if b == nil || x.first.PublishedAt.After(b.first.PublishedAt) || (x.first.PublishedAt.Equal(b.first.PublishedAt) && name > bestName) {
			bestName = name
		}
	}
	x := groups[bestName]
	if x == nil {
		return nil
	}
	platforms := []string{}
	for _, f := range x.files {
		if !containsStr(platforms, f.Source) {
			platforms = append(platforms, f.Source)
		}
	}
	sort.Strings(platforms) // curseforge sorts before modrinth
	return &latestRelease{
		Platforms: platforms, Version: bestName, ReleaseType: releaseTypeOf(x.last.ReleaseType),
		PublishedAt: rfc3339(x.first.PublishedAt), MinecraftVersions: unionVersions(x.files, gameVersionsOf, mcver.Sort),
	}
}

// ---- mod summaries --------------------------------------------------------------------------

func (v *view) platformInfo(p *models.PlatformStat) *platformInfo {
	if p == nil {
		return nil
	}
	n := 0
	for _, f := range v.ds.files {
		if f.Source == p.Platform && f.ProjectID == p.ID {
			n++
		}
	}
	followers := p.Followers
	return &platformInfo{
		Platform: p.Platform, ID: p.ID, Slug: p.Slug, URL: p.URL, Status: string(p.Status), RawStatus: p.RawStatus,
		StatusMessage: strPtr(p.StatusMessage), RequestedStatus: strPtr(p.RequestedStatus),
		QueuedAt: rfc3339Ptr(p.QueuedAt), Downloads: p.Downloads, Delta24h: p.Delta24h, Delta7d: p.Delta7d,
		Followers: &followers, PublishedAt: rfc3339Ptr(p.PublishedAt), UpdatedAt: rfc3339Ptr(p.UpdatedAt), Files: n,
	}
}

// repoFor is the issues repository a mod's issues live in: its own when it has one, else the shared one.
func (v *view) repoFor(g *group) string {
	if g.entry != nil && g.entry.GitHubRepo != nil && *g.entry.GitHubRepo != "" {
		return *g.entry.GitHubRepo
	}
	return v.ds.ghRepo
}

func (v *view) githubInfo(g *group) *githubInfo {
	issues := v.issuesOf[g.slug]
	label := g.slug
	if g.entry != nil && g.entry.GitHubLabel != nil && *g.entry.GitHubLabel != "" {
		label = *g.entry.GitHubLabel
	}
	if v.repoFor(g) == "" && len(issues) == 0 && (g.entry == nil || g.entry.GitHubLabel == nil) {
		return nil
	}
	if !g.owned && len(issues) == 0 {
		return nil
	}
	gi := &githubInfo{Label: label}
	var oldest time.Time
	for _, is := range issues {
		if is.State != "open" {
			continue
		}
		gi.Open++
		switch is.Kind {
		case models.KindBug:
			gi.OpenBugs++
		case models.KindCrash:
			gi.OpenCrashes++
		default:
			continue
		}
		if oldest.IsZero() || is.CreatedAt.Before(oldest) {
			oldest = is.CreatedAt
		}
	}
	gi.OldestOpenBugAt = rfc3339Ptr(oldest)
	return gi
}

func (v *view) summary(g *group) modSummary {
	files := v.filesOf[g.slug]
	ms := modSummary{
		Slug: g.slug, Name: g.name, Owned: g.owned, Legacy: g.legacy(),
		CurseForge: v.platformInfo(g.cf), Modrinth: v.platformInfo(g.mr), Github: v.githubInfo(g),
		Downloads:         downloadsOf(g),
		MinecraftVersions: unionVersions(files, gameVersionsOf, mcver.Sort),
		Loaders:           unionVersions(files, loadersOf, sort.Strings),
		Attention:         []attentionItem{},
	}
	for _, p := range g.projects() {
		if ms.IconURL == "" {
			ms.IconURL = p.IconURL
		}
		if ms.Summary == "" {
			ms.Summary = p.Summary
		}
	}
	ms.LatestRelease = v.latestRelease(g, files)
	ms.Health = healthOK
	if g.owned {
		ms.Attention, _ = v.splitDismissed(v.attentionFor(g))
		ms.Health = healthOf(ms.Attention)
	}
	return ms
}

// summaries lists every visible mod, biggest first.
func (v *view) summaries() []modSummary {
	out := make([]modSummary, 0, len(v.groups))
	for _, g := range v.groups {
		out = append(out, v.summary(g))
	}
	return out
}

func (v *view) detail(g *group) modDetail {
	files := append([]models.FileStat{}, v.filesOf[g.slug]...)
	sort.SliceStable(files, func(i, j int) bool {
		if files[i].Downloads != files[j].Downloads {
			return files[i].Downloads > files[j].Downloads
		}
		return files[i].Name < files[j].Name
	})
	d := modDetail{
		modSummary: v.summary(g), Files: make([]fileItem, 0, len(files)),
		History: []downloadPoint{}, Issues: []issueItem{},
		GameVersions: versionTotals(files, gameVersionsOf, true),
	}
	for _, f := range files {
		d.Files = append(d.Files, v.toFileItem(g, f))
	}
	for _, is := range v.issuesOf[g.slug] {
		d.Issues = append(d.Issues, toIssueItem(v.ds.ix, is))
	}
	d.Links = v.links(g)
	return d
}

func (v *view) links(g *group) modLinks {
	var l modLinks
	if g.cf != nil {
		l.CurseForge = strPtr(g.cf.URL)
	}
	if g.mr != nil {
		l.Modrinth = strPtr(g.mr.URL)
	}
	repo := v.repoFor(g)
	if repo != "" {
		l.Github = strPtr("https://github.com/" + repo)
	}
	first := func(pick func(*models.PlatformStat) string) *string {
		for _, p := range g.projects() {
			if s := pick(p); s != "" {
				return &s
			}
		}
		return nil
	}
	l.Source = first(func(p *models.PlatformStat) string { return p.SourceURL })
	l.Issues = first(func(p *models.PlatformStat) string { return p.IssuesURL })
	if l.Issues == nil && repo != "" {
		l.Issues = strPtr("https://github.com/" + repo + "/issues")
	}
	l.Wiki = first(func(p *models.PlatformStat) string { return p.WikiURL })
	l.Discord = first(func(p *models.PlatformStat) string { return p.DiscordURL })
	return l
}

// ---- totals by version and loader -------------------------------------------------------------

// versionTotals adds up downloads under each name a file carries, split by platform.
// Minecraft versions sort newest first by version number; loaders sort biggest first.
func versionTotals(files []models.FileStat, pick func(models.File) []string, mc bool) []versionTotal {
	by := map[string]*versionTotal{}
	for _, f := range files {
		for _, name := range pick(f.File) {
			t := by[name]
			if t == nil {
				t = &versionTotal{Name: name}
				by[name] = t
			}
			t.Downloads += f.Downloads
			t.Files++
			if f.Source == platCF {
				t.CurseForge += f.Downloads
			} else {
				t.Modrinth += f.Downloads
			}
		}
	}
	out := make([]versionTotal, 0, len(by))
	for _, t := range by {
		out = append(out, *t)
	}
	sort.Slice(out, func(i, j int) bool {
		if mc {
			return mcver.Compare(out[i].Name, out[j].Name) > 0
		}
		if out[i].Downloads != out[j].Downloads {
			return out[i].Downloads > out[j].Downloads
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// noLoaderTotal adds up the files with no loader tag, split by platform. It is exact: a file counts once.
func noLoaderTotal(files []models.FileStat) versionTotal {
	t := versionTotal{Name: "none"}
	for _, f := range files {
		if len(f.Loaders) > 0 {
			continue
		}
		t.Downloads += f.Downloads
		t.Files++
		if f.Source == platCF {
			t.CurseForge += f.Downloads
		} else {
			t.Modrinth += f.Downloads
		}
	}
	return t
}

// versions builds the Versions payload. fileSnaps is keyed by source and file id, as repo.FileHistory returns it.
func (v *view) versions(fileSnaps map[models.PlatformKey][]models.Snapshot, days []time.Time) versionsResponse {
	files := v.scopedFiles()
	out := versionsResponse{
		GameVersions: versionTotals(files, gameVersionsOf, true),
		Loaders:      versionTotals(files, loadersOf, false),
		NoLoader:     noLoaderTotal(files),
		Matrix:       versionMatrix{Versions: []string{}, Rows: []matrixRow{}},
		History:      map[string][]versionPoint{},
	}
	if v.latestMC != "" {
		l := v.latestMC
		out.LatestMinecraft = &l
	}
	for _, t := range out.GameVersions {
		out.Matrix.Versions = append(out.Matrix.Versions, t.Name)
	}
	for _, g := range v.groups {
		if !g.owned {
			continue
		}
		row := matrixRow{Slug: g.slug, Name: g.name, IconURL: iconOf(g), Cells: map[string]matrixCell{}}
		for _, f := range v.filesOf[g.slug] {
			for _, mv := range f.GameVersions {
				c := row.Cells[mv]
				c.Downloads += f.Downloads
				if c.Platforms == nil {
					c.Platforms = []string{}
				}
				if !containsStr(c.Platforms, f.Source) {
					c.Platforms = append(c.Platforms, f.Source)
					sort.Strings(c.Platforms) // curseforge sorts before modrinth
				}
				row.Cells[mv] = c
			}
		}
		out.Matrix.Rows = append(out.Matrix.Rows, row)
	}

	perVersion := map[string][][]models.Snapshot{}
	for _, f := range files {
		snaps := fileSnaps[models.PlatformKey{Platform: f.Source, ID: f.ID}]
		for _, mv := range f.GameVersions {
			perVersion[mv] = append(perVersion[mv], snaps)
		}
	}
	for mv, series := range perVersion {
		sums, first := sumSeries(series, days)
		if first >= len(days) {
			continue
		}
		pts := make([]versionPoint, 0, len(days)-first)
		for i := first; i < len(days); i++ {
			pts = append(pts, versionPoint{At: rfc3339(days[i]), Downloads: sums[i]})
		}
		out.History[mv] = pts
	}
	return out
}

func iconOf(g *group) string {
	for _, p := range g.projects() {
		if p.IconURL != "" {
			return p.IconURL
		}
	}
	return ""
}

func containsStr(s []string, x string) bool {
	for _, y := range s {
		if y == x {
			return true
		}
	}
	return false
}

// ---- releases ---------------------------------------------------------------------------------

func (v *view) releases(limit int) []releaseItem {
	files := v.scopedFiles()
	sort.SliceStable(files, func(i, j int) bool {
		if !files[i].PublishedAt.Equal(files[j].PublishedAt) {
			return files[i].PublishedAt.After(files[j].PublishedAt)
		}
		return files[i].Downloads > files[j].Downloads
	})
	out := []releaseItem{}
	for _, f := range files {
		if f.PublishedAt.IsZero() {
			continue
		}
		if len(out) >= limit {
			break
		}
		it := v.toFileItem(v.byKey[fileKey(f)], f)
		out = append(out, releaseItem{
			Platform: it.Platform, ModSlug: it.ModSlug, ModName: it.ModName, Version: it.Release, Name: it.Name,
			ReleaseType: it.ReleaseType, MinecraftVersions: it.MinecraftVersions, Loaders: it.Loaders,
			PublishedAt: rfc3339(f.PublishedAt), Downloads: it.Downloads, URL: it.URL,
		})
	}
	return out
}

// ---- download history -------------------------------------------------------------------------

// dayRange returns the UTC midnights of the last n days, oldest first, ending with today.
func dayRange(now time.Time, n int) []time.Time {
	t := now.UTC()
	today := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	out := make([]time.Time, n)
	for i := range out {
		out[i] = today.AddDate(0, 0, i-(n-1))
	}
	return out
}

// carry returns a series' cumulative value on each day, using the last snapshot taken on or before that day.
// first is the index of the first day with a snapshot, or len(days) when there is none.
func carry(snaps []models.Snapshot, days []time.Time) (vals []int64, first int) {
	vals = make([]int64, len(days))
	first = len(days)
	i := 0
	var cur int64
	have := false
	for d, day := range days {
		end := day.AddDate(0, 0, 1)
		for i < len(snaps) && snaps[i].At.Before(end) {
			cur, have = snaps[i].Downloads, true
			i++
		}
		if have {
			vals[d] = cur
			if first == len(days) {
				first = d
			}
		}
	}
	return vals, first
}

// sumSeries adds several series day by day. A series with no value yet on a day counts zero.
func sumSeries(series [][]models.Snapshot, days []time.Time) (sums []int64, first int) {
	sums = make([]int64, len(days))
	first = len(days)
	for _, s := range series {
		vals, f := carry(s, days)
		if f < first {
			first = f
		}
		for i, x := range vals {
			sums[i] += x
		}
	}
	return sums, first
}

type seriesSet struct {
	cf, mr []models.Snapshot
}

func (v *view) groupSeries(g *group, snaps map[models.PlatformKey][]models.Snapshot) seriesSet {
	var s seriesSet
	if g.cf != nil {
		s.cf = snaps[keyOf(g.cf)]
	}
	if g.mr != nil {
		s.mr = snaps[keyOf(g.mr)]
	}
	return s
}

// points builds one cumulative point per day for a set of mods, starting at the first day any of them has data.
func points(sets []seriesSet, days []time.Time) []downloadPoint {
	var cf, mr [][]models.Snapshot
	for _, s := range sets {
		cf, mr = append(cf, s.cf), append(mr, s.mr)
	}
	cfSum, cfFirst := sumSeries(cf, days)
	mrSum, mrFirst := sumSeries(mr, days)
	first := min(cfFirst, mrFirst)
	out := []downloadPoint{}
	for i := first; i < len(days); i++ {
		out = append(out, downloadPoint{At: rfc3339(days[i]), CurseForge: cfSum[i], Modrinth: mrSum[i]})
	}
	return out
}

func (v *view) history(snaps map[models.PlatformKey][]models.Snapshot, days []time.Time) downloadsHistory {
	out := downloadsHistory{Days: len(days), Total: []downloadPoint{}, PerMod: map[string][]downloadPoint{}}
	var owned []seriesSet
	for _, g := range v.groups {
		s := v.groupSeries(g, snaps)
		if pts := points([]seriesSet{s}, days); len(pts) > 0 {
			out.PerMod[g.slug] = pts
		}
		if g.owned {
			owned = append(owned, s)
		}
	}
	out.Total = points(owned, days)
	return out
}
