// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import { GRAPHIC_CONTRAST, TEXT_CONTRAST, THEMES, tokens } from './build.ts'
import { contrast, mix, parse, readable } from './color.ts'
import { DEFAULT_THEME, PALETTES } from './palettes.ts'

describe('colour maths', () => {
  it('measures contrast the way WCAG does', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })

  it('leaves a readable colour alone and nudges an unreadable one toward legible', () => {
    expect(readable('#ffffff', ['#000000'], 4.5)).toBe('#ffffff')
    const nudged = readable('#777777', ['#808080'], 4.5)
    expect(contrast(nudged, '#808080')).toBeGreaterThanOrEqual(4.5)
  })

  it('mixes and parses hex', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(parse('#abc')).toEqual([170, 187, 204])
  })
})

describe('every theme', () => {
  const others = PALETTES.filter((p) => p.id !== DEFAULT_THEME)

  it.each(others.map((p) => [p.name, p] as const))('%s reads: text and marks clear the contrast floors', (_n, p) => {
    const t = tokens(p)
    const surfaces = ['--color-ground', '--color-surface', '--color-sunk', '--color-raised'].map((k) => t[k])
    const need = (fg: string, bgs: string[], min: number, what: string) => {
      for (const bg of bgs) expect(contrast(fg, bg), `${p.name}: ${what} on ${bg}`).toBeGreaterThanOrEqual(min - 0.01)
    }
    for (const k of ['ink', 'muted', 'faint']) need(t[`--color-${k}`], surfaces, TEXT_CONTRAST, k)
    need(t['--color-accent'], [...surfaces, t['--color-accent-soft']], TEXT_CONTRAST, 'accent')
    need(t['--color-accent-ink'], [t['--color-accent']], TEXT_CONTRAST, 'text on the accent')
    for (const k of ['cf', 'mr', 'ok', 'review', 'bad', 'info', 'neutral', 'inactive']) {
      need(t[`--color-${k}`], [...surfaces, t[`--color-${k}-soft`]], TEXT_CONTRAST, k)
    }
    need(t['--color-line-strong'], [t['--color-surface']], GRAPHIC_CONTRAST, 'control border')
    for (let i = 1; i <= 8; i++) need(t[`--color-s${i}`], [t['--color-ground'], t['--color-surface']], GRAPHIC_CONTRAST, `series ${i}`)
  })

  it('has a unique id, a name and a scheme', () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length)
    expect(THEMES.map((x) => x.scheme).every((s) => s === 'dark' || s === 'light')).toBe(true)
    expect(THEMES.some((x) => x.scheme === 'light')).toBe(true)
    expect(PALETTES.some((p) => p.id === DEFAULT_THEME)).toBe(true)
  })
})
