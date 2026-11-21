// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Pure logic for the mods page: URL state, filtering, sorting and the numbers derived from the list.

import { compareMinecraft } from '../../lib/minecraft'
import type { AttentionItem, Health, ModSummary, PlatformInfo, ReviewStatus, Severity } from '../../lib/types'

export type HealthFilter = 'all' | Health
export type PlatformFilter = 'any' | 'curseforge' | 'modrinth' | 'both' | 'one'
export type ReviewFilter = 'any' | 'approved' | 'in_review' | 'not_approved'
export type SortKey = 'health' | 'name' | 'curseforge' | 'modrinth' | 'issues' | 'downloads' | 'delta7d' | 'release' | 'minecraft'
export type SortDir = 'asc' | 'desc'

export interface ModsQuery {
  q: string
  health: HealthFilter
  platform: PlatformFilter
  review: ReviewFilter
  /** A Minecraft version, or empty for any. */
  mc: string
  /** Only mods with open issues. */
  issues: boolean
  /** Include mods the author is only a member of. */
  members: boolean
  sort: SortKey
  dir: SortDir
}

export const DEFAULT_QUERY: ModsQuery = {
  q: '',
  health: 'all',
  platform: 'any',
  review: 'any',
  mc: '',
  issues: false,
  members: false,
  sort: 'health',
  dir: 'desc',
}

const HEALTHS: HealthFilter[] = ['all', 'problem', 'attention', 'ok']
const PLATFORMS: PlatformFilter[] = ['any', 'curseforge', 'modrinth', 'both', 'one']
const REVIEWS: ReviewFilter[] = ['any', 'approved', 'in_review', 'not_approved']
export const SORT_KEYS: SortKey[] = ['health', 'name', 'curseforge', 'modrinth', 'issues', 'downloads', 'delta7d', 'release', 'minecraft']

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** Reads a query string into a full ModsQuery; anything unknown falls back to the default. */
export function parseQuery(params: URLSearchParams): ModsQuery {
  const sort = pick(params.get('sort'), SORT_KEYS, DEFAULT_QUERY.sort)
  return {
    q: params.get('q') ?? '',
    health: pick(params.get('health'), HEALTHS, DEFAULT_QUERY.health),
    platform: pick(params.get('platform'), PLATFORMS, DEFAULT_QUERY.platform),
    review: pick(params.get('review'), REVIEWS, DEFAULT_QUERY.review),
    mc: params.get('mc') ?? '',
    issues: params.get('issues') === '1',
    members: params.get('members') === '1',
    sort,
    dir: pick(params.get('dir'), ['asc', 'desc'] as const, defaultDir(sort)),
  }
}

/** Text sorts ascending first, numbers and severity descending first. */
export function defaultDir(sort: SortKey): SortDir {
  return sort === 'name' || sort === 'curseforge' || sort === 'modrinth' ? 'asc' : 'desc'
}

/** Writes only what differs from the default, so a plain /mods link stays plain. */
export function serializeQuery(q: ModsQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (q.q.trim()) p.set('q', q.q)
  if (q.health !== DEFAULT_QUERY.health) p.set('health', q.health)
  if (q.platform !== DEFAULT_QUERY.platform) p.set('platform', q.platform)
  if (q.review !== DEFAULT_QUERY.review) p.set('review', q.review)
  if (q.mc) p.set('mc', q.mc)
  if (q.issues) p.set('issues', '1')
  if (q.members) p.set('members', '1')
  if (q.sort !== DEFAULT_QUERY.sort) p.set('sort', q.sort)
  if (q.dir !== defaultDir(q.sort)) p.set('dir', q.dir)
  return p
}

/** How many filters are narrowing the list, not counting sort. */
export function activeFilterCount(q: ModsQuery): number {
  return [q.q.trim() !== '', q.health !== 'all', q.platform !== 'any', q.review !== 'any', q.mc !== '', q.issues].filter(Boolean).length
}

export function platforms(m: ModSummary): PlatformInfo[] {
  return [m.curseforge, m.modrinth].filter((p): p is PlatformInfo => p !== null)
}

