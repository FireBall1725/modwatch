// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import catalog from './fixtures/catalog.json'
import history from './fixtures/downloads-history.json'
import issues from './fixtures/issues.json'
import modDetail from './fixtures/mod-detail.json'
import mods from './fixtures/mods.json'
import overview from './fixtures/overview.json'
import releases from './fixtures/releases.json'
import versions from './fixtures/versions.json'
import { compareMinecraft } from '../lib/minecraft'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

const MOD_KEYS = ['slug', 'name', 'iconUrl', 'summary', 'owned', 'curseforge', 'modrinth', 'github', 'downloads', 'latestRelease', 'minecraftVersions', 'loaders', 'health', 'attention']
const PLATFORM_KEYS = ['platform', 'id', 'slug', 'url', 'status', 'rawStatus', 'statusMessage', 'requestedStatus', 'queuedAt', 'downloads', 'delta24h', 'delta7d', 'followers', 'publishedAt', 'updatedAt', 'files']

/** Every value in the tree that is an array must be one; null where a list belongs is the bug that crashes .length. */
function walk(value: unknown, visit: (key: string, v: unknown) => void) {
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      visit(k, v)
      walk(v, visit)
    }
}

describe('fixtures follow the API contract', () => {
  it('has the ModSummary keys on every mod, and the PlatformInfo keys on every platform', () => {
    for (const m of mods) {
      expect(Object.keys(m).sort()).toEqual([...MOD_KEYS].sort())
      for (const p of [m.curseforge, m.modrinth]) if (p) expect(Object.keys(p).sort()).toEqual([...PLATFORM_KEYS].sort())
    }
  })

  it('never has null where a list belongs', () => {
    const listKeys = ['attention', 'recentReleases', 'sources', 'problems', 'gameVersions', 'minecraftVersions', 'loaders', 'entries', 'labels']
    for (const tree of [overview, mods, modDetail, versions, issues, catalog]) walk(tree, (k, v) => listKeys.includes(k) && expect(Array.isArray(v), k).toBe(true))
  })

  it('gives every mod detail its lists', () => {
    for (const d of Object.values(modDetail) as unknown as { files: unknown; issues: unknown; history: unknown }[]) {
      expect(Array.isArray(d.files)).toBe(true)
      expect(Array.isArray(d.issues)).toBe(true)
      expect(Array.isArray(d.history)).toBe(true)
    }
  })

  it('uses RFC 3339 UTC strings for every time', () => {
    for (const tree of [overview, releases, issues]) walk(tree, (k, v) => /At$/.test(k) && typeof v === 'string' && expect(v).toMatch(ISO))
  })

  it('has 90 days of history and a point per mod from its first day', () => {
    expect(history.days).toBe(90)
    expect(history.total).toHaveLength(90)
    expect(Object.keys(history.perMod)).toHaveLength(14)
  })

  it('covers the awkward cases', () => {
    const by = Object.fromEntries(mods.map((m) => [m.slug, m]))
    expect(by['ae2-lights'].modrinth?.status).toBe('in_review')
    expect(by['ae2-lights'].modrinth?.statusMessage ?? 'x').toBeDefined()
    expect(by['qmk-extra-keybinds'].modrinth?.status).toBe('draft')
    expect(by['ae2-ee3-emc-addon'].curseforge?.status).toBe('changes_required')
    expect(by['ae2-ee3-emc-addon'].curseforge?.statusMessage).toBeTruthy()
    expect(by['devworld'].curseforge?.status).toBe('rejected')
    expect(by['lost-crafters-server-switcher'].curseforge).toBeNull()
    expect(by['devworld'].downloads.delta24h).toBeNull()
    expect(by['ae2-ee3-emc-addon'].downloads.total).toBe(0)
    expect(by['applied-energistics-2'].owned).toBe(false)
    expect(by['default-world-generator'].curseforge?.downloads).toBe(1115528)
    expect(catalog.unlinked.projects.length).toBeGreaterThan(0)
    expect(catalog.unlinked.githubLabels.length).toBeGreaterThan(0)
    expect(overview.totals.openCrashes).toBe(1)
    expect(overview.totals.openBugs).toBe(2)
    expect(issues.issues.some((i) => i.kind === 'crash' && i.modSlug === 'create-turbolifts' && i.state === 'open')).toBe(true)
    expect(issues.issues.some((i) => i.modSlug === null && i.modLabel)).toBe(true)
  })

  it('lists Minecraft versions from 1.7.10 to 26.3, newest first', () => {
    const names = versions.gameVersions.map((g) => g.name)
    expect(names[0]).toBe('26.3')
    expect(names.at(-1)).toBe('1.7.10')
    for (let i = 1; i < names.length; i++) expect(compareMinecraft(names[i - 1], names[i])).toBeGreaterThan(0)
    expect(versions.latestMinecraft).toBe('26.3')
  })

  it('keeps file downloads equal to the platform totals', () => {
    for (const m of mods) {
      const d = (modDetail as unknown as Record<string, { files: { platform: string; downloads: number }[] }>)[m.slug]
      for (const p of ['curseforge', 'modrinth'] as const) {
        const sum = d.files.filter((f) => f.platform === p).reduce((a, f) => a + f.downloads, 0)
        expect(sum).toBe(m[p]?.downloads ?? 0)
      }
    }
  })
})
