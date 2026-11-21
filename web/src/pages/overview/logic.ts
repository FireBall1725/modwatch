// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { AttentionItem, AttentionKind, DownloadsHistory, Health, ModDownloads, ModSummary, Severity, SourceStatus } from '../../lib/types'

const SEVERITY_RANK: Record<Severity, number> = { problem: 0, warning: 1, info: 2 }

/** Order inside a severity: what hurts users first, housekeeping last. */
const KIND_RANK: Record<AttentionKind, number> = {
  crash_open: 0,
  bug_open: 1,
  review_stuck: 2,
  not_approved: 3,
  review_pending: 4,
  source_down: 5,
  no_latest_minecraft: 6,
  missing_platform: 7,
  stale_release: 8,
  unlinked: 9,
}

const HEALTH_RANK: Record<Health, number> = { problem: 0, attention: 1, ok: 2 }

/** Severity first, then kind; the server order is kept for ties. */
export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.item.severity] - SEVERITY_RANK[b.item.severity] ||
        KIND_RANK[a.item.kind] - KIND_RANK[b.item.kind] ||
        a.i - b.i,
    )
    .map((x) => x.item)
}

export type AttentionGroups = Record<Severity, AttentionItem[]>

/** Sorted items split by severity. */
export function groupAttention(items: AttentionItem[]): AttentionGroups {
  const groups: AttentionGroups = { problem: [], warning: [], info: [] }
  for (const item of sortAttention(items)) groups[item.severity].push(item)
  return groups
}

export type Verdict = 'problem' | 'warning' | 'note' | 'clear'

/** The one-word answer to "is anything wrong?". Setup problems count as problems. */
export function verdict(groups: AttentionGroups, setupProblems: number): Verdict {
  if (groups.problem.length > 0 || setupProblems > 0) return 'problem'
  if (groups.warning.length > 0) return 'warning'
  if (groups.info.length > 0) return 'note'
  return 'clear'
}

export type ShowFilter = 'all' | 'attention' | 'review'
export type SortKey = 'downloads' | 'movement' | 'health' | 'issues' | 'name'

export interface ViewState {
  q: string
  show: ShowFilter
  sort: SortKey
  /** Whether the info-level notes are expanded. */
  notes: boolean
}

export const DEFAULT_VIEW: ViewState = { q: '', show: 'all', sort: 'downloads', notes: false }

const SHOWS: ShowFilter[] = ['all', 'attention', 'review']
const SORTS: SortKey[] = ['downloads', 'movement', 'health', 'issues', 'name']

/** Reads the view from a query string; unknown values fall back to the defaults. */
export function parseView(params: URLSearchParams): ViewState {
  const show = params.get('show') as ShowFilter
  const sort = params.get('sort') as SortKey
  return {
    q: params.get('q') ?? '',
    show: SHOWS.includes(show) ? show : DEFAULT_VIEW.show,
    sort: SORTS.includes(sort) ? sort : DEFAULT_VIEW.sort,
    notes: params.get('notes') === '1',
  }
}

/** The shortest query string that reproduces a view; defaults are left out. */
export function viewToParams(view: ViewState): URLSearchParams {
  const p = new URLSearchParams()
  if (view.q.trim()) p.set('q', view.q)
  if (view.show !== DEFAULT_VIEW.show) p.set('show', view.show)
  if (view.sort !== DEFAULT_VIEW.sort) p.set('sort', view.sort)
  if (view.notes) p.set('notes', '1')
  return p
}

/** True when a mod has a project that is not approved yet on either platform. */
export function isInReview(mod: ModSummary): boolean {
  return [mod.curseforge, mod.modrinth].some((p) => p !== null && p.status !== 'approved' && p.status !== 'inactive' && p.status !== 'archived')
}

export function filterMods(mods: ModSummary[], view: Pick<ViewState, 'q' | 'show'>): ModSummary[] {
  const q = view.q.trim().toLowerCase()
  return mods.filter((m) => {
    if (q && !m.name.toLowerCase().includes(q) && !m.slug.includes(q)) return false
    if (view.show === 'attention') return m.health !== 'ok'
    if (view.show === 'review') return isInReview(m)
    return true
  })
}

function movement(m: ModSummary): number {
  return m.downloads.delta7d ?? -Infinity
}

/** A new array; ties fall back to total downloads, then name. */
export function sortMods(mods: ModSummary[], sort: SortKey): ModSummary[] {
  const byDownloads = (a: ModSummary, b: ModSummary) => b.downloads.total - a.downloads.total || a.name.localeCompare(b.name)
  const cmp: Record<SortKey, (a: ModSummary, b: ModSummary) => number> = {
    downloads: byDownloads,
    movement: (a, b) => movement(b) - movement(a) || byDownloads(a, b),
    health: (a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || byDownloads(a, b),
    issues: (a, b) => (b.github?.open ?? -1) - (a.github?.open ?? -1) || byDownloads(a, b),
    name: (a, b) => a.name.localeCompare(b.name),
  }
  return [...mods].sort(cmp[sort])
}

/** Share of each platform in a mod's total, 0 to 1. A zero total gives zeros, never NaN. */
export function platformShare(d: Pick<ModDownloads, 'total' | 'curseforge' | 'modrinth'>): { curseforge: number; modrinth: number } {
  if (d.total <= 0) return { curseforge: 0, modrinth: 0 }
  return { curseforge: d.curseforge / d.total, modrinth: d.modrinth / d.total }
}

/** Combined cumulative downloads for the last `days` days of one mod, oldest first. Empty when the mod has no history. */
export function modSeries(history: DownloadsHistory | null | undefined, slug: string, days = 30): number[] {
  const points = history?.perMod[slug]
  if (!points || points.length === 0) return []
  return points.slice(-(days + 1)).map((p) => p.curseforge + p.modrinth)
}

/** Growth across a series, or null when it has fewer than two points. */
export function seriesGrowth(values: number[]): number | null {
  return values.length < 2 ? null : values[values.length - 1] - values[0]
}

/** The most urgent attention item that belongs to a mod, for the card's one-line reason. */
export function worstAttention(mod: ModSummary): AttentionItem | null {
  return sortAttention(mod.attention)[0] ?? null
}

/** Sources that are failing, in the order given. */
export function failingSources(sources: SourceStatus[]): SourceStatus[] {
  return sources.filter((s) => !s.ok)
}

/** Whether a named source is failing, so a count that depends on it can say it may be stale. */
export function sourceIsDown(sources: SourceStatus[], name: string): boolean {
  return sources.some((s) => s.source === name && !s.ok)
}
