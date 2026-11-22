// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { afterEach, describe, expect, it } from 'vitest'
import { maskMoney } from './format'
import { getHideMoney, setHideMoney } from './privacyPref'

afterEach(() => setHideMoney(false))

describe('hide amounts', () => {
  it('is off until chosen, and remembers the choice in this browser', () => {
    expect(getHideMoney()).toBe(false)
    setHideMoney(true)
    expect(getHideMoney()).toBe(true)
    expect(localStorage.getItem('modwatch.hideMoney')).toBe('1')
    setHideMoney(false)
    expect(localStorage.getItem('modwatch.hideMoney')).toBe('0')
  })
})

describe('maskMoney', () => {
  it('keeps the currency and the shape and drops every digit', () => {
    const masked = maskMoney('USD')
    expect(masked).toMatch(/\$/)
    expect(masked).toMatch(/•\.••/)
    expect(masked).not.toMatch(/\d/)
  })
})
