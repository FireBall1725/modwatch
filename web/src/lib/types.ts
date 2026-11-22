// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// The API contract: the Go handlers return exactly these shapes and the UI is built against them.
// Times are RFC 3339 UTC strings, a count that can't be known yet is null rather than 0, and lists are never null.

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

/** The release that came out most recently, as one thing: every platform it is on, every Minecraft version it covers, and the day it first came out. */
export interface LatestRelease {
  platforms: Platform[]
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
  /** True for the kinds the author may dismiss: review_pending, review_stuck, not_approved, missing_platform, no_latest_minecraft, stale_release. Never crash_open, bug_open, source_down or unlinked. */
  dismissible: boolean
}

/** POST /api/v1/attention/dismiss and /restore. 400 for a kind that isn't dismissible. Both answer 204. */
export interface AttentionRef {
  kind: AttentionKind
  modSlug: string
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
  /** What is wrong now. Items the author dismissed are not here; they are in `dismissed`. */
  attention: AttentionItem[]
  /** Dismissed items that still apply, so the author can restore them. A dismissed item doesn't count toward a mod's health or the totals. */
  dismissed: AttentionItem[]
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
  /** The release the version text names, such as 26.11.0 or 26.11.0-rc.1. The same release on both platforms and for each Minecraft version has the same value. */
  release: string
  /** True when the release has a tag such as rc.1. */
  prerelease: boolean
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
  /** The repository the issue lives in, owner/name. */
  repo: string
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
  /** The shared issues repository (settings.githubIssuesRepo), or "" when there is none. */
  repo: string
  /** Every repository being read: the shared one plus each mod's own (CatalogEntry.githubRepo). */
  repos: string[]
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
  /** This mod's own issues repository, owner/name. Every issue in it belongs to this mod. null when the mod uses the shared repository's `mod: <label>` labels, or has no issues. */
  githubRepo: string | null
  /** This mod's own pattern for reading its file versions, with named groups version, pre and minecraft, such as `^(?P<version>\d+\.\d+\.\d+)(?:-(?P<pre>rc\.\d+))?-(?:mc)?(?P<minecraft>\d+(?:\.\d+)+)$`. null means the default reading, which already understands `26.11.0 for Minecraft 1.21.1` and `26.11.0-mc1.21.1`. */
  versionRegex: string | null
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
  githubRepo?: string | null
  /** 400 {error} when it isn't a valid regular expression or has no group named version. null clears it. */
  versionRegex?: string | null
  hidden?: boolean
  legacy?: boolean
}

// ---- Settings: GET and PUT /api/v1/settings ----------------------------------------------------
// Each setting can come from an environment variable, or be set here. A value set here wins; clearing it
// falls back to the environment variable. Secrets are write-only: the API never returns them.

export type SettingKey =
  | 'curseforgeApiKey'
  | 'curseforgeAuthorId'
  | 'modrinthUser'
  | 'modrinthToken'
  | 'githubToken'
  | 'githubIssuesRepo'
  | "metricsEnabled"
  | "disabledMinecraftVersions"
  | "revenueEnabled"

export type SettingSource = 'ui' | 'env' | 'none'

/** metricsEnabled holds the strings 'true' or 'false'. value null with source 'none' means not chosen, which the app treats as on. */
export interface SettingItem {
  key: SettingKey
  /** A secret's value is never sent (value is null); `set` says whether one exists. */
  secret: boolean
  value: string | null
  set: boolean
  /** Where the value in use comes from. */
  source: SettingSource
  /** True when the environment variable is set too, so clearing the value set here has something to fall back to. */
  envSet: boolean
}

export interface Settings {
  items: SettingItem[]
  /** Every Minecraft version any tracked file has, switched off or not, newest first. */
  minecraftVersions: string[]
}

// ---- GET /api/v1/revenue ----------------------------------------------------------------------
// What a platform owes the author. Only Modrinth has an API for it; CurseForge's balance isn't available. With the
// switch off in Settings the response is 200 {enabled: false, items: []}, so the card hides without an error.

export interface RevenueMonth {
  /** 2026-11 */
  month: string
  amount: number
}

export interface RevenueItem {
  platform: Platform
  /** ISO currency code, USD for Modrinth. */
  currency: string
  available: number
  pending: number
  withdrawnLifetime: number
  withdrawnYtd: number
  /** The last twelve months, oldest first. */
  months: RevenueMonth[]
  fetchedAt: string
}

export interface Revenue {
  enabled: boolean
  items: RevenueItem[]
}

/** POST /api/v1/curseforge/author {link} -> 200 {id, name, url}; 400 {error} for a link that isn't a profile or no key; 404 {error} when no mod lists the name. Saves nothing. */
export interface CurseForgeAuthor {
  id: number
  name: string
  url: string
}

/** PUT body: only the keys sent change. A string sets the value; null or "" clears the value set here, so the environment variable applies again. 400 with {error} for a bad value (author id not a positive number, repo not owner/name). */
export type SettingsUpdate = Partial<Record<SettingKey, string | null>>

// ---- POST /api/v1/poll -> 202 {"status":"started"}, 409 {"error":...} ---------------------------
