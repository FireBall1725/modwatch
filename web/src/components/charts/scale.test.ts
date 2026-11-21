// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import { dailyDeltas, linearScale, linePath, nearestIndex, niceStep, niceTicks, pickIndices, runs, stackTops } from './scale'

describe('linearScale', () => {
  it('maps and inverts', () => {
    const s = linearScale(0, 100, 0, 200)
    expect(s(50)).toBe(100)
    expect(s.invert(150)).toBe(75)
  })
  it('supports a flipped range for y axes', () => {
    const s = linearScale(0, 10, 100, 0)
    expect(s(0)).toBe(100)
    expect(s(10)).toBe(0)
  })
  it('does not divide by zero on an empty domain', () => {
    expect(linearScale(5, 5, 10, 20)(5)).toBe(10)
  })
})

describe('niceStep', () => {
  it('rounds to 1, 2, 2.5, 5, 10 times a power of ten', () => {
    expect(niceStep(0.9)).toBe(1)
    expect(niceStep(1.4)).toBe(2)
    expect(niceStep(2.3)).toBe(2.5)
    expect(niceStep(4.1)).toBe(5)
    expect(niceStep(7)).toBe(10)
    expect(niceStep(130)).toBe(200)
  })
  it('falls back for junk', () => {
    expect(niceStep(0)).toBe(1)
    expect(niceStep(NaN)).toBe(1)
  })
})

describe('niceTicks', () => {
  it('starts at zero and ends on a tick at or above the max', () => {
    const t = niceTicks(0, 87, 5)
    expect(t.ticks[0]).toBe(0)
    expect(t.max).toBeGreaterThanOrEqual(87)
    expect(t.ticks.at(-1)).toBe(t.max)
    expect(t.ticks).toEqual([0, 20, 40, 60, 80, 100])
  })
  it('handles a flat series', () => {
    const t = niceTicks(0, 0, 4)
    expect(t.max).toBeGreaterThan(0)
    expect(t.ticks.length).toBeGreaterThan(1)
  })
  it('does not drift on fractional steps', () => {
    expect(niceTicks(0, 0.5, 5).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5])
  })
  it('handles large counts', () => {
    const t = niceTicks(0, 1115528, 5)
    expect(t.max).toBe(1250000)
    expect(t.step).toBe(250000)
  })
})

describe('pickIndices', () => {
  it('returns everything when it fits', () => {
    expect(pickIndices(3, 5)).toEqual([0, 1, 2])
  })
  it('keeps both ends when thinning', () => {
    const p = pickIndices(90, 6)
    expect(p[0]).toBe(0)
    expect(p.at(-1)).toBe(89)
    expect(p).toHaveLength(6)
  })
  it('handles empty', () => {
    expect(pickIndices(0, 5)).toEqual([])
  })
})

describe('nearestIndex', () => {
  it('snaps to the closest point and clamps', () => {
    expect(nearestIndex(0, 5, 0, 100)).toBe(0)
    expect(nearestIndex(49, 5, 0, 100)).toBe(2)
    expect(nearestIndex(500, 5, 0, 100)).toBe(4)
    expect(nearestIndex(-20, 5, 0, 100)).toBe(0)
  })
  it('handles one point', () => {
    expect(nearestIndex(10, 1, 0, 100)).toBe(0)
  })
})

describe('stackTops', () => {
  it('accumulates and treats null as zero', () => {
    expect(stackTops([[1, 2, null], [3, 3, 3]])).toEqual([[1, 2, 0], [4, 5, 3]])
  })
})

describe('runs', () => {
  it('breaks at nulls', () => {
    expect(runs([1, 2, null, 4])).toEqual([[[0, 1], [1, 2]], [[3, 4]]])
    expect(runs([null, null])).toEqual([])
  })
})

describe('linePath and dailyDeltas', () => {
  it('writes a path', () => {
    expect(linePath([[0, 0], [10, 5]])).toBe('M0.0 0.0 L10.0 5.0')
  })
  it('differences a cumulative series', () => {
    expect(dailyDeltas([10, 15, 15, 22])).toEqual([null, 5, 0, 7])
  })
})
