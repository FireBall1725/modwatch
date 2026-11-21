// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import type { ModSummary, PlatformInfo, ReviewStatus } from '../../lib/types'
import {
  DEFAULT_QUERY,
  releaseVersion,
  activeFilterCount,
  filterBase,
  filterMods,
  healthCounts,
  minecraftOptions,
  parseQuery,
  reviewNote,
  serializeQuery,
  sortMods,
  summarize,
  topAttention,
  versionPreview,
} from './logic'

function plat(platform: 'curseforge' | 'modrinth', status: ReviewStatus, extra: Partial<PlatformInfo> = {}): PlatformInfo {
  return {
    platform, id: '1', slug: 's', url: '', status, rawStatus: status, statusMessage: null, requestedStatus: null, queuedAt: null,
    downloads: 0, delta24h: null, delta7d: null, followers: null, publishedAt: null, updatedAt: null, files: 1, ...extra,
  }
}

function mod(slug: string, o: Partial<ModSummary> = {}): ModSummary {
  return {
    slug, name: slug, iconUrl: '', summary: '', owned: true, legacy: false,
    curseforge: plat('curseforge', 'approved'), modrinth: plat('modrinth', 'approved'), github: null,
    downloads: { total: 100, curseforge: 60, modrinth: 40, delta24h: null, delta7d: 5 },
    latestRelease: null, minecraftVersions: ['1.21.1'], loaders: [], health: 'ok', attention: [], ...o,
  }
}

const github = (bugs: number, crashes: number, open = bugs + crashes) => ({ label: 'x', open, openBugs: bugs, openCrashes: crashes, oldestOpenBugAt: null })

const mods: ModSummary[] = [
  mod('alpha', { name: 'Alpha', health: 'problem', github: github(0, 1), downloads: { total: 50, curseforge: 50, modrinth: 0, delta24h: null, delta7d: null }, modrinth: null, minecraftVersions: ['26.1', '1.21.11'] }),
  mod('bravo', { name: 'Bravo', health: 'attention', github: github(2, 0), modrinth: plat('modrinth', 'in_review', { queuedAt: '2026-11-01T00:00:00Z' }), downloads: { total: 900, curseforge: 500, modrinth: 400, delta24h: 1, delta7d: 20 } }),
  mod('charlie', { name: 'Charlie', downloads: { total: 5000, curseforge: 1000, modrinth: 4000, delta24h: 1, delta7d: 10 }, summary: 'Makes toast', minecraftVersions: ['1.21.1', '1.20.1'] }),
  mod('member', { name: 'Member Mod', owned: false, downloads: { total: 9_000_000, curseforge: 9_000_000, modrinth: 0, delta24h: null, delta7d: null }, modrinth: null }),
]

describe('query parsing', () => {
  it('gives the defaults for an empty query string', () => {
    expect(parseQuery(new URLSearchParams())).toEqual(DEFAULT_QUERY)
  })

  it('ignores unknown values instead of trusting the URL', () => {
    const q = parseQuery(new URLSearchParams('health=bogus&sort=nope&dir=sideways&platform=x'))
    expect(q.health).toBe('all')
    expect(q.sort).toBe('health')
    expect(q.dir).toBe('desc')
    expect(q.platform).toBe('any')
  })

  it('round trips and leaves defaults out of the URL', () => {
    expect(serializeQuery(DEFAULT_QUERY).toString()).toBe('')
    const q = { ...DEFAULT_QUERY, q: 'ae2', health: 'problem' as const, members: true, sort: 'name' as const, dir: 'desc' as const, mc: '26.1' }
    const back = parseQuery(serializeQuery(q))
    expect(back).toEqual(q)
  })

  it('does not write dir when it is the natural direction for the column', () => {
    expect(serializeQuery({ ...DEFAULT_QUERY, sort: 'name', dir: 'asc' }).toString()).toBe('sort=name')
    expect(serializeQuery({ ...DEFAULT_QUERY, sort: 'downloads', dir: 'asc' }).toString()).toBe('sort=downloads&dir=asc')
  })

  it('counts filters but not sort or members', () => {
    expect(activeFilterCount(DEFAULT_QUERY)).toBe(0)
    expect(activeFilterCount({ ...DEFAULT_QUERY, q: ' ', members: true, sort: 'name' })).toBe(0)
    expect(activeFilterCount({ ...DEFAULT_QUERY, q: 'a', health: 'ok', issues: true })).toBe(3)
  })
})

