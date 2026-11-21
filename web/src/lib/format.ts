// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

const grouped = new Intl.NumberFormat('en-CA')

/** 1234567 -> "1,234,567". */
export function formatCount(n: number): string {
  return grouped.format(n)
}

/** +12, -3, or 0; null means there is no snapshot old enough to compare against. */
export function formatDelta(n: number | null): string {
  if (n === null) return '–'
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '−'}${grouped.format(Math.abs(n))}`
}

export type Relative = { key: 'justNow' | 'minutes' | 'hours' | 'days'; count: number }

/** How long ago a time was, as a translation key and a count, so the caller picks the words. */
export function relativeTime(iso: string, now: Date = new Date()): Relative {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return { key: 'justNow', count: 0 }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return { key: 'minutes', count: minutes }
  const hours = Math.round(minutes / 60)
  if (hours < 48) return { key: 'hours', count: hours }
  return { key: 'days', count: Math.round(hours / 24) }
}

/** Points for an SVG polyline, scaled into a width by height box with the line's own min and max as the range. */
export function sparklinePoints(values: number[], width: number, height: number, pad = 2): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = (width - pad * 2) / (values.length - 1)
  return values
    .map((v, i) => {
      const x = pad + i * step
      // A flat line sits in the middle rather than on the floor.
      const y = max === min ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
