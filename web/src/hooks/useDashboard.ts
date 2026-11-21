// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type History, type ModStat, type Summary } from '../lib/api'

export interface Dashboard {
  summary: Summary | null
  mods: ModStat[]
  history: History
  error: string | null
  loading: boolean
  poll: () => Promise<void>
}

const REFRESH_MS = 60_000
const POLLING_REFRESH_MS = 3_000

/** Loads the summary, mods and 30-day history together, and refreshes them while the page is open. */
export function useDashboard(): Dashboard {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [mods, setMods] = useState<ModStat[]>([])
  const [history, setHistory] = useState<History>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      const [s, m, h] = await Promise.all([api.summary(), api.mods(), api.history(30)])
      setSummary(s)
      setMods(m)
      setHistory(h)
      setError(null)
      return s.polling
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const polling = await load()
      if (!cancelled) timer.current = window.setTimeout(tick, polling ? POLLING_REFRESH_MS : REFRESH_MS)
    }
    void tick()
    return () => {
      cancelled = true
      window.clearTimeout(timer.current)
    }
  }, [load])

  const poll = useCallback(async () => {
    try {
      await api.poll()
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return
    }
    await load()
  }, [load])

  return { summary, mods, history, error, loading, poll }
}
