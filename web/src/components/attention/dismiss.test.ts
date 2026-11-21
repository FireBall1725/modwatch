// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import type { AttentionItem } from '../../lib/types'
import { dismissKey, dismissRef } from './dismiss'

const item = (over: Partial<AttentionItem>): AttentionItem => ({
  severity: 'warning',
  kind: 'no_latest_minecraft',
  modSlug: 'create-turbolifts',
  title: 't',
  detail: '',
  url: null,
  dismissible: true,
  ...over,
})

describe('dismissRef', () => {
  it('gives the kind and the mod for a dismissible item', () => {
    expect(dismissRef(item({}))).toEqual({ kind: 'no_latest_minecraft', modSlug: 'create-turbolifts' })
  })

  it('gives nothing for an item the server won\'t dismiss', () => {
    expect(dismissRef(item({ kind: 'crash_open', dismissible: false }))).toBeNull()
  })

  it('gives nothing without a mod to key it on', () => {
    expect(dismissRef(item({ modSlug: null }))).toBeNull()
  })
})

describe('dismissKey', () => {
  it('is the same for two items of one kind on one mod, so one dismissal covers both', () => {
    const a = item({ kind: 'not_approved', title: 'rejected on CurseForge' })
    const b = item({ kind: 'not_approved', title: 'draft on Modrinth' })
    expect(dismissKey(a)).toBe(dismissKey(b))
    expect(dismissKey(a)).not.toBe(dismissKey(item({ kind: 'missing_platform' })))
  })
})
