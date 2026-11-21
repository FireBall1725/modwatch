// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import type { AttentionItem, DownloadsHistory, ModSummary } from '../../lib/types'
import {
  DEFAULT_VIEW,
  filterMods,
  groupAttention,
  isInReview,
  modSeries,
  parseView,
  platformShare,
  seriesGrowth,
  sortAttention,
  sortMods,
  sourceIsDown,
  verdict,
  viewToParams,
  worstAttention,
} from './logic'

const item = (severity: AttentionItem['severity'], kind: AttentionItem['kind'], title: string = kind): AttentionItem => ({
  severity,
  kind,
  modSlug: null,
  title,
  detail: '',
  url: null,
})

function mod(over: Partial<ModSummary> & { slug: string }): ModSummary {
  return {
    name: over.slug,
    iconUrl: '',
    summary: '',
    owned: true,
    curseforge: null,
    modrinth: null,
    github: null,
    downloads: { total: 0, curseforge: 0, modrinth: 0, delta24h: null, delta7d: null },
    latestRelease: null,
    minecraftVersions: [],
    loaders: [],
    health: 'ok',
    attention: [],
    ...over,
  }
}

const platform = (status: 'approved' | 'in_review' | 'draft' | 'inactive') =>
  ({ platform: 'modrinth', status }) as unknown as NonNullable<ModSummary['modrinth']>

describe('sortAttention', () => {
  it('puts severity first, then the kind order', () => {
    const sorted = sortAttention([
      item('info', 'stale_release'),
      item('warning', 'no_latest_minecraft'),
      item('problem', 'not_approved'),
      item('warning', 'bug_open'),
      item('problem', 'crash_open'),
    ])
    expect(sorted.map((i) => i.kind)).toEqual(['crash_open', 'not_approved', 'bug_open', 'no_latest_minecraft', 'stale_release'])
  })

  it('keeps the server order for ties and does not mutate the input', () => {
    const input = [item('warning', 'bug_open', 'a'), item('warning', 'bug_open', 'b')]
    expect(sortAttention(input).map((i) => i.title)).toEqual(['a', 'b'])
    expect(input.map((i) => i.title)).toEqual(['a', 'b'])
  })
})

describe('groupAttention and verdict', () => {
  it('splits by severity', () => {
    const g = groupAttention([item('info', 'unlinked'), item('problem', 'crash_open'), item('info', 'stale_release')])
    expect([g.problem.length, g.warning.length, g.info.length]).toEqual([1, 0, 2])
  })

  it('says clear only when there is nothing at all', () => {
    expect(verdict(groupAttention([]), 0)).toBe('clear')
    expect(verdict(groupAttention([item('info', 'unlinked')]), 0)).toBe('note')
    expect(verdict(groupAttention([item('warning', 'bug_open')]), 0)).toBe('warning')
    expect(verdict(groupAttention([item('problem', 'crash_open'), item('warning', 'bug_open')]), 0)).toBe('problem')
  })

  it('counts a setup problem as a problem', () => {
    expect(verdict(groupAttention([]), 1)).toBe('problem')
  })
})

describe('view state in the URL', () => {
  it('round trips and omits defaults', () => {
    expect(viewToParams(DEFAULT_VIEW).toString()).toBe('')
    const view = { q: 'ae2', show: 'attention' as const, sort: 'movement' as const, notes: true }
    expect(parseView(viewToParams(view))).toEqual(view)
  })

  it('ignores unknown values', () => {
    const v = parseView(new URLSearchParams('show=nope&sort=bad&notes=2'))
    expect(v).toEqual(DEFAULT_VIEW)
  })

  it('drops a blank search', () => {
    expect(viewToParams({ ...DEFAULT_VIEW, q: '   ' }).toString()).toBe('')
  })
})

