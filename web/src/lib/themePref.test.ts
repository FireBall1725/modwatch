// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '../themes/build'
import { getTheme, setTheme } from './themePref'

afterEach(() => setTheme(DEFAULT_THEME))

describe('colour theme', () => {
  it('starts on the default and has no override attribute for it', () => {
    expect(getTheme()).toBe(DEFAULT_THEME)
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('applies a theme to the page and remembers it in this browser', () => {
    setTheme('dracula')
    expect(getTheme()).toBe('dracula')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dracula')
    expect(localStorage.getItem('modwatch.theme')).toBe('dracula')
    setTheme(DEFAULT_THEME)
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('ignores a theme it does not have', () => {
    setTheme('not-a-theme')
    expect(getTheme()).toBe(DEFAULT_THEME)
  })
})