export function openBugsAndCrashes(m: ModSummary): { bugs: number; crashes: number; total: number } {
  const bugs = m.github?.openBugs ?? 0
  const crashes = m.github?.openCrashes ?? 0
  return { bugs, crashes, total: bugs + crashes }
}

function matchesPlatform(m: ModSummary, f: PlatformFilter): boolean {
  switch (f) {
    case 'any':
      return true
    case 'curseforge':
      return m.curseforge !== null
    case 'modrinth':
      return m.modrinth !== null
    case 'both':
      return m.curseforge !== null && m.modrinth !== null
    case 'one':
      return platforms(m).length === 1
  }
}

function matchesReview(m: ModSummary, f: ReviewFilter): boolean {
  const ps = platforms(m)
  switch (f) {
    case 'any':
      return true
    case 'approved':
      return ps.length > 0 && ps.every((p) => p.status === 'approved')
    case 'in_review':
      return ps.some((p) => p.status === 'in_review')
    case 'not_approved':
      return ps.some((p) => p.status !== 'approved')
  }
}

function matchesSearch(m: ModSummary, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [m.name, m.slug, m.summary].some((s) => s.toLowerCase().includes(needle))
}

/** Every filter except health, so the health counts can show what each choice would leave. */
export function filterBase(mods: readonly ModSummary[], q: ModsQuery): ModSummary[] {
  return mods.filter(
    (m) =>
      (q.members || m.owned) &&
      matchesSearch(m, q.q) &&
      matchesPlatform(m, q.platform) &&
      matchesReview(m, q.review) &&
      (!q.mc || m.minecraftVersions.includes(q.mc)) &&
      (!q.issues || (m.github?.open ?? 0) > 0),
  )
}

export function filterMods(mods: readonly ModSummary[], q: ModsQuery): ModSummary[] {
  const base = filterBase(mods, q)
  return q.health === 'all' ? base : base.filter((m) => m.health === q.health)
}

export function healthCounts(mods: readonly ModSummary[]): Record<HealthFilter, number> {
  const c: Record<HealthFilter, number> = { all: mods.length, problem: 0, attention: 0, ok: 0 }
  for (const m of mods) c[m.health]++
  return c
}

const HEALTH_RANK: Record<Health, number> = { ok: 0, attention: 1, problem: 2 }
const SEVERITY_RANK: Record<Severity, number> = { problem: 0, warning: 1, info: 2 }

/** Lower is worse, so "most urgent first" is ascending. */
const STATUS_RANK: Record<ReviewStatus, number> = {
  rejected: 0,
  changes_required: 1,
  in_review: 2,
  draft: 3,
  unlisted: 4,
  unknown: 5,
  approved: 6,
  archived: 7,
  inactive: 8,
}

export function statusRank(p: PlatformInfo | null): number | null {
  return p ? STATUS_RANK[p.status] : null
}

/** Attention items for one mod, worst first. */
export function sortedAttention(m: ModSummary): AttentionItem[] {
  return [...m.attention].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}

/** The one reason worth showing under a mod's name. */
export function topAttention(m: ModSummary): AttentionItem | null {
  return sortedAttention(m)[0] ?? null
}

type SortValue = number | string | null

function sortValue(m: ModSummary, key: SortKey): SortValue {
  switch (key) {
    case 'health':
      // Health first, then open crashes and bugs, then size, so a tie never hides the biggest mod.
      return HEALTH_RANK[m.health] * 1e12 + Math.min(openBugsAndCrashes(m).total, 999) * 1e9 + Math.min(m.downloads.total, 999_999_999)
    case 'name':
      return m.name
    case 'curseforge':
      return statusRank(m.curseforge)
    case 'modrinth':
      return statusRank(m.modrinth)
    case 'issues':
      return m.github ? openBugsAndCrashes(m).crashes * 1e6 + openBugsAndCrashes(m).bugs * 1e3 + (m.github.open - openBugsAndCrashes(m).total) : null
    case 'downloads':
      return m.downloads.total
    case 'delta7d':
      return m.downloads.delta7d
    case 'release':
      return m.latestRelease ? Date.parse(m.latestRelease.publishedAt) : null
    case 'minecraft':
      return newestVersion(m)
  }
}

