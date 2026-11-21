// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import type { ModSummary, PlatformInfo, ReleaseItem, ReviewStatus } from '../../lib/types'
import {
  buildBoard,
  countGroups,
  dayLabel,
  filterBoard,
  filterReleases,
  groupByDay,
  groupBoard,
  mergeReleases,
  minecraftOptions,
  openCount,
  parseState,
  serializeState,
  sinceLastRelease,
  sortReleases,
  statusGroup,
} from './logic'

const NOW = new Date('2026-11-21T12:00:00.000Z')

function info(platform: 'curseforge' | 'modrinth', status: ReviewStatus, queuedAt: string | null = null): PlatformInfo {
  return {
    platform, id: '1', slug: 's', url: '', status, rawStatus: status, statusMessage: null, requestedStatus: null,
    queuedAt, downloads: 0, delta24h: null, delta7d: null, followers: null, publishedAt: null, updatedAt: null, files: 0,
  }
}

function mod(slug: string, cf: PlatformInfo | null, mr: PlatformInfo | null, owned = true, latest: string | null = null): ModSummary {
  return {
    slug, name: slug.toUpperCase(), iconUrl: '', summary: '', owned, curseforge: cf, modrinth: mr, github: null,
    downloads: { total: 0, curseforge: 0, modrinth: 0, delta24h: null, delta7d: null },
    latestRelease: latest ? { platform: 'modrinth', version: '1', releaseType: 'release', publishedAt: latest, minecraftVersions: [] } : null,
    minecraftVersions: [], loaders: [], health: 'ok', attention: [],
  }
}

function rel(modSlug: string | null, publishedAt: string, platform: 'curseforge' | 'modrinth' = 'modrinth', mc: string[] = ['1.21.1']): ReleaseItem {
  return { platform, modSlug, modName: modSlug ?? 'x', version: '1', name: 'n', releaseType: 'release', minecraftVersions: mc, loaders: [], publishedAt, downloads: 1, url: null }
}

const mods = [
  mod('a', info('curseforge', 'approved'), info('modrinth', 'in_review', '2026-11-12T12:00:00.000Z')),
  mod('b', info('curseforge', 'changes_required'), null),
  mod('c', null, info('modrinth', 'draft')),
  mod('m', info('curseforge', 'approved'), null, false),
]

describe('board', () => {
  it('maps statuses to groups', () => {
    expect(statusGroup('rejected')).toBe('blocked')
    expect(statusGroup('unlisted')).toBe('unpublished')
    expect(statusGroup('unknown')).toBe('dormant')
  })

  it('orders blocked before waiting before unpublished before approved', () => {
    const rows = buildBoard(mods, NOW)
    expect(rows.map((r) => r.key)).toEqual(['b:curseforge', 'a:modrinth', 'c:modrinth', 'a:curseforge', 'm:curseforge'])
  })

  it('counts queue days and flags slow ones', () => {
    const r = buildBoard(mods, NOW).find((x) => x.key === 'a:modrinth')!
    expect(r.queueDays).toBe(9)
    expect(r.slow).toBe(true)
  })

  it('leaves queue days unknown without a queued time', () => {
    const r = buildBoard([mod('x', info('curseforge', 'in_review'), null)], NOW)[0]
    expect(r.queueDays).toBeNull()
    expect(r.slow).toBe(false)
  })

  it('hides approved and member projects by default', () => {
    const rows = buildBoard(mods, NOW)
    const out = filterBoard(rows, { platform: 'all', q: '', showApproved: false, showMembers: false })
    expect(out.map((r) => r.key)).toEqual(['b:curseforge', 'a:modrinth', 'c:modrinth'])
  })

  it('filters by platform and search', () => {
    const rows = buildBoard(mods, NOW)
    const base = { q: '', showApproved: true, showMembers: true }
    expect(filterBoard(rows, { ...base, platform: 'modrinth' }).every((r) => r.platform === 'modrinth')).toBe(true)
    expect(filterBoard(rows, { ...base, platform: 'all', q: ' B ' }).map((r) => r.slug)).toEqual(['b'])
  })

  it('counts groups and open work', () => {
    const c = countGroups(buildBoard(mods, NOW))
    expect(c).toMatchObject({ blocked: 1, waiting: 1, unpublished: 1, approved: 2 })
    expect(openCount(c)).toBe(3)
  })

  it('drops empty sections', () => {
    const s = groupBoard(buildBoard(mods, NOW))
    expect(s.map((x) => x.group)).toEqual(['blocked', 'waiting', 'unpublished', 'approved'])
  })
})

