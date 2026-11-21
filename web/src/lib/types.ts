// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// The API contract. The Go handlers must return exactly these shapes and the UI is built against them.
// Times are RFC 3339 UTC strings. A count that can't be known yet is null, never 0. Lists are never null.

export type Platform = 'curseforge' | 'modrinth'

/** One vocabulary for both platforms' review states. The raw words stay in `rawStatus`. */
export type ReviewStatus =
  | 'approved' //          CF Approved; MR approved
  | 'in_review' //         CF New, UnderSoftReview, UnderReview, ChangesMade; MR processing
  | 'changes_required' //  CF ChangesRequired
  | 'rejected' //          CF Rejected; MR rejected
  | 'draft' //             MR draft
  | 'unlisted' //          MR unlisted, scheduled
  | 'archived' //          MR archived, withheld
  | 'inactive' //          CF Inactive, Abandoned, Deleted
  | 'unknown'

export type Severity = 'problem' | 'warning' | 'info'

/** How a mod is doing overall: problem beats attention beats ok. */
export type Health = 'ok' | 'attention' | 'problem'

export interface PlatformInfo {
  platform: Platform
  id: string
  slug: string
  url: string
  status: ReviewStatus
  rawStatus: string
  /** Moderator feedback, when the platform gave any. */
  statusMessage: string | null
  /** Modrinth only: what the author asked for when the status is not yet that. */
  requestedStatus: string | null
  /** Modrinth only: when the project entered the review queue. */
  queuedAt: string | null
  downloads: number
  delta24h: number | null
  delta7d: number | null
  /** Modrinth followers or CurseForge thumbs up. */
  followers: number | null
  publishedAt: string | null
  updatedAt: string | null
  /** Files (CurseForge) or versions (Modrinth) seen for this project. */
  files: number
}

export interface GithubInfo {
  /** The `mod: <label>` suffix used in the issues repo. */
  label: string
  open: number
  openBugs: number
  openCrashes: number
  /** When the oldest open bug or crash was filed, if any. */
  oldestOpenBugAt: string | null
}

export interface ModDownloads {
  total: number
  curseforge: number
  modrinth: number
  delta24h: number | null
  delta7d: number | null
}

export interface LatestRelease {
  platform: Platform
  version: string
  releaseType: 'release' | 'beta' | 'alpha' | 'unknown'
  publishedAt: string
  minecraftVersions: string[]
}

export interface ModSummary {
  /** The registry slug, stable across platforms. */
  slug: string
  name: string
  iconUrl: string
  summary: string
  /** False for mods the author is only a member of. Hidden from the dashboards unless asked for. */
  owned: boolean
  /** Set in Settings for a mod that deliberately stays on old Minecraft versions: it is left out of
   *  "ready for the newest version" checks and never raises no_latest_minecraft. */
  legacy: boolean
  curseforge: PlatformInfo | null
  modrinth: PlatformInfo | null
  github: GithubInfo | null
  downloads: ModDownloads
  latestRelease: LatestRelease | null
  /** Minecraft versions any file targets, newest first. */
  minecraftVersions: string[]
  loaders: string[]
  health: Health
  /** Why health isn't ok. Same items as the overview's attention list for this mod. */
  attention: AttentionItem[]
}

export type AttentionKind =
  | 'crash_open' //          open crash report
  | 'bug_open' //            open bug
  | 'review_stuck' //        in review longer than the platform usually takes
  | 'review_pending' //      in review
  | 'not_approved' //        draft, rejected, changes required, unlisted
  | 'missing_platform' //    published on one platform only
  | 'no_latest_minecraft' // no file for the newest Minecraft version
  | 'stale_release' //       no release in a long time
  | 'source_down' //         a data source failed
  | 'unlinked' //            on a platform but not in the registry

export interface AttentionItem {
  severity: Severity
  kind: AttentionKind
  modSlug: string | null
  title: string
  detail: string
  url: string | null
}

export interface SourceStatus {
  /** curseforge, modrinth or github. */
  source: string
  ok: boolean
  error?: string
  /** Plain-words limits, such as "Modrinth drafts and projects in review are hidden without a token". */
  detail?: string
  checkedAt: string
  lastOkAt: string | null
}

export interface Poll {
  id: number
  startedAt: string
  finishedAt: string
  state: 'ok' | 'error'
  error?: string
  mods: number
}

// ---- GET /api/v1/overview ----------------------------------------------------------------

export interface OverviewTotals {
  mods: number
  downloads: ModDownloads
  openIssues: number
  openBugs: number
  openCrashes: number
  /** Mods whose health is not ok. */
  needAttention: number
  /** Projects not yet approved on either platform. */
  inReview: number
  /** Owned mods marked legacy. The list endpoints leave them out unless asked with ?legacy=1, so this says how many are out. */
  legacyMods: number
}

export interface Overview {
  version: string
  schedule: string
  polling: boolean
  totals: OverviewTotals
  attention: AttentionItem[]
  /** Owned mods, biggest first, same shape as /mods. */
  mods: ModSummary[]
  recentReleases: ReleaseItem[]
  sources: SourceStatus[]
  lastPoll: Poll | null
  lastOkPoll: Poll | null
  /** Setup problems, such as a missing key. */
  problems: string[]
}

