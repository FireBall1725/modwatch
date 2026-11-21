// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

export interface Poll {
  id: number
  startedAt: string
  finishedAt: string
  state: 'ok' | 'error'
  error?: string
  mods: number
}

export interface Totals {
  mods: number
  downloads: number
  delta24h: number | null
  delta7d: number | null
}

export interface Summary {
  version: string
  schedule: string
  polling: boolean
  problems: string[]
  owned: Totals
  all: Totals
  lastPoll: Poll | null
  lastOkPoll: Poll | null
}

export interface ModStat {
  id: number
  slug: string
  name: string
  summary: string
  logoUrl: string
  websiteUrl: string
  owned: boolean
  dateCreated: string
  dateModified: string
  downloads: number
  delta24h: number | null
  delta7d: number | null
}

export interface Snapshot {
  at: string
  downloads: number
}

export type History = Record<string, Snapshot[]>

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  summary: () => getJSON<Summary>('/api/v1/summary'),
  mods: () => getJSON<ModStat[]>('/api/v1/mods'),
  history: (days = 30) => getJSON<History>(`/api/v1/history?days=${days}`),
  async poll(): Promise<void> {
    const res = await fetch('/api/v1/poll', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error ?? `${res.status} ${res.statusText}`)
    }
  },
}
