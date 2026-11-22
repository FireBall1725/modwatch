// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { IssueState } from '../../lib/api'
import type { IssueItem, IssueKind } from '../../lib/types'

export const KINDS: IssueKind[] = ['crash', 'bug', 'compatibility', 'enhancement', 'question', 'other']
export const AGES = ['any', '7', '30', '90'] as const
export type AgeFilter = (typeof AGES)[number]

/** The sentinel mod filter for issues whose label no registry entry claims. */
export const UNCLAIMED = '_unclaimed'
/** The sentinel mod filter for issues with no `mod:` label at all. */
export const NO_MOD = '_none'

export interface Filters {
  q: string
  mod: string
  kind: IssueKind | 'all'
  state: IssueState
  age: AgeFilter
}

export const DEFAULT_FILTERS: Filters = { q: '', mod: 'all', kind: 'all', state: 'open', age: 'any' }

const DAY = 86_400_000

/** Reads filters from a query string, ignoring values it does not know. */
export function parseFilters(params: URLSearchParams): Filters {
  const state = params.get('state')
  const kind = params.get('kind')
  const age = params.get('age')
  return {
    q: params.get('q') ?? '',
    mod: params.get('mod') || 'all',
    kind: kind && (KINDS as string[]).includes(kind) ? (kind as IssueKind) : 'all',
    state: state === 'closed' || state === 'all' ? state : 'open',
    age: age && (AGES as readonly string[]).includes(age) ? (age as AgeFilter) : 'any',
  }
}

/** Writes only the non-default filters, so the plain page has a clean URL. */
export function serializeFilters(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q)
  if (f.mod !== 'all') p.set('mod', f.mod)
  if (f.kind !== 'all') p.set('kind', f.kind)
  if (f.state !== 'open') p.set('state', f.state)
  if (f.age !== 'any') p.set('age', f.age)
  return p
}

export function activeFilterCount(f: Filters): number {
  return (f.q.trim() ? 1 : 0) + (f.mod !== 'all' ? 1 : 0) + (f.kind !== 'all' ? 1 : 0) + (f.age !== 'any' ? 1 : 0)
}

/** Whole days since an issue was opened. */
export function ageDays(issue: IssueItem, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(issue.createdAt).getTime()) / DAY))
}

/** The key the mod filter uses for an issue. */
export function modKey(issue: IssueItem): string {
  if (issue.modSlug) return issue.modSlug
  return issue.modLabel ? UNCLAIMED : NO_MOD
}

export function filterIssues(issues: IssueItem[], f: Filters, now: Date = new Date()): IssueItem[] {
  const q = f.q.trim().toLowerCase()
  const minAge = f.age === 'any' ? 0 : Number(f.age)
  return issues.filter((i) => {
    if (f.state !== 'all' && i.state !== f.state) return false
    if (f.kind !== 'all' && i.kind !== f.kind) return false
    if (f.mod !== 'all' && modKey(i) !== f.mod) return false
    if (minAge && ageDays(i, now) < minAge) return false
    if (q) {
      const hay = `#${i.number} ${i.title} ${i.modName ?? ''} ${i.modLabel ?? ''} ${i.author} ${i.labels.join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Lower is more urgent. */
export function kindRank(kind: IssueKind): number {
  const i = KINDS.indexOf(kind)
  return i < 0 ? KINDS.length : i
}

/** Crashes, then bugs, then the rest; within a kind, open before closed, then oldest first for open and newest first for closed. */
export function sortIssues(issues: IssueItem[]): IssueItem[] {
  return [...issues].sort((a, b) => {
    if (a.state !== b.state) return a.state === 'open' ? -1 : 1
    const k = kindRank(a.kind) - kindRank(b.kind)
    if (k) return k
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    return a.state === 'open' ? ta - tb : tb - ta
  })
}

export const isProblem = (i: IssueItem): boolean => i.kind === 'crash' || i.kind === 'bug'

/** Open crashes and bugs, most urgent first. */
export function openProblems(issues: IssueItem[]): IssueItem[] {
  return sortIssues(issues.filter((i) => i.state === 'open' && isProblem(i)))
}

/** The longest-open bug or crash, or null. */
export function oldestOpenProblem(issues: IssueItem[]): IssueItem | null {
  let best: IssueItem | null = null
  for (const i of issues) {
    if (i.state !== 'open' || !isProblem(i)) continue
    if (!best || new Date(i.createdAt) < new Date(best.createdAt)) best = i
  }
  return best
}

export interface UnclaimedLabel {
  label: string
  count: number
  numbers: number[]
}

/** `mod:` labels that no registry entry claims, with the issues that carry them. */
export function unclaimedLabels(issues: IssueItem[]): UnclaimedLabel[] {
  const map = new Map<string, UnclaimedLabel>()
  for (const i of issues) {
    if (i.modSlug || !i.modLabel) continue
    const e = map.get(i.modLabel) ?? { label: i.modLabel, count: 0, numbers: [] }
    e.count += 1
    e.numbers.push(i.number)
    map.set(i.modLabel, e)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export interface ModOption {
  value: string
  name: string
  count: number
}

/** Mods that have at least one issue in the list, most issues first, with the sentinel groups last. */
export function modOptions(issues: IssueItem[]): ModOption[] {
  const map = new Map<string, ModOption>()
  for (const i of issues) {
    const key = modKey(i)
    const name = i.modName ?? i.modLabel ?? ''
    const e = map.get(key) ?? { value: key, name, count: 0 }
    e.count += 1
    map.set(key, e)
  }
  const rank = (o: ModOption) => (o.value === UNCLAIMED ? 1 : o.value === NO_MOD ? 2 : 0)
  return [...map.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'en-CA'))
}

/** Splits a mod's open count into crashes, bugs and everything else for the stacked bar. */
export function splitOpen(m: { open: number; bugs: number; crashes: number }): { crashes: number; bugs: number; other: number } {
  return { crashes: m.crashes, bugs: m.bugs, other: Math.max(0, m.open - m.bugs - m.crashes) }
}

export type Verdict = 'clear' | 'requests' | 'problems'

/** The two-second answer: problems when a bug or crash is open, requests when only other issues are, clear otherwise. */
export function verdict(s: { open: number; openBugs: number; openCrashes: number }): Verdict {
  if (s.openBugs + s.openCrashes > 0) return 'problems'
  return s.open > 0 ? 'requests' : 'clear'
}