// ---- GET /api/v1/mods  (ModSummary[], owned and member, biggest first) ------------------------
// ---- GET /api/v1/mods/{slug} -------------------------------------------------------------------

export interface FileItem {
  platform: Platform
  id: string
  modSlug: string | null
  modName: string
  name: string
  version: string
  releaseType: 'release' | 'beta' | 'alpha' | 'unknown'
  minecraftVersions: string[]
  loaders: string[]
  publishedAt: string | null
  downloads: number
  delta24h: number | null
  delta7d: number | null
  url: string | null
}

export interface ModDetail extends ModSummary {
  /** Both platforms' files together, biggest first. */
  files: FileItem[]
  history: DownloadPoint[]
  gameVersions: VersionTotal[]
  issues: IssueItem[]
  links: {
    curseforge: string | null
    modrinth: string | null
    github: string | null
    source: string | null
    issues: string | null
    wiki: string | null
    discord: string | null
  }
}

// ---- GET /api/v1/downloads/history?days=90 -----------------------------------------------------

/** Cumulative downloads at the end of one UTC day. */
export interface DownloadPoint {
  at: string
  curseforge: number
  modrinth: number
}

export interface DownloadsHistory {
  days: number
  /** Owned mods summed. */
  total: DownloadPoint[]
  perMod: Record<string, DownloadPoint[]>
}

// ---- GET /api/v1/versions ----------------------------------------------------------------------

export interface VersionTotal {
  name: string
  downloads: number
  curseforge: number
  modrinth: number
  files: number
}

export interface MatrixRow {
  slug: string
  name: string
  iconUrl: string
  /** Downloads per Minecraft version, only for versions the mod has a file for. */
  cells: Record<string, { downloads: number; platforms: Platform[] }>
}

export interface Versions {
  /** The newest Minecraft version any owned mod targets. */
  latestMinecraft: string | null
  gameVersions: VersionTotal[]
  loaders: VersionTotal[]
  /** Files with no loader tag at all (from before loaders were tagged), counted exactly, once per file. */
  noLoader: VersionTotal
  matrix: { versions: string[]; rows: MatrixRow[] }
  /** Cumulative downloads per day per Minecraft version, for the stacked chart. */
  history: Record<string, { at: string; downloads: number }[]>
}

// ---- GET /api/v1/releases?limit=50 -------------------------------------------------------------

export interface ReleaseItem {
  platform: Platform
  modSlug: string | null
  modName: string
  version: string
  name: string
  releaseType: 'release' | 'beta' | 'alpha' | 'unknown'
  minecraftVersions: string[]
  loaders: string[]
  publishedAt: string
  downloads: number
  url: string | null
}

// ---- GET /api/v1/issues?state=open|closed|all  (default open) ----------------------------------

export type IssueKind = 'bug' | 'crash' | 'enhancement' | 'compatibility' | 'question' | 'other'

export interface IssueItem {
  number: number
  title: string
  state: 'open' | 'closed'
  url: string
  /** Registry slug from the issue's `mod: <label>`, or null when it has none or the label isn't linked. */
  modSlug: string | null
  modName: string | null
  /** The raw `mod: <label>` suffix, kept so an unlinked label can be fixed in Settings. */
  modLabel: string | null
  kind: IssueKind
  labels: string[]
  author: string
  comments: number
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export interface IssuesSummary {
  open: number
  closed: number
  openBugs: number
  openCrashes: number
  oldestOpenAt: string | null
  byMod: { slug: string; name: string; open: number; bugs: number; crashes: number; oldestOpenAt: string | null }[]
  byKind: { kind: IssueKind; open: number }[]
}

export interface Issues {
  repo: string
  summary: IssuesSummary
  issues: IssueItem[]
}

// ---- Registry: GET /api/v1/catalog, PUT /api/v1/catalog/{slug}, POST /api/v1/catalog/relink ----

export interface CatalogEntry {
  slug: string
  name: string
  curseforgeId: number | null
  modrinthId: string | null
  githubLabel: string | null
  hidden: boolean
  legacy: boolean
  /** True when the poller linked it by matching names or slugs; false when it was set by hand. */
  auto: boolean
}

export interface UnlinkedProject {
  platform: Platform
  id: string
  slug: string
  name: string
  iconUrl: string
  url: string
  owned: boolean
}

export interface Catalog {
  entries: CatalogEntry[]
  /** Projects and issue labels no entry points at yet. */
  unlinked: {
    projects: UnlinkedProject[]
    githubLabels: { label: string; issues: number }[]
  }
}

/** PUT body: any field left out stays as it was. Send null to clear a link. */
export interface CatalogUpdate {
  name?: string
  curseforgeId?: number | null
  modrinthId?: string | null
  githubLabel?: string | null
  hidden?: boolean
  legacy?: boolean
}

// ---- POST /api/v1/poll -> 202 {"status":"started"}, 409 {"error":...} ---------------------------