function newestVersion(m: ModSummary): string | null {
  return [...m.minecraftVersions].sort((x, y) => compareMinecraft(y, x))[0] ?? null
}

function compareValues(a: SortValue, b: SortValue, sign: number): number {
  if (typeof a === 'number' && typeof b === 'number') return sign * (a - b)
  return sign * String(a).localeCompare(String(b), 'en-CA', { numeric: true })
}

/** Sorts a copy. Missing values go last in both directions. Ties fall back to downloads, then name. */
export function sortMods(mods: readonly ModSummary[], key: SortKey, dir: SortDir): ModSummary[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...mods].sort((a, b) => {
    const va = key === 'minecraft' ? newestVersion(a) : sortValue(a, key)
    const vb = key === 'minecraft' ? newestVersion(b) : sortValue(b, key)
    if (va === null && vb !== null) return 1
    if (vb === null && va !== null) return -1
    const c = va === null || vb === null ? 0 : key === 'minecraft' ? sign * compareMinecraft(String(va), String(vb)) : compareValues(va, vb, sign)
    return c || b.downloads.total - a.downloads.total || a.name.localeCompare(b.name, 'en-CA')
  })
}

export interface ListTotals {
  mods: number
  downloads: number
  curseforge: number
  modrinth: number
  /** Null when no mod in the list has a 7 day figure yet. */
  delta7d: number | null
  openBugs: number
  openCrashes: number
}

export function summarize(mods: readonly ModSummary[]): ListTotals {
  let delta: number | null = null
  const t: ListTotals = { mods: mods.length, downloads: 0, curseforge: 0, modrinth: 0, delta7d: null, openBugs: 0, openCrashes: 0 }
  for (const m of mods) {
    t.downloads += m.downloads.total
    t.curseforge += m.downloads.curseforge
    t.modrinth += m.downloads.modrinth
    if (m.downloads.delta7d !== null) delta = (delta ?? 0) + m.downloads.delta7d
    const b = openBugsAndCrashes(m)
    t.openBugs += b.bugs
    t.openCrashes += b.crashes
  }
  t.delta7d = delta
  return t
}

/** Every Minecraft version any listed mod targets, newest first. */
export function minecraftOptions(mods: readonly ModSummary[]): string[] {
  const set = new Set<string>()
  for (const m of mods) for (const v of m.minecraftVersions) set.add(v)
  return [...set].sort((a, b) => compareMinecraft(b, a))
}

/** Splits a version list for display: the first `max` newest, and how many are left. */
export function versionPreview(versions: readonly string[], max: number): { shown: string[]; more: number } {
  const sorted = [...versions].sort((a, b) => compareMinecraft(b, a))
  return { shown: sorted.slice(0, max), more: Math.max(0, sorted.length - max) }
}

/** Short reason a platform is not simply approved, for the line under a status chip. */
export function reviewNote(p: PlatformInfo | null): { kind: 'queued' | 'message'; text: string } | null {
  if (!p || p.status === 'approved') return null
  if (p.status === 'in_review' && p.queuedAt) return { kind: 'queued', text: p.queuedAt }
  if (p.statusMessage) return { kind: 'message', text: p.statusMessage }
  return null
}

/** The version part of a release name: file names lose their extension, mod-name prefix and "-universal" tail. */
export function releaseVersion(name: string): string {
  const base = name
    .trim()
    .replace(/\.(jar|zip)$/i, '')
    .replace(/-universal$/i, '')
  const stripped = base.replace(/^[A-Za-z][A-Za-z_]*[A-Za-z0-9_]*(?=-\d)/, '').replace(/^-+/, '')
  return stripped || base || name
}

/** True when a release is old enough that "N days ago" stops being readable. */
export function isOverAYear(iso: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(iso).getTime() >= 365 * 86_400_000
}
