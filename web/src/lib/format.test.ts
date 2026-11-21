// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  formatCompact,
  formatCount,
  formatDelta,
  formatDuration,
  formatPercent,
  formatTime,
  plural,
  ratio,
  relativeTime,
  sparklinePoints,
} from './format'

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(1234567)).toBe('1,234,567')
  })
  it('shows a dash for an unknown count and a zero for zero', () => {
    expect(formatCount(null)).toBe('–')
    expect(formatCount(0)).toBe('0')
  })
})

describe('formatCompact', () => {
  it('shortens thousands and millions', () => {
    expect(formatCompact(940)).toBe('940')
    expect(formatCompact(48300)).toBe('48.3k')
    expect(formatCompact(1115528)).toBe('1.1M')
    expect(formatCompact(250000)).toBe('250k')
  })
  it('handles null and negatives', () => {
    expect(formatCompact(null)).toBe('–')
    expect(formatCompact(-1500)).toBe('−1.5k')
  })
})

describe('formatPercent', () => {
  it('formats a ratio', () => {
    expect(formatPercent(0.4234)).toBe('42%')
    expect(formatPercent(0.4234, 1)).toBe('42.3%')
    expect(formatPercent(null)).toBe('–')
  })
  it('ratio never divides by zero', () => {
    expect(ratio(5, 0)).toBe(0)
    expect(ratio(1, 4)).toBe(0.25)
  })
})

describe('formatDuration', () => {
  it('shows the two largest units', () => {
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(45 * 60)).toBe('45m')
    expect(formatDuration(2 * 3600 + 5 * 60)).toBe('2h 5m')
    expect(formatDuration(3 * 86400 + 4 * 3600 + 59)).toBe('3d 4h')
    expect(formatDuration(2 * 86400)).toBe('2d')
    expect(formatDuration(null)).toBe('–')
  })
})

describe('formatTime', () => {
  it('uses a 24-hour clock', () => {
    // Midday UTC is a two-digit hour in every zone, and never "PM".
    expect(formatTime('2026-11-21T15:30:00Z')).toMatch(/^\d{2}:\d{2}$/)
    expect(formatTime(null)).toBe('–')
  })
})

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-11-10T12:00:00Z', new Date('2026-11-21T11:00:00Z'))).toBe(10)
    expect(daysBetween('2026-11-22T12:00:00Z', new Date('2026-11-21T11:00:00Z'))).toBe(0)
  })
})

describe('plural', () => {
  it('picks by count', () => {
    expect(plural(1, 'file', 'files')).toBe('file')
    expect(plural(0, 'file', 'files')).toBe('files')
    expect(plural(2, 'file', 'files')).toBe('files')
  })
})

describe('formatDelta', () => {
  it('shows a dash when there is nothing to compare', () => {
    expect(formatDelta(null)).toBe('–')
  })
  it('signs the number', () => {
    expect(formatDelta(12)).toBe('+12')
    expect(formatDelta(-3)).toBe('−3')
    expect(formatDelta(0)).toBe('0')
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-11-21T12:00:00Z')
  it('rounds to the nearest unit', () => {
    expect(relativeTime('2026-11-21T11:59:40Z', now)).toEqual({ key: 'justNow', count: 0 })
    expect(relativeTime('2026-11-21T11:30:00Z', now)).toEqual({ key: 'minutes', count: 30 })
    expect(relativeTime('2026-11-21T06:00:00Z', now)).toEqual({ key: 'hours', count: 6 })
    expect(relativeTime('2026-11-18T12:00:00Z', now)).toEqual({ key: 'days', count: 3 })
  })
  it('treats a future time as just now', () => {
    expect(relativeTime('2026-11-21T13:00:00Z', now).key).toBe('justNow')
  })
})

describe('sparklinePoints', () => {
  it('needs two points to draw a line', () => {
    expect(sparklinePoints([5], 100, 20)).toBe('')
  })
  it('runs low to high left to right', () => {
    const pts = sparklinePoints([0, 10], 100, 20, 0).split(' ')
    expect(pts[0]).toBe('0.0,20.0')
    expect(pts[1]).toBe('100.0,0.0')
  })
  it('puts a flat line in the middle', () => {
    expect(sparklinePoints([7, 7, 7], 100, 20, 0)).toBe('0.0,10.0 50.0,10.0 100.0,10.0')
  })
})
