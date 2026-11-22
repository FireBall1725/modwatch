// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { isLight, mix, readable, rgbAlpha } from './color.ts'
import { DEFAULT_THEME, PALETTES, type Palette } from './palettes.ts'

/** Text must clear this against every surface it can sit on (WCAG AA). */
export const TEXT_CONTRAST = 4.5
/** Borders, bars and chart marks must clear this against the surface (WCAG 1.4.11). */
export const GRAPHIC_CONTRAST = 3

// The platforms keep their own colours in every theme, nudged only as far as the surface needs to read them.
const CURSEFORGE = '#f16436'
const MODRINTH = '#1bd96a'

/** How strongly a tint shows behind its text: the status and platform chips. */
const TINT = 0.16

const DARK_SHADOWS = {
  e1: '0 1px 0 rgb(255 255 255 / 0.03) inset, 0 1px 2px rgb(0 0 0 / 0.4)',
  e2: '0 1px 0 rgb(255 255 255 / 0.04) inset, 0 4px 14px rgb(0 0 0 / 0.45)',
  e3: '0 10px 30px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(255 255 255 / 0.05)',
  e4: '0 24px 60px rgb(0 0 0 / 0.65), 0 0 0 1px rgb(255 255 255 / 0.06)',
}
const LIGHT_SHADOWS = {
  e1: '0 1px 2px rgb(31 35 40 / 0.1)',
  e2: '0 1px 0 rgb(255 255 255 / 0.7) inset, 0 4px 14px rgb(31 35 40 / 0.1)',
  e3: '0 10px 30px rgb(31 35 40 / 0.16), 0 0 0 1px rgb(31 35 40 / 0.06)',
  e4: '0 24px 60px rgb(31 35 40 / 0.22), 0 0 0 1px rgb(31 35 40 / 0.08)',
}

/** Every design token a theme sets, as CSS custom properties. */
export function tokens(p: Palette): Record<string, string> {
  const dark = p.scheme === 'dark'
  const surfaces = [p.ground, p.surface, p.sunk, p.raised]
  const t: Record<string, string> = {}

  t['--color-ground'] = p.ground
  t['--color-surface'] = p.surface
  t['--color-sunk'] = p.sunk
  t['--color-raised'] = p.raised
  t['--color-line'] = p.line

  const ink = readable(p.ink, surfaces, TEXT_CONTRAST)
  const muted = readable(p.muted, surfaces, TEXT_CONTRAST)
  // Fainter than muted, but still text, so it stops at the contrast floor rather than below it.
  const faint = readable(mix(muted, p.surface, 0.3), surfaces, TEXT_CONTRAST)
  t['--color-ink'] = ink
  t['--color-muted'] = muted
  t['--color-faint'] = faint
  t['--color-line-strong'] = readable(mix(p.line, ink, 0.5), [p.surface], GRAPHIC_CONTRAST)

  // The accent is read as text on every surface and on its own tint, and a button fills with it.
  let accent = readable(p.accent, surfaces, TEXT_CONTRAST)
  let accentSoft = mix(accent, p.ground, dark ? 0.8 : 0.86)
  accent = readable(accent, [...surfaces, accentSoft], TEXT_CONTRAST)
  accentSoft = mix(accent, p.ground, dark ? 0.8 : 0.86)
  const onAccent = [p.ground, '#000000', '#ffffff'].find((c) => readable(c, [accent], TEXT_CONTRAST) === c) ?? (isLight(accent) ? '#000000' : '#ffffff')
  t['--color-accent'] = accent
  t['--color-accent-hover'] = mix(accent, dark ? '#ffffff' : '#000000', 0.15)
  t['--color-accent-ink'] = onAccent
  t['--color-accent-soft'] = accentSoft

  // A coloured word on its own tint: the colour is nudged until it reads on the tint and on every surface.
  const chip = (name: string, hue: string) => {
    // The tint comes from the text colour and the text colour has to read on the tint, so settle the two together.
    let text = hue
    let soft = mix(text, p.ground, 1 - TINT)
    for (let i = 0; i < 6; i++) {
      const next = readable(text, [...surfaces, soft], TEXT_CONTRAST)
      const nextSoft = mix(next, p.ground, 1 - TINT)
      if (next === text && nextSoft === soft) break
      text = next
      soft = nextSoft
    }
    t[`--color-${name}`] = text
    t[`--color-${name}-soft`] = soft
    return text
  }
  chip('cf', CURSEFORGE)
  chip('mr', MODRINTH)
  const ok = chip('ok', p.green)
  const review = chip('review', p.yellow)
  const bad = chip('bad', p.red)
  chip('info', p.blue)
  chip('neutral', mix(muted, ink, 0.2))
  chip('inactive', faint)

  t['--color-up'] = ok
  t['--color-down'] = bad
  t['--color-warn'] = review
  t['--color-warn-bg'] = t['--color-review-soft']

  // Chart series for things that aren't a platform. Marks need 3:1 against the surface they sit on.
  const series = [accent, p.blue, p.yellow, p.cyan, p.purple, p.orange, p.green, p.pink]
  series.forEach((c, i) => {
    t[`--color-s${i + 1}`] = readable(c, [p.ground, p.surface], GRAPHIC_CONTRAST)
  })

  const shadows = dark ? DARK_SHADOWS : LIGHT_SHADOWS
  t['--shadow-e1'] = shadows.e1
  t['--shadow-e2'] = shadows.e2
  t['--shadow-e3'] = shadows.e3
  t['--shadow-e4'] = shadows.e4
  t['--glow'] = rgbAlpha(accent, dark ? 0.07 : 0.1)
  return t
}

/** The override block for every theme except the default, whose values are the base ones in index.css. */
export function themeCss(): string {
  const blocks = PALETTES.filter((p) => p.id !== DEFAULT_THEME).map((p) => {
    const lines = Object.entries(tokens(p)).map(([k, v]) => `  ${k}: ${v};`)
    return `:root[data-theme='${p.id}'] {\n  color-scheme: ${p.scheme};\n${lines.join('\n')}\n}`
  })
  return `/* SPDX-License-Identifier: AGPL-3.0-only */\n/* Copyright (C) 2026 FireBall1725 */\n\n/* Generated by \`npm run themes\` from palettes.ts. Do not edit by hand. */\n\n${blocks.join('\n\n')}\n`
}

export interface ThemeInfo {
  id: string
  name: string
  scheme: 'dark' | 'light'
  /** Page, card, text, accent and two series colours, for the picker's preview. */
  swatch: string[]
}

export const THEMES: ThemeInfo[] = PALETTES.map((p) => {
  const t = p.id === DEFAULT_THEME ? undefined : tokens(p)
  return {
    id: p.id,
    name: p.name,
    scheme: p.scheme,
    swatch: [p.ground, p.surface, p.ink, t?.['--color-accent'] ?? p.accent, p.blue, p.green],
  }
})

export { DEFAULT_THEME }
