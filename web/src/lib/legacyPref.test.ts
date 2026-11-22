// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { afterEach, describe, expect, it } from 'vitest'
import { getShowLegacy, setShowLegacy, withLegacy } from './legacyPref'

afterEach(() => setShowLegacy(false))

describe('withLegacy', () => {
  it('leaves the path alone while legacy mods are hidden', () => {
    expect(withLegacy('/api/v1/mods')).toBe('/api/v1/mods')
  })

  it('adds the parameter with ? or &', () => {
    setShowLegacy(true)
    expect(withLegacy('/api/v1/mods')).toBe('/api/v1/mods?legacy=1')
    expect(withLegacy('/api/v1/releases?limit=50')).toBe('/api/v1/releases?limit=50&legacy=1')
  })
})

describe('setShowLegacy', () => {
  it('remembers the choice in localStorage', () => {
    setShowLegacy(true)
    expect(getShowLegacy()).toBe(true)
    expect(localStorage.getItem('modwatch.showLegacy')).toBe('1')
    setShowLegacy(false)
    expect(localStorage.getItem('modwatch.showLegacy')).toBe('0')
  })
})