describe('filtering', () => {
  it('hides member mods unless asked', () => {
    expect(filterMods(mods, DEFAULT_QUERY).map((m) => m.slug)).not.toContain('member')
    expect(filterMods(mods, { ...DEFAULT_QUERY, members: true }).map((m) => m.slug)).toContain('member')
  })

  it('searches name, slug and summary without case', () => {
    expect(filterMods(mods, { ...DEFAULT_QUERY, q: 'TOAST' }).map((m) => m.slug)).toEqual(['charlie'])
    expect(filterMods(mods, { ...DEFAULT_QUERY, q: 'brav' }).map((m) => m.slug)).toEqual(['bravo'])
  })

  it('filters by platform presence', () => {
    const slugs = (platform: ModsQueryPlatform) => filterMods(mods, { ...DEFAULT_QUERY, platform }).map((m) => m.slug)
    expect(slugs('both')).toEqual(['bravo', 'charlie'])
    expect(slugs('one')).toEqual(['alpha'])
    expect(slugs('modrinth')).toEqual(['bravo', 'charlie'])
    expect(slugs('curseforge')).toHaveLength(3)
  })

  it('filters by review state', () => {
    expect(filterMods(mods, { ...DEFAULT_QUERY, review: 'in_review' }).map((m) => m.slug)).toEqual(['bravo'])
    expect(filterMods(mods, { ...DEFAULT_QUERY, review: 'not_approved' }).map((m) => m.slug)).toEqual(['bravo'])
    expect(filterMods(mods, { ...DEFAULT_QUERY, review: 'approved' }).map((m) => m.slug)).toEqual(['alpha', 'charlie'])
  })

  it('filters by Minecraft version and open issues', () => {
    expect(filterMods(mods, { ...DEFAULT_QUERY, mc: '26.1' }).map((m) => m.slug)).toEqual(['alpha'])
    expect(filterMods(mods, { ...DEFAULT_QUERY, issues: true }).map((m) => m.slug)).toEqual(['alpha', 'bravo'])
  })

  it('hides legacy mods only when asked, and keeps that in the URL', () => {
    const list = [mod('old', { legacy: true }), mod('new')]
    expect(filterMods(list, DEFAULT_QUERY).map((m) => m.slug)).toEqual(['old', 'new'])
    expect(filterMods(list, { ...DEFAULT_QUERY, hideLegacy: true }).map((m) => m.slug)).toEqual(['new'])
    const q = { ...DEFAULT_QUERY, hideLegacy: true, members: true, sort: 'downloads' as const, dir: 'asc' as const, q: 'x' }
    expect(parseQuery(serializeQuery(q))).toEqual(q)
  })

  it('counts health over everything except the health filter itself', () => {
    const q = { ...DEFAULT_QUERY, health: 'problem' as const, platform: 'modrinth' as const }
    expect(healthCounts(filterBase(mods, q))).toEqual({ all: 2, problem: 0, attention: 1, ok: 1 })
    expect(filterMods(mods, q)).toEqual([])
  })
})

type ModsQueryPlatform = 'any' | 'curseforge' | 'modrinth' | 'both' | 'one'

