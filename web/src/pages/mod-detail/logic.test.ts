// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from 'vitest'
import type { DownloadPoint, FileItem, IssueItem, PlatformInfo } from '../../lib/types'
import { chartData, countClosed, filterFiles, fileMinecraftVersions, gained, orderIssues, panelTone, parseRange, queueDays, sliceHistory, versionRows } from './logic'

const pts: DownloadPoint[] = [10, 20, 35, 50, 80].map((n, i) => ({ at: `2026-11-0${i + 1}T00:00:00.000Z`, curseforge: n, modrinth: n * 2 }))

describe('range and history', () => {
  it('falls back to 30', () => {
    expect(parseRange('x')).toBe('30')
    expect(parseRange(null)).toBe('30')
    expect(parseRange('all')).toBe('all')
  })
  it('keeps one extra point so the first day has a movement', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...pts[0], curseforge: i }))
    expect(sliceHistory(ten, '7')).toHaveLength(8)
    expect(sliceHistory(pts, '30')).toHaveLength(5)
    expect(sliceHistory(pts, 'all')).toHaveLength(5)
  })
  it('turns cumulative into daily', () => {
    const d = chartData(pts, 'daily')
    expect(d.curseforge).toEqual([10, 15, 15, 30])
    expect(d.modrinth).toEqual([20, 30, 30, 60])
    expect(d.x).toHaveLength(4)
    expect(chartData(pts, 'total').curseforge).toHaveLength(5)
  })
  it('never goes negative when a platform lowers its count', () => {
    const down = [pts[1], { ...pts[2], curseforge: 5 }]
    expect(chartData(down, 'daily').curseforge).toEqual([0])
  })
  it('sums what was gained', () => {
    expect(gained(pts)).toEqual({ curseforge: 70, modrinth: 140, total: 210 })
    expect(gained(pts.slice(0, 1))).toBeNull()
  })
})

const info = (p: Partial<PlatformInfo>): PlatformInfo =>
  ({ platform: 'modrinth', status: 'in_review', queuedAt: '2026-11-12T00:00:00.000Z', ...p }) as PlatformInfo

describe('review panel', () => {
  it('counts queue days only while not approved', () => {
    const now = new Date('2026-11-21T00:00:00.000Z')
    expect(queueDays(info({}), now)).toBe(9)
    expect(queueDays(info({ status: 'approved' }), now)).toBeNull()
    expect(queueDays(info({ queuedAt: null }), now)).toBeNull()
  })
  it('maps status to a tone', () => {
    expect(panelTone(info({ status: 'approved' }))).toBe('ok')
    expect(panelTone(info({ status: 'rejected' }))).toBe('bad')
    expect(panelTone(info({ status: 'draft' }))).toBe('neutral')
    expect(panelTone(info({}))).toBe('review')
  })
})

const file = (p: Partial<FileItem>): FileItem =>
  ({ platform: 'curseforge', releaseType: 'release', minecraftVersions: ['1.21.1'], ...p }) as FileItem

describe('files', () => {
  const files = [file({ id: 'a' }), file({ id: 'b', platform: 'modrinth', minecraftVersions: ['26.1', '1.21.11'], releaseType: 'beta' })]
  it('filters on every field', () => {
    expect(filterFiles(files, { platform: 'all', mc: 'all', type: 'all' })).toHaveLength(2)
    expect(filterFiles(files, { platform: 'modrinth', mc: 'all', type: 'all' })).toHaveLength(1)
    expect(filterFiles(files, { platform: 'all', mc: '26.1', type: 'beta' })).toHaveLength(1)
    expect(filterFiles(files, { platform: 'curseforge', mc: '26.1', type: 'all' })).toHaveLength(0)
  })
  it('sorts versions by number, not text', () => {
    expect(fileMinecraftVersions(files)).toEqual(['26.1', '1.21.11', '1.21.1'])
  })
  it('orders version rows newest first', () => {
    const rows = versionRows([
      { name: '1.21.11', downloads: 1, curseforge: 1, modrinth: 0, files: 1 },
      { name: '26.1', downloads: 1, curseforge: 1, modrinth: 0, files: 1 },
    ])
    expect(rows.map((r) => r.name)).toEqual(['26.1', '1.21.11'])
  })
})

const issue = (p: Partial<IssueItem>): IssueItem =>
  ({ state: 'open', kind: 'bug', createdAt: '2026-11-01T00:00:00.000Z', closedAt: null, ...p }) as IssueItem

describe('issues', () => {
  const list = [
    issue({ number: 1, kind: 'enhancement' }),
    issue({ number: 2, kind: 'bug', createdAt: '2026-11-05T00:00:00.000Z' }),
    issue({ number: 3, kind: 'bug' }),
    issue({ number: 4, kind: 'crash', createdAt: '2026-11-10T00:00:00.000Z' }),
    issue({ number: 5, state: 'closed', closedAt: '2026-11-08T00:00:00.000Z' }),
    issue({ number: 6, state: 'closed', closedAt: '2026-11-09T00:00:00.000Z' }),
  ]
  it('puts crashes then bugs first, oldest first', () => {
    expect(orderIssues(list, false).map((i) => i.number)).toEqual([4, 3, 2, 1])
  })
  it('appends closed, newest closed first', () => {
    expect(orderIssues(list, true).map((i) => i.number)).toEqual([4, 3, 2, 1, 6, 5])
    expect(countClosed(list)).toBe(2)
  })
})