describe('filterMods', () => {
  const mods = [
    mod({ slug: 'a', name: 'Alpha Lights', health: 'ok', modrinth: platform('approved') }),
    mod({ slug: 'b', name: 'Beta', health: 'attention', modrinth: platform('in_review') }),
    mod({ slug: 'ae2-c', name: 'Gamma', health: 'problem', curseforge: platform('draft') }),
  ]

  it('searches name and slug, case-insensitively', () => {
    expect(filterMods(mods, { q: 'LIGHTS', show: 'all' }).map((m) => m.slug)).toEqual(['a'])
    expect(filterMods(mods, { q: 'ae2', show: 'all' }).map((m) => m.slug)).toEqual(['ae2-c'])
  })

  it('filters by health and review', () => {
    expect(filterMods(mods, { q: '', show: 'attention' }).map((m) => m.slug)).toEqual(['b', 'ae2-c'])
    expect(filterMods(mods, { q: '', show: 'review' }).map((m) => m.slug)).toEqual(['b', 'ae2-c'])
  })

  it('treats inactive and approved as not in review', () => {
    expect(isInReview(mod({ slug: 'x', curseforge: platform('inactive'), modrinth: platform('approved') }))).toBe(false)
  })
})

describe('sortMods', () => {
  const dl = (total: number, delta7d: number | null) => ({ total, curseforge: total, modrinth: 0, delta24h: null, delta7d })
  const mods = [
    mod({ slug: 'a', name: 'A', downloads: dl(10, 5), health: 'ok', github: { label: 'a', open: 0, openBugs: 0, openCrashes: 0, oldestOpenBugAt: null } }),
    mod({ slug: 'b', name: 'B', downloads: dl(30, null), health: 'problem', github: { label: 'b', open: 3, openBugs: 1, openCrashes: 0, oldestOpenBugAt: null } }),
    mod({ slug: 'c', name: 'C', downloads: dl(20, 50), health: 'attention' }),
  ]

  it('sorts each key', () => {
    expect(sortMods(mods, 'downloads').map((m) => m.slug)).toEqual(['b', 'c', 'a'])
    expect(sortMods(mods, 'movement').map((m) => m.slug)).toEqual(['c', 'a', 'b'])
    expect(sortMods(mods, 'health').map((m) => m.slug)).toEqual(['b', 'c', 'a'])
    expect(sortMods(mods, 'issues').map((m) => m.slug)).toEqual(['b', 'a', 'c'])
    expect(sortMods(mods, 'name').map((m) => m.slug)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate', () => {
    const before = mods.map((m) => m.slug)
    sortMods(mods, 'name')
    expect(mods.map((m) => m.slug)).toEqual(before)
  })
})

describe('derived numbers', () => {
  it('computes platform share without NaN', () => {
    expect(platformShare({ total: 0, curseforge: 0, modrinth: 0 })).toEqual({ curseforge: 0, modrinth: 0 })
    expect(platformShare({ total: 200, curseforge: 150, modrinth: 50 })).toEqual({ curseforge: 0.75, modrinth: 0.25 })
  })

  const history: DownloadsHistory = {
    days: 5,
    total: [],
    perMod: {
      a: Array.from({ length: 5 }, (_, i) => ({ at: `2026-11-0${i + 1}T00:00:00.000Z`, curseforge: 10 + i, modrinth: i })),
    },
  }

  it('slices the last N days of one mod and sums platforms', () => {
    expect(modSeries(history, 'a', 2)).toEqual([12 + 2, 13 + 3, 14 + 4])
    expect(modSeries(history, 'missing')).toEqual([])
    expect(modSeries(null, 'a')).toEqual([])
  })

  it('measures growth', () => {
    expect(seriesGrowth([5, 9])).toBe(4)
    expect(seriesGrowth([5])).toBeNull()
  })

  it('finds the worst attention item of a mod', () => {
    const m = mod({ slug: 'x', attention: [item('info', 'stale_release'), item('problem', 'crash_open')] })
    expect(worstAttention(m)?.kind).toBe('crash_open')
    expect(worstAttention(mod({ slug: 'y' }))).toBeNull()
  })

  it('finds a failing source', () => {
    const s = [{ source: 'github', ok: false, checkedAt: '', lastOkAt: null }]
    expect(sourceIsDown(s, 'github')).toBe(true)
    expect(sourceIsDown(s, 'modrinth')).toBe(false)
  })
})