describe('since last release', () => {
  it('uses the newest of latestRelease and the list, and puts neglected mods first', () => {
    const rows = sinceLastRelease(
      [mod('a', null, null, true, '2026-01-01T00:00:00.000Z'), mod('b', null, null, true, '2026-11-01T00:00:00.000Z'), mod('z', null, null, true), mod('m', null, null, false)],
      [rel('a', '2026-11-20T12:00:00.000Z', 'curseforge')],
      NOW,
    )
    expect(rows.map((r) => r.slug)).toEqual(['z', 'b', 'a'])
    expect(rows.find((r) => r.slug === 'a')).toMatchObject({ days: 1, freshness: 'fresh', platforms: ['curseforge'] })
    expect(rows.find((r) => r.slug === 'z')).toMatchObject({ days: null, freshness: 'none' })
  })

  it('marks stale mods', () => {
    const r = sinceLastRelease([mod('a', null, null, true, '2026-05-01T00:00:00.000Z')], [], NOW)[0]
    expect(r.freshness).toBe('stale')
  })
})

describe('timeline', () => {
  const items = [rel('a', '2026-11-20T10:00:00.000Z', 'curseforge', ['26.1']), rel('b', '2026-11-21T10:00:00.000Z'), rel('a', '2026-11-20T08:00:00.000Z', 'modrinth', ['1.21.11', '26.1'])]
  const all = { platform: 'all', type: 'all', mod: 'all', mc: 'all' } as const

  it('sorts newest first and groups by day', () => {
    const g = groupByDay(sortReleases(items))
    expect(g.map((d) => [d.day, d.items.length])).toEqual([['2026-11-21', 1], ['2026-11-20', 2]])
  })

  it('merges one release published as several files', () => {
    const a = rel('a', '2026-11-20T10:00:00.000Z', 'modrinth', ['26.3'])
    const b = { ...rel('a', '2026-11-20T10:00:20.000Z', 'modrinth', ['26.2']), downloads: a.downloads + 5 }
    const m = mergeReleases([a, b, rel('a', '2026-11-20T10:00:00.000Z', 'curseforge', ['26.3'])])
    expect(m).toHaveLength(2)
    expect(m[0].minecraftVersions).toEqual(['26.3', '26.2'])
    expect(m[0].downloads).toBe(b.downloads)
  })

  it('filters by platform, mod and Minecraft version', () => {
    expect(filterReleases(items, { ...all, platform: 'curseforge' }, null)).toHaveLength(1)
    expect(filterReleases(items, { ...all, mod: 'a' }, null)).toHaveLength(2)
    expect(filterReleases(items, { ...all, mc: '1.21.11' }, null)).toHaveLength(1)
  })

  it('drops releases of member mods when given an owned set, keeps unlinked ones', () => {
    const withNull = [...items, rel(null, '2026-11-19T00:00:00.000Z')]
    expect(filterReleases(withNull, all, new Set(['a']))).toHaveLength(3)
  })

  it('lists Minecraft versions newest first by version number', () => {
    expect(minecraftOptions(items)).toEqual(['26.1', '1.21.11', '1.21.1'])
  })
})

describe('url state', () => {
  it('round trips and omits defaults', () => {
    const s = parseState(new URLSearchParams('platform=modrinth&approved=1&q=ae2&type=beta&mc=26.1'))
    expect(s).toMatchObject({ platform: 'modrinth', approved: true, q: 'ae2', type: 'beta', mc: '26.1', members: false })
    expect(serializeState(s).toString()).toBe('platform=modrinth&q=ae2&approved=1&type=beta&mc=26.1')
    expect(serializeState(parseState(new URLSearchParams())).toString()).toBe('')
  })

  it('ignores junk values', () => {
    expect(parseState(new URLSearchParams('platform=x&type=y'))).toMatchObject({ platform: 'all', type: 'all' })
  })
})

describe('dayLabel', () => {
  it('keeps the calendar day of the key without a UTC shift', () => {
    expect(dayLabel('2026-11-20')).toContain('20')
    expect(dayLabel('2026-11-20')).toContain('Nov')
  })
})
