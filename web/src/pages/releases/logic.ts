// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { daysBetween, formatDate } from '../../lib/format'
import { compareMinecraft } from '../../lib/minecraft'
import type { ModSummary, Platform, PlatformInfo, ReleaseItem, ReviewStatus } from '../../lib/types'

/** Days in the Modrinth queue after which a project is called slow. */
export const QUEUE_SLOW_DAYS = 7
/** Days without a release after which a mod is called stale. */
export const STALE_DAYS = 120

export type BoardGroup = 'blocked' | 'waiting' | 'unpublished' | 'dormant' | 'approved'

export const GROUP_ORDER: BoardGroup[] = ['blocked', 'waiting', 'unpublished', 'dormant', 'approved']

const STATUS_GROUP: Record<ReviewStatus, BoardGroup> = {
  changes_required: 'blocked',
  rejected: 'blocked',
  in_review: 'waiting',
  draft: 'unpublished',
  unlisted: 'unpublished',
  archived: 'dormant',
  inactive: 'dormant',
  unknown: 'dormant',
  approved: 'approved',
}

export function statusGroup(status: ReviewStatus): BoardGroup {
  return STATUS_GROUP[status]
}

export interface BoardRow {
  key: string
  slug: string
  name: string
  iconUrl: string
  owned: boolean
  platform: Platform
  info: PlatformInfo
  group: BoardGroup
  /** Whole days in the review queue; only known when the platform tells us when it was queued. */
  queueDays: number | null
  slow: boolean
}

export function buildBoard(mods: readonly ModSummary[], now: Date = new Date()): BoardRow[] {
  const rows: BoardRow[] = []
  for (const mod of mods) {
    for (const info of [mod.curseforge, mod.modrinth]) {
      if (!info) continue
      const group = statusGroup(info.status)
      const queueDays = group === 'waiting' && info.queuedAt ? Math.max(0, daysBetween(info.queuedAt, now)) : null
      rows.push({
        key: `${mod.slug}:${info.platform}`,
        slug: mod.slug,
        name: mod.name,
        iconUrl: mod.iconUrl,
        owned: mod.owned,
        platform: info.platform,
        info,
        group,
        queueDays,
        slow: queueDays !== null && queueDays >= QUEUE_SLOW_DAYS,
      })
    }
  }
  return sortBoard(rows)
}

/** Worst group first, then longest in the queue, then name, then CurseForge before Modrinth. */
export function sortBoard(rows: readonly BoardRow[]): BoardRow[] {
  return [...rows].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      (b.queueDays ?? -1) - (a.queueDays ?? -1) ||
      a.name.localeCompare(b.name) ||
      a.platform.localeCompare(b.platform),
  )
}

export interface BoardFilter {
  platform: Platform | 'all'
  q: string
  showApproved: boolean
  showMembers: boolean
}

export function filterBoard(rows: readonly BoardRow[], f: BoardFilter): BoardRow[] {
  const q = f.q.trim().toLowerCase()
  return rows.filter(
    (r) =>
      (f.platform === 'all' || r.platform === f.platform) &&
      (f.showMembers || r.owned) &&
      (f.showApproved || r.group !== 'approved') &&
      (!q || r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)),
  )
}

export type BoardCounts = Record<BoardGroup, number>

export function countGroups(rows: readonly BoardRow[]): BoardCounts {
  const c: BoardCounts = { blocked: 0, waiting: 0, unpublished: 0, dormant: 0, approved: 0 }
  for (const r of rows) c[r.group]++
  return c
}

/** Projects that need a decision or a wait: everything that is not approved and not dormant. */
export function openCount(c: BoardCounts): number {
  return c.blocked + c.waiting + c.unpublished
}

export interface Section {
  group: BoardGroup
  rows: BoardRow[]
}

export function groupBoard(rows: readonly BoardRow[]): Section[] {
  return GROUP_ORDER.map((group) => ({ group, rows: rows.filter((r) => r.group === group) })).filter((s) => s.rows.length > 0)
}

export type Freshness = 'fresh' | 'stale' | 'none'

export interface SinceRow {
  slug: string
  name: string
  iconUrl: string
  /** ISO time of the newest release on either platform, or null when none is known. */
  at: string | null
  days: number | null
  platforms: Platform[]
  freshness: Freshness
}

/** Newest release per owned mod, from the release list plus each mod's own latestRelease; oldest first so the neglected mods lead. */
export function sinceLastRelease(mods: readonly ModSummary[], releases: readonly ReleaseItem[], now: Date = new Date()): SinceRow[] {
  const rows: SinceRow[] = []
  for (const mod of mods) {
    if (!mod.owned) continue
    const times: { at: string; platform: Platform }[] = []
    if (mod.latestRelease) for (const platform of mod.latestRelease.platforms) times.push({ at: mod.latestRelease.publishedAt, platform })
    for (const r of releases) if (r.modSlug === mod.slug) times.push({ at: r.publishedAt, platform: r.platform })
    times.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    const newest = times[0]
    const days = newest ? Math.max(0, daysBetween(newest.at, now)) : null
    const platforms = newest ? [...new Set(times.filter((t) => t.at === newest.at).map((t) => t.platform))] : []
    rows.push({
      slug: mod.slug,
      name: mod.name,
      iconUrl: mod.iconUrl,
      at: newest?.at ?? null,
      days,
      platforms,
      freshness: days === null ? 'none' : days >= STALE_DAYS ? 'stale' : 'fresh',
    })
  }
  return rows.sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity) || a.name.localeCompare(b.name))
}

