// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import type { MatrixRow, ModSummary, VersionTotal } from '../../lib/types'
import {
  dailyByVersion,
  DEFAULT_STATE,
  coverage,
  currentRows,
  legacySlugs,
  filterRows,
  gapRows,
  newestCell,
  parseState,
  rowTotal,
  serializeState,
  seriesTotal,
  sortLoaders,
  sortTotals,
  topVersion,
  visibleVersions,
} from './logic'

const vt = (name: string, downloads: number): VersionTotal => ({ name, downloads, curseforge: downloads, modrinth: 0, files: 1 })
const row = (slug: string, cells: Record<string, number>): MatrixRow => ({
  slug,
  name: slug.toUpperCase(),
  iconUrl: '',
  cells: Object.fromEntries(Object.entries(cells).map(([k, d]) => [k, { downloads: d, platforms: ['curseforge'] as const }])) as MatrixRow['cells'],
})

describe('sortTotals', () => {
  const list = [vt('1.21.11', 5), vt('26.1', 3), vt('1.7.10', 9), vt('1.21.4', 5)]
  it('sorts by Minecraft version, not text', () => {
    expect(sortTotals(list, 'version').map((v) => v.name)).toEqual(['26.1', '1.21.11', '1.21.4', '1.7.10'])
  })
  it('sorts by downloads with ties broken by version', () => {
    expect(sortTotals(list, 'downloads').map((v) => v.name)).toEqual(['1.7.10', '1.21.11', '1.21.4', '26.1'])
  })
  it('does not mutate its input', () => {
    sortTotals(list, 'downloads')
    expect(list[0].name).toBe('1.21.11')
  })
  it('finds the top version and handles empty', () => {
    expect(topVersion(list)?.name).toBe('1.7.10')
    expect(topVersion([])).toBeNull()
  })
  it('sorts loaders by downloads', () => {
    expect(sortLoaders([vt('fabric', 1), vt('forge', 9)]).map((v) => v.name)).toEqual(['forge', 'fabric'])
  })
})

describe('matrix', () => {
  const rows = [row('a', { '26.1': 10, '1.21.1': 5 }), row('b', { '1.21.1': 50 }), row('c', {})]
  it('finds gaps against the newest version', () => {
    expect(gapRows(rows, '26.1').map((r) => r.slug)).toEqual(['b', 'c'])
    expect(gapRows(rows, null)).toEqual([])
  })
  it('counts coverage', () => {
    expect(coverage(rows, '26.1')).toEqual({ have: 1, total: 3 })
    expect(coverage(rows, null)).toEqual({ have: 0, total: 3 })
  })
  it('names the newest version a mod has', () => {
    expect(newestCell(rows[0])).toBe('26.1')
    expect(newestCell(rows[2])).toBeNull()
  })
  it('totals a row', () => {
    expect(rowTotal(rows[0])).toBe(15)
  })
  it('filters by search and gaps and orders by total', () => {
    expect(filterRows(rows, '', false, '26.1').map((r) => r.slug)).toEqual(['b', 'a', 'c'])
    expect(filterRows(rows, ' B', false, '26.1').map((r) => r.slug)).toEqual(['b'])
    expect(filterRows(rows, '', true, '26.1').map((r) => r.slug)).toEqual(['b', 'c'])
  })
  it('limits columns to the newest eight unless all is asked for', () => {
    const v = ['1.7.10', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13', '1.14', '1.15', '26.1']
    expect(visibleVersions(v, 'recent')).toHaveLength(8)
    expect(visibleVersions(v, 'recent')[0]).toBe('26.1')
    expect(visibleVersions(v, 'all')).toHaveLength(10)
  })
})

describe('dailyByVersion', () => {
  const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']
  const h = (vals: number[]) => vals.map((downloads, i) => ({ at: days[i], downloads }))
  const history = { '1.21.1': h([0, 10, 30, 30]), '26.1': h([5, 5, 8, 9]), '1.7.10': h([0, 0, 0, 0]) }
  it('turns cumulative counts into daily gains over the window', () => {
    const d = dailyByVersion(history, 3)
    expect(d.x).toEqual(days.slice(1))
    expect(d.series.find((s) => s.key === '1.21.1')?.values).toEqual([10, 20, 0])
    expect(d.series.find((s) => s.key === '26.1')?.values).toEqual([0, 3, 1])
  })
  it('drops versions with no downloads and lists newest first', () => {
    const d = dailyByVersion(history, 3)
    expect(d.series.map((s) => s.key)).toEqual(['26.1', '1.21.1'])
  })
  it('sums the smallest versions into other', () => {
    const d = dailyByVersion(history, 3, 1)
    expect(d.series.map((s) => s.key)).toEqual(['1.21.1', 'other'])
    expect(seriesTotal(d)).toBe(34)
  })
  it('treats a drop as zero and handles no history', () => {
    expect(dailyByVersion({ a: h([9, 5, 5, 5]) }, 3).series).toEqual([])
    expect(dailyByVersion({}, 7)).toEqual({ x: [], series: [] })
  })
  it('uses the whole history when the window is longer', () => {
    expect(dailyByVersion(history, 90).x).toHaveLength(4)
  })
})

describe('url state', () => {
  it('round trips and omits defaults', () => {
    expect(serializeState(DEFAULT_STATE).toString()).toBe('')
    const s = { sort: 'downloads', range: 90, span: 'all', query: 'ae2', gapsOnly: true } as const
    expect(parseState(serializeState(s))).toEqual(s)
  })
  it('ignores junk', () => {
    expect(parseState(new URLSearchParams('sort=x&range=5&span=y&gaps=0'))).toEqual(DEFAULT_STATE)
  })
})

const mod = (slug: string, legacy: boolean, loaders: string[], total: number): ModSummary =>
  ({ slug, legacy, loaders, downloads: { total, curseforge: total, modrinth: 0 } }) as unknown as ModSummary

describe('legacy and untagged mods', () => {
  const rows = [row('a', { '1.21.1': 5 }), row('old', { '1.7.10': 50 })]
  const mods = [mod('a', false, ['neoforge'], 5), mod('old', true, [], 50)]
  it('leaves legacy mods out of coverage and gaps', () => {
    const cur = currentRows(rows, legacySlugs(mods))
    expect(cur.map((r) => r.slug)).toEqual(['a'])
    expect(coverage(cur, '1.21.1')).toEqual({ have: 1, total: 1 })
    expect(gapRows(cur, '1.21.1')).toEqual([])
  })
  it('keeps legacy mods out of the gaps-only filter', () => {
    expect(filterRows(rows, '', true, '1.21.1', legacySlugs(mods))).toEqual([])
    expect(filterRows(rows, '', true, '1.21.1').map((r) => r.slug)).toEqual(['old'])
  })
})
