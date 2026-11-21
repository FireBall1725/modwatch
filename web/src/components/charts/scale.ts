// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Scale and tick math shared by every chart. Pure functions, no DOM.

export interface LinearScale {
  (v: number): number
  /** Pixel back to value. */
  invert: (px: number) => number
}

/** Maps a domain onto a range. A zero-width domain maps everything to the range's start. */
export function linearScale(d0: number, d1: number, r0: number, r1: number): LinearScale {
  const span = d1 - d0
  const f = ((v: number) => (span === 0 ? r0 : r0 + ((v - d0) / span) * (r1 - r0))) as LinearScale
  f.invert = (px: number) => (r1 === r0 ? d0 : d0 + ((px - r0) / (r1 - r0)) * span)
  return f
}

/** Rounds up to 1, 2, 2.5, 5 or 10 times a power of ten, so axis steps read cleanly. */
export function niceStep(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const f = rough / pow
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * pow
}

export interface Ticks {
  ticks: number[]
  /** The axis top, rounded up to a tick. */
  max: number
  min: number
  step: number
}

/** Axis ticks from min to a rounded-up max, aiming for about count intervals. min is kept as given (0 for download counts). */
export function niceTicks(min: number, max: number, count = 5): Ticks {
  if (max <= min) max = min + 1
  const step = niceStep((max - min) / Math.max(1, count))
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  // Index by count rather than adding the step repeatedly, so 0.1 steps do not drift.
  for (let i = 0; start + i * step <= end + step * 1e-9; i++) ticks.push(Number((start + i * step).toPrecision(12)))
  return { ticks, min: start, max: end, step }
}

/** Up to max evenly spaced indices out of n, always including the first and the last. */
export function pickIndices(n: number, max: number): number[] {
  if (n <= 0) return []
  if (n <= max) return Array.from({ length: n }, (_, i) => i)
  const out: number[] = []
  for (let i = 0; i < max; i++) out.push(Math.round((i * (n - 1)) / (max - 1)))
  return [...new Set(out)]
}

/** The index whose x position is closest to px, for a series laid out evenly from x0 to x1. */
export function nearestIndex(px: number, n: number, x0: number, x1: number): number {
  if (n <= 1) return 0
  const t = (px - x0) / (x1 - x0)
  return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))
}

/** Running totals for stacking: result[s][i] is the top of series s at point i; the bottom is result[s-1][i]. Nulls count as 0. */
export function stackTops(values: (number | null)[][]): number[][] {
  const tops: number[][] = []
  values.forEach((row, s) => {
    tops.push(row.map((v, i) => (v ?? 0) + (s > 0 ? tops[s - 1][i] : 0)))
  })
  return tops
}

/** Splits a series at nulls into runs of [index, value] pairs, so a gap breaks the line. */
export function runs(values: (number | null)[]): [number, number][][] {
  const out: [number, number][][] = []
  let cur: [number, number][] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (cur.length) out.push(cur)
      cur = []
    } else cur.push([i, v])
  })
  if (cur.length) out.push(cur)
  return out
}

/** SVG path for a polyline through points. */
export function linePath(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
}

/** Daily differences of a cumulative series; the first point has no predecessor and becomes null. */
export function dailyDeltas(cumulative: number[]): (number | null)[] {
  return cumulative.map((v, i) => (i === 0 ? null : v - cumulative[i - 1]))
}
