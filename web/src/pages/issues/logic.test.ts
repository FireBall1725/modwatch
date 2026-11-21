// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import type { IssueItem } from '../../lib/types'
import {
  DEFAULT_FILTERS,
  NO_MOD,
  UNCLAIMED,
  activeFilterCount,
  ageDays,
  filterIssues,
  modOptions,
  oldestOpenProblem,
  openProblems,
  parseFilters,
  serializeFilters,
  sortIssues,
  splitOpen,
  unclaimedLabels,
  verdict,
} from './logic'

const NOW = new Date('2026-11-21T12:00:00.000Z')

function issue(n: number, over: Partial<IssueItem> = {}): IssueItem {
  return {
    number: n,
    title: `Issue ${n}`,
    state: 'open',
    url: `https://example.test/${n}`,
    modSlug: 'alpha',
    modName: 'Alpha',
    modLabel: 'alpha',
    kind: 'bug',
    labels: [],
    author: 'someone',
    comments: 0,
    createdAt: '2026-11-11T12:00:00.000Z',
    updatedAt: '2026-11-11T12:00:00.000Z',
    closedAt: null,
    ...over,
  }
}

describe('filters in the query string', () => {
  it('round-trips and omits defaults', () => {
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe('')
    const f = { q: 'dock', mod: 'alpha', kind: 'crash' as const, state: 'all' as const, age: '30' as const }
    expect(parseFilters(serializeFilters(f))).toEqual(f)
  })
  it('ignores unknown values', () => {
    const f = parseFilters(new URLSearchParams('kind=nope&state=weird&age=5'))
    expect(f).toEqual(DEFAULT_FILTERS)
  })
  it('counts active filters but not state', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, state: 'closed' })).toBe(0)
    expect(activeFilterCount({ ...DEFAULT_FILTERS, q: ' ', kind: 'bug', age: '7' })).toBe(2)
  })
})

describe('filterIssues', () => {
  const list = [
    issue(1, { kind: 'crash', title: 'Crash on dock' }),
    issue(2, { kind: 'bug', modSlug: 'beta', modName: 'Beta', modLabel: 'beta', createdAt: '2026-11-20T12:00:00.000Z' }),
    issue(3, { state: 'closed', closedAt: '2026-11-15T00:00:00.000Z' }),
    issue(4, { modSlug: null, modName: null, modLabel: 'ghost', kind: 'question' }),
    issue(5, { modSlug: null, modName: null, modLabel: null, kind: 'other' }),
  ]
  const ids = (f: Partial<typeof DEFAULT_FILTERS>) => filterIssues(list, { ...DEFAULT_FILTERS, ...f }, NOW).map((i) => i.number)

  it('defaults to open only', () => expect(ids({})).toEqual([1, 2, 4, 5]))
  it('shows closed and all', () => {
    expect(ids({ state: 'closed' })).toEqual([3])
    expect(ids({ state: 'all' })).toHaveLength(5)
  })
  it('filters by kind and mod', () => {
    expect(ids({ kind: 'crash' })).toEqual([1])
    expect(ids({ mod: 'beta' })).toEqual([2])
    expect(ids({ mod: UNCLAIMED })).toEqual([4])
    expect(ids({ mod: NO_MOD })).toEqual([5])
  })
  it('filters by minimum age', () => {
    expect(ids({ age: '7' })).toEqual([1, 4, 5])
    expect(ids({ age: '30' })).toEqual([])
  })
  it('searches title, number, label and author', () => {
    expect(ids({ q: 'DOCK' })).toEqual([1])
    expect(ids({ q: '#2' })).toEqual([2])
    expect(ids({ q: 'ghost' })).toEqual([4])
    expect(ids({ q: 'someone', kind: 'bug' })).toEqual([2])
  })
})

describe('ordering', () => {
  it('puts crashes first, open before closed, oldest open first', () => {
    const out = sortIssues([
      issue(1, { kind: 'enhancement' }),
      issue(2, { kind: 'bug', createdAt: '2026-11-15T00:00:00.000Z' }),
      issue(3, { kind: 'bug', createdAt: '2026-10-01T00:00:00.000Z' }),
      issue(4, { kind: 'crash' }),
      issue(5, { kind: 'crash', state: 'closed' }),
    ])
    expect(out.map((i) => i.number)).toEqual([4, 3, 2, 1, 5])
  })
  it('does not mutate its input', () => {
    const input = [issue(1, { kind: 'question' }), issue(2, { kind: 'crash' })]
    sortIssues(input)
    expect(input[0].number).toBe(1)
  })
})

describe('derived numbers', () => {
  const list = [
    issue(1, { kind: 'enhancement', createdAt: '2026-01-01T00:00:00.000Z' }),
    issue(2, { kind: 'bug', createdAt: '2026-11-01T00:00:00.000Z' }),
    issue(3, { kind: 'crash', createdAt: '2026-11-10T00:00:00.000Z' }),
    issue(4, { kind: 'bug', createdAt: '2026-09-01T00:00:00.000Z', state: 'closed' }),
  ]
  it('finds the oldest open bug or crash, ignoring closed and other kinds', () => {
    expect(oldestOpenProblem(list)?.number).toBe(2)
    expect(oldestOpenProblem([list[0]])).toBeNull()
  })
  it('lists open problems, crash first', () => {
    expect(openProblems(list).map((i) => i.number)).toEqual([3, 2])
  })
  it('counts whole days', () => {
    expect(ageDays(issue(1, { createdAt: '2026-11-19T13:00:00.000Z' }), NOW)).toBe(1)
    expect(ageDays(issue(1, { createdAt: '2026-12-01T00:00:00.000Z' }), NOW)).toBe(0)
  })
  it('groups unclaimed labels by count', () => {
    const out = unclaimedLabels([
      issue(1, { modSlug: null, modLabel: 'b' }),
      issue(2, { modSlug: null, modLabel: 'a' }),
      issue(3, { modSlug: null, modLabel: 'a' }),
      issue(4),
      issue(5, { modSlug: null, modLabel: null }),
    ])
    expect(out).toEqual([
      { label: 'a', count: 2, numbers: [2, 3] },
      { label: 'b', count: 1, numbers: [1] },
    ])
  })
  it('builds mod options with sentinels last', () => {
    const out = modOptions([
      issue(1, { modSlug: null, modName: null, modLabel: 'ghost' }),
      issue(2, { modSlug: 'z', modName: 'Zed' }),
      issue(3, { modSlug: 'a', modName: 'Ada' }),
      issue(4, { modSlug: 'a', modName: 'Ada' }),
    ])
    expect(out.map((o) => [o.value, o.count])).toEqual([['a', 2], ['z', 1], [UNCLAIMED, 1]])
  })
  it('splits a mod count', () => {
    expect(splitOpen({ open: 5, bugs: 2, crashes: 1 })).toEqual({ crashes: 1, bugs: 2, other: 2 })
    expect(splitOpen({ open: 1, bugs: 2, crashes: 1 }).other).toBe(0)
  })
  it('gives a verdict', () => {
    expect(verdict({ open: 0, openBugs: 0, openCrashes: 0 })).toBe('clear')
    expect(verdict({ open: 3, openBugs: 0, openCrashes: 0 })).toBe('requests')
    expect(verdict({ open: 3, openBugs: 0, openCrashes: 1 })).toBe('problems')
  })
})
