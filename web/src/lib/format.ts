// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

const grouped = new Intl.NumberFormat('en-CA')
const MINUS = '−'
const DASH = '–'

/** What a number that can't be known yet looks like. */
export const NO_VALUE = DASH

/** 1234567 -> "1,234,567"; null -> "–". */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return NO_VALUE
  return grouped.format(n)
}

/** +12, −3, or 0; null means there is no snapshot old enough to compare against. */
export function formatDelta(n: number | null | undefined): string {
  if (n === null || n === undefined) return NO_VALUE
  if (n === 0) return '0'
  return `${n > 0 ? '+' : MINUS}${grouped.format(Math.abs(n))}`
}

/** 1115528 -> "1.1M", 48300 -> "48.3k", 940 -> "940". Keeps one decimal below 100 of a unit. */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return NO_VALUE
  const abs = Math.abs(n)
  const sign = n < 0 ? MINUS : ''
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ]
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const v = abs / size
      const text = v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString()
      return `${sign}${text}${suffix}`
    }
  }
  return `${sign}${Math.round(abs)}`
}

/** A ratio (0 to 1) as a percentage: 0.4234 -> "42%"; digits adds decimals. null -> "–". */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return NO_VALUE
  return `${(ratio * 100).toFixed(digits)}%`
}

/** Part over whole as a ratio; 0 when the whole is 0 so callers never print NaN. */
export function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0
}

/** Seconds as "3d 4h", "2h 5m", "45m" or "30s". Shows the two largest non-zero units. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return NO_VALUE
  const s = Math.max(0, Math.round(totalSeconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

/** Whole days between two times, never negative. */
export function daysBetween(fromIso: string, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - new Date(fromIso).getTime()) / 86_400_000))
}

export type Relative = { key: 'justNow' | 'minutes' | 'hours' | 'days' | 'months' | 'years'; count: number }

const DAYS_PER_YEAR = 365.25
const DAYS_PER_MONTH = 30.4375

/**
 * How long ago a time was, as a translation key and a count, so the caller picks the words. Under 48 hours it is hours,
 * under 60 days it is days, under a year (365 days) it is months, and from a year on it is whole years.
 */
export function relativeTime(iso: string, now: Date = new Date()): Relative {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return { key: 'justNow', count: 0 }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return { key: 'minutes', count: minutes }
  const hours = Math.round(minutes / 60)
  if (hours < 48) return { key: 'hours', count: hours }
  const days = Math.round(hours / 24)
  if (days < 60) return { key: 'days', count: days }
  if (days < 365) return { key: 'months', count: Math.min(11, Math.max(2, Math.round(days / DAYS_PER_MONTH))) }
  return { key: 'years', count: Math.max(1, Math.floor(days / DAYS_PER_YEAR)) }
}

const dateFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "Nov 21, 2026" in the viewer's time zone. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE
  return dateFmt.format(new Date(iso)).replace('.', '')
}

/** "Nov 21", for axes and tight cells. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE
  return shortDateFmt.format(new Date(iso)).replace('.', '')
}

/** "13:30" on a 24-hour clock in the viewer's time zone. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE
  return timeFmt.format(new Date(iso))
}

/** "Nov 21, 13:30". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE
  return `${formatShortDate(iso)}, ${formatTime(iso)}`
}

const pluralRules = new Intl.PluralRules('en-CA')

/** Picks the singular or plural word for a count, for the few places that can't go through i18next. */
export function plural(n: number, one: string, other: string): string {
  return pluralRules.select(n) === 'one' ? one : other
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

/** An amount in the currency's own form. Balances are cents and fractions of a cent, so small ones keep more digits. */
export function formatMoney(n: number, currency: string): string {
  const digits = n > 0 && n < 0.1 ? 3 : 2
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: digits }).format(n)
}

/** An amount with every digit replaced by a dot, such as US$•.••. It keeps the currency symbol and the shape, so the page doesn't shift. */
export function maskMoney(currency: string): string {
  return formatMoney(0, currency).replace(/\d/g, '•')
}