export interface ReleaseFilter {
  platform: Platform | 'all'
  type: ReleaseItem['releaseType'] | 'all'
  mod: string
  mc: string
}

export function filterReleases(items: readonly ReleaseItem[], f: ReleaseFilter, ownedSlugs: ReadonlySet<string> | null): ReleaseItem[] {
  return items.filter(
    (r) =>
      (f.platform === 'all' || r.platform === f.platform) &&
      (f.type === 'all' || r.releaseType === f.type) &&
      (f.mod === 'all' || r.modSlug === f.mod) &&
      (f.mc === 'all' || r.minecraftVersions.includes(f.mc)) &&
      (!ownedSlugs || r.modSlug === null || ownedSlugs.has(r.modSlug)),
  )
}

/** Newest first. */
export function sortReleases(items: readonly ReleaseItem[]): ReleaseItem[] {
  return [...items].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
}

/** One release published as several files (one per Minecraft version) becomes one row. */
export function mergeReleases(items: readonly ReleaseItem[]): ReleaseItem[] {
  const byKey = new Map<string, ReleaseItem>()
  for (const r of items) {
    const key = `${r.platform}|${r.modSlug ?? r.modName}|${r.version}|${r.publishedAt.slice(0, 16)}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, { ...r, minecraftVersions: [...r.minecraftVersions], loaders: [...r.loaders] })
      continue
    }
    prev.minecraftVersions = [...new Set([...prev.minecraftVersions, ...r.minecraftVersions])]
    prev.loaders = [...new Set([...prev.loaders, ...r.loaders])]
    prev.downloads = Math.max(prev.downloads, r.downloads)
    if (Date.parse(r.publishedAt) > Date.parse(prev.publishedAt)) prev.publishedAt = r.publishedAt
    prev.url = prev.url ?? r.url
  }
  return [...byKey.values()]
}

/** Calendar day in the viewer's time zone, the same zone formatTime uses. */
export function localDay(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

/** Header text for a YYYY-MM-DD local day key, built as a local date so no UTC shift applies. */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return formatDate(new Date(y, m - 1, d).toISOString())
}

export interface DayGroup {
  /** Local calendar day, YYYY-MM-DD. */
  day: string
  items: ReleaseItem[]
}

export function groupByDay(items: readonly ReleaseItem[]): DayGroup[] {
  const out: DayGroup[] = []
  for (const item of items) {
    const day = localDay(item.publishedAt)
    const last = out[out.length - 1]
    if (last && last.day === day) last.items.push(item)
    else out.push({ day, items: [item] })
  }
  return out
}

export function minecraftOptions(items: readonly ReleaseItem[]): string[] {
  return [...new Set(items.flatMap((r) => r.minecraftVersions))].sort((a, b) => compareMinecraft(b, a))
}

// ---- URL state ----------------------------------------------------------------------------------

export interface PageState {
  platform: Platform | 'all'
  /** The timeline's own platform filter. */
  rplatform: Platform | 'all'
  q: string
  approved: boolean
  members: boolean
  type: ReleaseFilter['type']
  mod: string
  mc: string
}

export const TYPES = ['all', 'release', 'beta', 'alpha', 'unknown'] as const

export function parseState(p: URLSearchParams): PageState {
  const platform = p.get('platform')
  const rp = p.get('rplatform')
  const type = p.get('type') as ReleaseFilter['type'] | null
  return {
    platform: platform === 'curseforge' || platform === 'modrinth' ? platform : 'all',
    rplatform: rp === 'curseforge' || rp === 'modrinth' ? rp : 'all',
    q: p.get('q') ?? '',
    approved: p.get('approved') === '1',
    members: p.get('members') === '1',
    type: type && (TYPES as readonly string[]).includes(type) ? type : 'all',
    mod: p.get('mod') || 'all',
    mc: p.get('mc') || 'all',
  }
}

/** Only non-default values are written, so the default view has a clean URL. */
export function serializeState(s: PageState): URLSearchParams {
  const p = new URLSearchParams()
  if (s.platform !== 'all') p.set('platform', s.platform)
  if (s.rplatform !== 'all') p.set('rplatform', s.rplatform)
  if (s.q) p.set('q', s.q)
  if (s.approved) p.set('approved', '1')
  if (s.members) p.set('members', '1')
  if (s.type !== 'all') p.set('type', s.type)
  if (s.mod !== 'all') p.set('mod', s.mod)
  if (s.mc !== 'all') p.set('mc', s.mc)
  return p
}
