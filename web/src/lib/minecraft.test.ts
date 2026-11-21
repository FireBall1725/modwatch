// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import { compareMinecraft, newestMinecraft, sortByMinecraftDesc, sortMinecraftAsc, sortMinecraftDesc } from './minecraft'

describe('compareMinecraft', () => {
  it('puts 26.1 above 1.21.11', () => {
    expect(compareMinecraft('26.1', '1.21.11')).toBeGreaterThan(0)
    expect(compareMinecraft('1.21.11', '26.1')).toBeLessThan(0)
  })
  it('compares numbers, not text', () => {
    expect(compareMinecraft('1.9', '1.10')).toBeLessThan(0)
    expect(compareMinecraft('1.21.4', '1.21.11')).toBeLessThan(0)
    expect(compareMinecraft('1.7.10', '1.12.2')).toBeLessThan(0)
  })
  it('treats a missing patch as zero', () => {
    expect(compareMinecraft('1.21', '1.21.0')).toBe(0)
    expect(compareMinecraft('1.21', '1.21.1')).toBeLessThan(0)
  })
  it('sorts a release candidate below its release', () => {
    expect(compareMinecraft('26.2-rc1', '26.2')).toBeLessThan(0)
    expect(compareMinecraft('26.2-rc1', '26.1')).toBeGreaterThan(0)
  })
})

describe('sorting', () => {
  const list = ['1.21.1', '26.1', '1.7.10', '26.3', '1.21.11', '1.12.2', '26.2']
  it('sorts newest first', () => {
    expect(sortMinecraftDesc(list)).toEqual(['26.3', '26.2', '26.1', '1.21.11', '1.21.1', '1.12.2', '1.7.10'])
  })
  it('sorts oldest first and leaves the input alone', () => {
    expect(sortMinecraftAsc(list)[0]).toBe('1.7.10')
    expect(list[0]).toBe('1.21.1')
  })
  it('finds the newest', () => {
    expect(newestMinecraft(list)).toBe('26.3')
    expect(newestMinecraft([])).toBeNull()
  })
  it('sorts records by a name accessor', () => {
    const out = sortByMinecraftDesc([{ name: '1.9' }, { name: '1.10' }], (x) => x.name)
    expect(out.map((x) => x.name)).toEqual(['1.10', '1.9'])
  })
})
