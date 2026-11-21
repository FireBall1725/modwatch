// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { compareMinecraft } from '../../lib/minecraft'
import type { MatrixRow, ModSummary, VersionTotal } from '../../lib/types'

export type SortMode = 'version' | 'downloads'
export type RangeDays = 7 | 30 | 90
export type MatrixSpan = 'recent' | 'all'

/** How many versions the matrix shows in its default "recent" span. */
export const RECENT_VERSIONS = 8
/** How many versions get their own series in the per day chart; the rest are summed into "other". */
export const CHART_VERSIONS = 7

export interface PageState {
  sort: SortMode
  range: RangeDays
  span: MatrixSpan
  query: string
  gapsOnly: boolean
}

export const DEFAULT_STATE: PageState = { sort: 'version', range: 30, span: 'recent', query: '', gapsOnly: false }

/** Reads the page state from the query string; anything unknown falls back to the default. */
export function parseState(p: URLSearchParams): PageState {
  const sort = p.get('sort')
  const range = Number(p.get('range'))
  return {
    sort: sort === 'downloads' ? 'downloads' : 'version',
    range: range === 7 || range === 90 ? range : 30,
    span: p.get('span') === 'all' ? 'all' : 'recent',
    query: p.get('q') ?? '',
    gapsOnly: p.get('gaps') === '1',
  }
}

/** Writes only the values that differ from the defaults, so a plain /versions stays clean. */
export function serializeState(s: PageState): URLSearchParams {
  const p = new URLSearchParams()
  if (s.sort !== DEFAULT_STATE.sort) p.set('sort', s.sort)
  if (s.range !== DEFAULT_STATE.range) p.set('range', String(s.range))
  if (s.span !== DEFAULT_STATE.span) p.set('span', s.span)
  if (s.query.trim()) p.set('q', s.query)
  if (s.gapsOnly) p.set('gaps', '1')
  return p
}

/** Version totals in the requested order: by Minecraft version, newest first, or by downloads with ties by version. */
export function sortTotals(list: readonly VersionTotal[], mode: SortMode): VersionTotal[] {
  const byVersion = (a: VersionTotal, b: VersionTotal) => compareMinecraft(b.name, a.name)
  return [...list].sort(mode === 'version' ? byVersion : (a, b) => b.downloads - a.downloads || byVersion(a, b))
}

/** Loader totals, biggest first. */
export function sortLoaders(list: readonly VersionTotal[]): VersionTotal[] {
  return [...list].sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name))
}

/** The version with the most downloads, or null for an empty list. */
export function topVersion(list: readonly VersionTotal[]): VersionTotal | null {
  return sortTotals(list, 'downloads')[0] ?? null
}

/** Mods with no file for the given version. A null version means nothing is known, so nothing is a gap. */
export function gapRows(rows: readonly MatrixRow[], version: string | null): MatrixRow[] {
  if (!version) return []
  return rows.filter((r) => !r.cells[version])
}

/** The newest version a mod has a file for, or null when it has none. */
export function newestCell(row: MatrixRow): string | null {
  return Object.keys(row.cells).sort((a, b) => compareMinecraft(b, a))[0] ?? null
}

/** Total downloads across a row's cells. */
export function rowTotal(row: MatrixRow): number {
  return Object.values(row.cells).reduce((a, c) => a + c.downloads, 0)
}

/** How many mods have a file for the version, out of all rows. */
export function coverage(rows: readonly MatrixRow[], version: string | null): { have: number; total: number } {
  if (!version) return { have: 0, total: rows.length }
  return { have: rows.filter((r) => r.cells[version]).length, total: rows.length }
}

/** Matrix columns: all versions, or the newest few, always newest first. */
export function visibleVersions(versions: readonly string[], span: MatrixSpan): string[] {
  const sorted = [...versions].sort((a, b) => compareMinecraft(b, a))
  return span === 'all' ? sorted : sorted.slice(0, RECENT_VERSIONS)
}

/** Slugs of the mods marked legacy in Settings. */
export function legacySlugs(mods: readonly ModSummary[] | null): Set<string> {
  return new Set((mods ?? []).filter((m) => m.legacy).map((m) => m.slug))
}

/** Rows that are not legacy: the ones "ready for the newest version" is about. */
export function currentRows(rows: readonly MatrixRow[], legacy: ReadonlySet<string>): MatrixRow[] {
  return rows.filter((r) => !legacy.has(r.slug))
}

/** Matrix rows after search and the gaps-only switch, biggest total first. Legacy mods never count as missing a file. */
export function filterRows(
  rows: readonly MatrixRow[],
  query: string,
  gapsOnly: boolean,
  latest: string | null,
  legacy: ReadonlySet<string> = new Set(),
): MatrixRow[] {
  const q = query.trim().toLowerCase()
  const kept = rows.filter(
    (r) => (!q || r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)) && (!gapsOnly || !latest || (!r.cells[latest] && !legacy.has(r.slug))),
  )
  return kept.sort((a, b) => rowTotal(b) - rowTotal(a) || a.name.localeCompare(b.name))
}

export interface DailySeries {
  x: string[]
  series: { key: string; values: number[] }[]
}

/**
 * Downloads per day per version from cumulative histories. Takes the last `days` days, gives the biggest `top` versions
 * their own series (listed newest version first) and sums the rest into "other". A drop in a cumulative count counts as 0.
 */
export function dailyByVersion(history: Record<string, { at: string; downloads: number }[]>, days: number, top = CHART_VERSIONS): DailySeries {
  const dates = [...new Set(Object.values(history).flatMap((h) => h.map((p) => p.at)))].sort()
  const x = dates.slice(-days)
  if (x.length === 0) return { x: [], series: [] }
  const start = dates.indexOf(x[0])
  const prev = start > 0 ? dates[start - 1] : null
  const perVersion = Object.entries(history).map(([key, points]) => {
    const at = new Map(points.map((p) => [p.at, p.downloads]))
    let last = prev ? (at.get(prev) ?? 0) : (at.get(x[0]) ?? 0)
    const values = x.map((d) => {
      const v = at.get(d) ?? last
      const delta = Math.max(0, v - last)
      last = v
      return delta
    })
    return { key, values, sum: values.reduce((a, b) => a + b, 0) }
  })
  const ranked = perVersion.filter((v) => v.sum > 0).sort((a, b) => b.sum - a.sum)
  const chosen = ranked.slice(0, top).sort((a, b) => compareMinecraft(b.key, a.key))
  const rest = ranked.slice(top)
  const series = chosen.map(({ key, values }) => ({ key, values }))
  if (rest.length) series.push({ key: 'other', values: x.map((_, i) => rest.reduce((a, v) => a + v.values[i], 0)) })
  return { x, series }
}

/** Sum of every value in a daily series set. */
export function seriesTotal(d: DailySeries): number {
  return d.series.reduce((a, s) => a + s.values.reduce((x, y) => x + y, 0), 0)
}
