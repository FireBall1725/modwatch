// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import type { SettingItem } from '../../lib/types'
import { GROUPS, canSave, clearAction, draftError, initialDraft, isSwitch, metricsOn, updateFor } from './connections'

const item = (over: Partial<SettingItem>): SettingItem => ({
  key: 'modrinthUser',
  secret: false,
  value: null,
  set: false,
  source: 'none',
  envSet: false,
  ...over,
})

describe('GROUPS', () => {
  it('lists every setting once', () => {
    const keys = GROUPS.flatMap((g) => g.keys)
    expect(keys).toHaveLength(8)
    expect(new Set(keys).size).toBe(8)
  })
})

describe('draftError', () => {
  it('wants a positive number for the author id', () => {
    expect(draftError('curseforgeAuthorId', '8109937')).toBeNull()
    expect(draftError('curseforgeAuthorId', '0')).toBe('digits')
    expect(draftError('curseforgeAuthorId', 'abc')).toBe('digits')
  })

  it('wants owner/name for a repository', () => {
    expect(draftError('githubIssuesRepo', 'FireBall1725/mod-issues')).toBeNull()
    expect(draftError('githubIssuesRepo', 'mod-issues')).toBe('repo')
    expect(draftError('githubIssuesRepo', 'a/b/c')).toBe('repo')
  })

  it('rejects whitespace inside a key or a name, and lets an empty draft through', () => {
    expect(draftError('curseforgeApiKey', 'abc def')).toBe('spaces')
    expect(draftError('modrinthToken', '  abc  ')).toBeNull()
    expect(draftError('modrinthToken', '   ')).toBeNull()
  })
})

describe('canSave', () => {
  it('needs a value for a secret, and any valid value counts as new', () => {
    const s = item({ key: 'githubToken', secret: true, set: true, source: 'ui' })
    expect(canSave(s, '')).toBe(false)
    expect(canSave(s, 'ghp_x')).toBe(true)
  })

  it('needs a plain field to differ from what it shows', () => {
    const s = item({ key: 'modrinthUser', value: 'FireBall1725', set: true, source: 'env', envSet: true })
    expect(canSave(s, 'FireBall1725')).toBe(false)
    expect(canSave(s, ' FireBall1725 ')).toBe(false)
    expect(canSave(s, 'someone')).toBe(true)
  })

  it('refuses an invalid value', () => {
    expect(canSave(item({ key: 'githubIssuesRepo' }), 'nope')).toBe(false)
  })
})

describe('clearAction', () => {
  it('only offers it for a value set here', () => {
    expect(clearAction(item({ source: 'env', envSet: true }))).toBeNull()
    expect(clearAction(item({ source: 'none' }))).toBeNull()
  })

  it('falls back to the environment when there is one, else clears', () => {
    expect(clearAction(item({ source: 'ui', envSet: true }))).toBe('env')
    expect(clearAction(item({ source: 'ui', envSet: false }))).toBe('clear')
  })
})

describe('metrics switch', () => {
  const m = (over: Partial<SettingItem>) => item({ key: 'metricsEnabled', ...over })

  it('is on unless it was set to false, so not chosen counts as on', () => {
    expect(metricsOn(m({ value: null, source: 'none' }))).toBe(true)
    expect(metricsOn(m({ value: 'true', source: 'ui', set: true }))).toBe(true)
    expect(metricsOn(m({ value: 'false', source: 'env', set: true, envSet: true }))).toBe(false)
  })

  it('is the only setting shown as a switch', () => {
    expect(isSwitch('metricsEnabled')).toBe(true)
    expect(isSwitch('modrinthUser')).toBe(false)
  })

  it('sends the strings true and false', () => {
    expect(updateFor('metricsEnabled', 'false')).toEqual({ metricsEnabled: 'false' })
  })
})

describe('updateFor and initialDraft', () => {
  it('sends a trimmed value, or null to clear', () => {
    expect(updateFor('modrinthUser', ' me ')).toEqual({ modrinthUser: 'me' })
    expect(updateFor('modrinthUser', null)).toEqual({ modrinthUser: null })
  })

  it('never starts a secret with a value', () => {
    expect(initialDraft(item({ secret: true, value: 'leak' }))).toBe('')
    expect(initialDraft(item({ value: 'me' }))).toBe('me')
    expect(initialDraft(item({ value: null }))).toBe('')
  })
})
