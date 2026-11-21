// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Colour maths for building themes: mixing, WCAG contrast, and nudging a colour until it is readable.

type Rgb = [number, number, number]

export function parse(hex: string): Rgb {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

export function toHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

/** a mixed toward b: t=0 is a, t=1 is b. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [parse(a), parse(b)]
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** Whether a colour is light enough that dark text belongs on it. */
export function isLight(hex: string): boolean {
  return luminance(hex) > 0.4
}

/**
 * The colour itself when it already reads at `min` against every background, else the nearest mix toward white or
 * black (whichever helps) that does. The hue is kept, only the lightness moves.
 */
export function readable(fg: string, bgs: string[], min: number): string {
  const worst = (c: string) => Math.min(...bgs.map((b) => contrast(c, b)))
  if (worst(fg) >= min) return fg
  const towards = [ '#ffffff', '#000000' ].sort((p, q) => worst(mix(fg, q, 0.3)) - worst(mix(fg, p, 0.3)))[0]
  for (let t = 0.03; t <= 1.0001; t += 0.03) {
    const c = mix(fg, towards, t)
    if (worst(c) >= min) return c
  }
  return towards
}

/** "r g b / alpha" for use inside rgb(), so a token can carry transparency. */
export function rgbAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}
