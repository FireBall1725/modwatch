// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import { ApiError } from '../lib/api'
import * as mock from './mockApi'

describe('mock dismissals', () => {
  it('moves an item out of every list, recomputes health and the total, and restores it', async () => {
    const before = await mock.overview()
    const item = before.attention.find((i) => i.dismissible && i.kind === 'no_latest_minecraft')!
    expect(item).toBeTruthy()
    const ref = { kind: item.kind, modSlug: item.modSlug! }

    await mock.attentionDismiss(ref)
    const after = await mock.overview()
    expect(after.attention.some((i) => i.kind === ref.kind && i.modSlug === ref.modSlug)).toBe(false)
    expect(after.dismissed.map((i) => i.title)).toContain(item.title)
    const mod = after.mods.find((m) => m.slug === ref.modSlug)!
    expect(mod.attention.some((i) => i.kind === ref.kind)).toBe(false)
    expect(after.totals.needAttention).toBeLessThanOrEqual(before.totals.needAttention)
    expect((await mock.mod(ref.modSlug)).attention.some((i) => i.kind === ref.kind)).toBe(false)

    await mock.attentionRestore(ref)
    const back = await mock.overview()
    expect(back.dismissed).toEqual([])
    expect(back.attention.some((i) => i.kind === ref.kind && i.modSlug === ref.modSlug)).toBe(true)
    expect(back.totals.needAttention).toBe(before.totals.needAttention)
  })

  it('refuses to dismiss a crash', async () => {
    const crash = (await mock.overview()).attention.find((i) => i.kind === 'crash_open')!
    await expect(mock.attentionDismiss({ kind: 'crash_open', modSlug: crash.modSlug! })).rejects.toMatchObject({ status: 400 })
  })
})

describe('mock settings', () => {
  const find = async (key: string) => (await mock.settings()).items.find((i) => i.key === key)!

  it('never returns a secret, and says where each value comes from', async () => {
    const key = await find('curseforgeApiKey')
    expect(key).toMatchObject({ secret: true, value: null, set: true, source: 'env', envSet: true })
    expect(await find('githubToken')).toMatchObject({ set: false, source: 'none' })
  })

  it('lets a value set here win, and falls back to the environment when it is cleared', async () => {
    await mock.settingsPut({ modrinthUser: 'someone' })
    expect(await find('modrinthUser')).toMatchObject({ value: 'someone', source: 'ui', envSet: true })
    await mock.settingsPut({ modrinthUser: null })
    expect(await find('modrinthUser')).toMatchObject({ value: 'FireBall1725', source: 'env' })
  })

  it('keeps a secret out of the answer after it is set', async () => {
    await mock.settingsPut({ githubToken: 'ghp_secret' })
    const t = await find('githubToken')
    expect(t).toMatchObject({ set: true, value: null, source: 'ui', envSet: false })
    await mock.settingsPut({ githubToken: '' })
    expect(await find('githubToken')).toMatchObject({ set: false, source: 'none' })
  })

  it('rejects a bad author id, repository and metrics value with a 400', async () => {
    for (const bad of [{ curseforgeAuthorId: 'abc' }, { githubIssuesRepo: 'nope' }, { metricsEnabled: 'maybe' }]) {
      const err = await mock.settingsPut(bad).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(400)
    }
  })

  it('treats metricsEnabled as not chosen until it is set', async () => {
    expect(await find('metricsEnabled')).toMatchObject({ value: null, source: 'none' })
    await mock.settingsPut({ metricsEnabled: 'false' })
    expect(await find('metricsEnabled')).toMatchObject({ value: 'false', source: 'ui' })
    await mock.settingsPut({ metricsEnabled: null })
  })
})