describe('sorting', () => {
  const owned = mods.filter((m) => m.owned)

  it('puts the worst health first by default and breaks ties by size', () => {
    expect(sortMods(owned, 'health', 'desc').map((m) => m.slug)).toEqual(['alpha', 'bravo', 'charlie'])
    const tie = [mod('small'), mod('big', { downloads: { total: 999, curseforge: 0, modrinth: 0, delta24h: null, delta7d: null } })]
    expect(sortMods(tie, 'health', 'desc').map((m) => m.slug)).toEqual(['big', 'small'])
  })

  it('is stable: equal rows keep one order whatever the input order', () => {
    const a = mod('a', { name: 'Same' })
    const b = mod('b', { name: 'Same' })
    expect(sortMods([a, b], 'name', 'asc').map((m) => m.slug)).toEqual(['a', 'b'])
    expect(sortMods([b, a], 'name', 'asc').map((m) => m.slug)).toEqual(['a', 'b'])
  })

  it('sorts names with numbers in order', () => {
    const list = [mod('a10', { name: 'Mod 10' }), mod('a2', { name: 'Mod 2' })]
    expect(sortMods(list, 'name', 'asc').map((m) => m.name)).toEqual(['Mod 2', 'Mod 10'])
  })

  it('keeps unknown values last in both directions', () => {
    expect(sortMods(owned, 'delta7d', 'desc').map((m) => m.slug)).toEqual(['bravo', 'charlie', 'alpha'])
    expect(sortMods(owned, 'delta7d', 'asc').map((m) => m.slug)).toEqual(['charlie', 'bravo', 'alpha'])
    expect(sortMods(owned, 'modrinth', 'asc').at(-1)?.slug).toBe('alpha')
    expect(sortMods(owned, 'modrinth', 'desc').at(-1)?.slug).toBe('alpha')
  })

  it('ranks the worst review state first', () => {
    expect(sortMods(owned, 'modrinth', 'asc').map((m) => m.slug)).toEqual(['bravo', 'charlie', 'alpha'])
  })

  it('sorts issues with crashes above bugs and a missing repo last', () => {
    expect(sortMods(owned, 'issues', 'desc').map((m) => m.slug)).toEqual(['alpha', 'bravo', 'charlie'])
  })

  it('sorts by the newest Minecraft version by number, not text', () => {
    expect(sortMods(owned, 'minecraft', 'desc')[0].slug).toBe('alpha')
  })

  it('does not change the input', () => {
    const copy = [...owned]
    sortMods(owned, 'name', 'desc')
    expect(owned).toEqual(copy)
  })
})

describe('derived numbers', () => {
  it('sums downloads and issues, and keeps 7 day movement null when nothing has it', () => {
    const t = summarize(mods.filter((m) => m.owned))
    expect(t).toMatchObject({ mods: 3, downloads: 5950, curseforge: 1550, modrinth: 4400, delta7d: 30, openBugs: 2, openCrashes: 1 })
    expect(summarize([mods[0]]).delta7d).toBeNull()
    expect(summarize([]).downloads).toBe(0)
  })

  it('lists Minecraft versions newest first', () => {
    expect(minecraftOptions(mods)).toEqual(['26.1', '1.21.11', '1.21.1', '1.20.1'])
  })

  it('previews versions and counts the rest', () => {
    expect(versionPreview(['1.20.1', '26.1', '1.21.11', '1.21.1'], 2)).toEqual({ shown: ['26.1', '1.21.11'], more: 2 })
    expect(versionPreview([], 3)).toEqual({ shown: [], more: 0 })
  })

  it('picks the worst attention item', () => {
    const m = mod('x', {
      attention: [
        { severity: 'info', kind: 'unlinked', modSlug: 'x', title: 'i', detail: '', url: null, dismissible: false },
        { severity: 'problem', kind: 'crash_open', modSlug: 'x', title: 'p', detail: '', url: null, dismissible: false },
      ],
    })
    expect(topAttention(m)?.title).toBe('p')
    expect(topAttention(mod('y'))).toBeNull()
  })

  it('explains a platform that is not approved', () => {
    expect(reviewNote(plat('modrinth', 'approved'))).toBeNull()
    expect(reviewNote(null)).toBeNull()
    expect(reviewNote(plat('modrinth', 'in_review', { queuedAt: 'T' }))).toEqual({ kind: 'queued', text: 'T' })
    expect(reviewNote(plat('curseforge', 'rejected', { statusMessage: 'No licence' }))).toEqual({ kind: 'message', text: 'No licence' })
    expect(reviewNote(plat('curseforge', 'draft'))).toBeNull()
  })
})

describe('releaseVersion', () => {
  it('reduces file names to the version', () => {
    expect(releaseVersion('DefaultWorldGenerator-1.7.10-0.1-b13-universal.jar')).toBe('1.7.10-0.1-b13')
    expect(releaseVersion('-1.11-b2-universal.jar')).toBe('1.11-b2')
    expect(releaseVersion('AE2TechAddOn-1.7.10-1.0-b81-universal.jar')).toBe('1.7.10-1.0-b81')
    expect(releaseVersion('26.11.0-rc.2')).toBe('26.11.0-rc.2')
    expect(releaseVersion('3 26.10.0 (neoforge 26.2)')).toBe('3 26.10.0 (neoforge 26.2)')
  })
})
