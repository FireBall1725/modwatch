// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type {
  Catalog,
  CatalogEntry,
  CatalogUpdate,
  DownloadsHistory,
  IssueItem,
  Issues,
  ModDetail,
  ModSummary,
  Overview,
  ReleaseItem,
  Versions,
} from './types'

/** VITE_MOCK=1 serves web/src/mocks/fixtures/*.json through these same functions. Vite folds the check at build time. */
const MOCK = import.meta.env.VITE_MOCK === '1'

export const isMock = MOCK

/** An API failure with the HTTP status, so callers can tell a 409 (poll already running) from a 500. */
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `${res.status} ${res.statusText}`, res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

/** The old /api/v1/summary shape, kept while the backend still serves it. New pages use overview(). */
export interface LegacySummary {
  version: string
  schedule: string
  polling: boolean
  problems: string[]
  owned: { mods: number; downloads: number; delta24h: number | null; delta7d: number | null }
  all: { mods: number; downloads: number; delta24h: number | null; delta7d: number | null }
  lastPoll: Overview['lastPoll']
  lastOkPoll: Overview['lastOkPoll']
  sources: Overview['sources']
}

export type IssueState = 'open' | 'closed' | 'all'

/** Download history ranges the UI offers, in days. */
export type HistoryDays = 7 | 30 | 90 | 365

async function mock() {
  return import('../mocks/mockApi')
}

export const api = {
  overview: (): Promise<Overview> => (MOCK ? mock().then((m) => m.overview()) : request('/api/v1/overview')),

  /** Owned and member mods, biggest first. */
  mods: (): Promise<ModSummary[]> => (MOCK ? mock().then((m) => m.mods()) : request('/api/v1/mods')),

  mod: (slug: string): Promise<ModDetail> =>
    MOCK ? mock().then((m) => m.mod(slug)) : request(`/api/v1/mods/${encodeURIComponent(slug)}`),

  downloadsHistory: (days: number = 90): Promise<DownloadsHistory> =>
    MOCK ? mock().then((m) => m.downloadsHistory(days)) : request(`/api/v1/downloads/history?days=${days}`),

  versions: (): Promise<Versions> => (MOCK ? mock().then((m) => m.versions()) : request('/api/v1/versions')),

  releases: (limit: number = 50): Promise<ReleaseItem[]> =>
    MOCK ? mock().then((m) => m.releases(limit)) : request(`/api/v1/releases?limit=${limit}`),

  /** state defaults to open on the server. The summary always describes open issues. */
  issues: (state: IssueState = 'open'): Promise<Issues> =>
    MOCK ? mock().then((m) => m.issues(state)) : request(`/api/v1/issues?state=${state}`),

  catalog: (): Promise<Catalog> => (MOCK ? mock().then((m) => m.catalog()) : request('/api/v1/catalog')),

  /** Any field left out stays as it was; null clears a link. Resolves to the saved entry. */
  catalogPut: (slug: string, update: CatalogUpdate): Promise<CatalogEntry> =>
    MOCK
      ? mock().then((m) => m.catalogPut(slug, update))
      : request(`/api/v1/catalog/${encodeURIComponent(slug)}`, json('PUT', update)),

  /** Re-runs auto-linking over every entry that was not linked by hand. Reload the catalog afterwards. */
  catalogRelink: async (): Promise<void> => {
    if (MOCK) return mock().then((m) => m.catalogRelink())
    await request<unknown>('/api/v1/catalog/relink', { method: 'POST' })
  },

  /** Starts a poll. Rejects with ApiError status 409 when one is already running. */
  poll: async (): Promise<void> => {
    if (MOCK) return mock().then((m) => m.poll())
    await request<unknown>('/api/v1/poll', { method: 'POST' })
  },

  summary: (): Promise<LegacySummary> => (MOCK ? mock().then((m) => m.summary()) : request('/api/v1/summary')),
}

export type { IssueItem }
