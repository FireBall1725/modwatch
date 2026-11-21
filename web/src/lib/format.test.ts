// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import { formatCount, formatDelta, relativeTime, sparklinePoints } from './format'

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(1234567)).toBe('1,234,567')
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
