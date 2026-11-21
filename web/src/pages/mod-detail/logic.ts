// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { daysBetween } from '../../lib/format'
import { sortMinecraftDesc } from '../../lib/minecraft'
import type { DownloadPoint, FileItem, IssueItem, IssueKind, Platform, PlatformInfo, VersionTotal } from '../../lib/types'

export type RangeKey = '7' | '30' | '90' | 'all'
export type ChartView = 'total' | 'daily'

export const RANGES: RangeKey[] = ['7', '30', '90', 'all']

/** Reads a range from a query value; anything unknown falls back to 30 days. */
export function parseRange(v: string | null): RangeKey {
  return RANGES.includes(v as RangeKey) ? (v as RangeKey) : '30'
}

export function parseView(v: string | null): ChartView {
  return v === 'daily' ? 'daily' : 'total'
}

/** Keeps the last `days` days of a cumulative series, plus one point before so the first day has a movement. */
export function sliceHistory(points: DownloadPoint[], range: RangeKey): DownloadPoint[] {
  if (range === 'all') return points
  const days = Number(range)
  return points.slice(Math.max(0, points.length - days - 1))
}

export interface ChartData {
  x: string[]
  curseforge: (number | null)[]
  modrinth: (number | null)[]
}

/** Cumulative totals or per-day movement per platform. Daily drops the first point, which has no predecessor. */
export function chartData(points: DownloadPoint[], view: ChartView): ChartData {
  if (view === 'total') {
    return { x: points.map((p) => p.at), curseforge: points.map((p) => p.curseforge), modrinth: points.map((p) => p.modrinth) }
  }
  const rest = points.slice(1)
  return {
    x: rest.map((p) => p.at),
    curseforge: rest.map((p, i) => Math.max(0, p.curseforge - points[i].curseforge)),
    modrinth: rest.map((p, i) => Math.max(0, p.modrinth - points[i].modrinth)),
  }
}

/** Downloads gained across the points: last minus first, per platform. Null when fewer than two points. */
export function gained(points: DownloadPoint[]): { curseforge: number; modrinth: number; total: number } | null {
  if (points.length < 2) return null
  const a = points[0]
  const b = points[points.length - 1]
  const cf = b.curseforge - a.curseforge
  const mr = b.modrinth - a.modrinth
  return { curseforge: cf, modrinth: mr, total: cf + mr }
}

/** Whole days a project has waited in the review queue, or null when it is not queued. */
export function queueDays(info: PlatformInfo, now: Date = new Date()): number | null {
  if (!info.queuedAt || info.status === 'approved') return null
  return Math.max(0, daysBetween(info.queuedAt, now))
}

export type PanelTone = 'ok' | 'review' | 'bad' | 'neutral'

/** The tone that frames a platform panel, so a problem reads before the text does. */
export function panelTone(info: PlatformInfo): PanelTone {
  switch (info.status) {
    case 'approved':
      return 'ok'
    case 'in_review':
      return 'review'
    case 'changes_required':
    case 'rejected':
      return 'bad'
    default:
      return 'neutral'
  }
}

export interface FileFilter {
  platform: Platform | 'all'
  mc: string
  type: string
}

export const ALL = 'all'

export function parsePlatform(v: string | null): Platform | 'all' {
  return v === 'curseforge' || v === 'modrinth' ? v : 'all'
}

export function filterFiles(files: FileItem[], f: FileFilter): FileItem[] {
  return files.filter(
    (file) =>
      (f.platform === ALL || file.platform === f.platform) &&
      (f.mc === ALL || file.minecraftVersions.includes(f.mc)) &&
      (f.type === ALL || file.releaseType === f.type),
  )
}

/** Distinct Minecraft versions across files, newest first. */
export function fileMinecraftVersions(files: FileItem[]): string[] {
  return sortMinecraftDesc([...new Set(files.flatMap((f) => f.minecraftVersions))])
}

/** Distinct release types across files in a fixed order. */
export function fileReleaseTypes(files: FileItem[]): string[] {
  const order = ['release', 'beta', 'alpha', 'unknown']
  const seen = new Set(files.map((f) => f.releaseType))
  return order.filter((o) => seen.has(o as FileItem['releaseType']))
}

/** Minecraft versions as bar rows, newest version first, so a gap at the top is visible. */
export function versionRows(versions: VersionTotal[]): VersionTotal[] {
  const order = new Map(sortMinecraftDesc(versions.map((v) => v.name)).map((n, i) => [n, i]))
  return [...versions].sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0))
}

const KIND_RANK: Record<IssueKind, number> = { crash: 0, bug: 1, compatibility: 2, enhancement: 3, question: 4, other: 5 }

/** Open issues first, crashes and bugs on top, oldest first within a kind. Closed issues follow, newest closed first. */
export function orderIssues(issues: IssueItem[], showClosed: boolean): IssueItem[] {
  const open = issues
    .filter((i) => i.state === 'open')
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.createdAt.localeCompare(b.createdAt))
  if (!showClosed) return open
  const closed = issues.filter((i) => i.state === 'closed').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
  return [...open, ...closed]
}

export function countClosed(issues: IssueItem[]): number {
  return issues.filter((i) => i.state === 'closed').length
}

/** Share of the total as a 0..1 ratio, 0 when the total is 0. */
export function share(part: number, total: number): number {
  return total > 0 ? part / total : 0
}
