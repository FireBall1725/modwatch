// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseApi<T> {
  /** The latest good data. It stays in place while a refresh runs and after a refresh fails. */
  data: T | null
  /** The latest failure, cleared by the next success. */
  error: Error | null
  /** True only until the first answer for the current deps; skeleton this, not refreshes. */
  loading: boolean
  /** True while any request is in flight, including background ones. */
  refreshing: boolean
  /** Fetches again without clearing the data. Resolves when the request settles. */
  reload: () => Promise<void>
}

interface Options {
  /** Refetch this often, in milliseconds, quietly, while the tab is visible. A function is asked before every wait with the latest data, so a page can poll faster while a job runs; it returns 0 to stop. */
  pollMs?: number | ((data: unknown) => number)
  /** Drop the old data when deps change and show loading again. For a different record (a mod page), not a range switch. */
  resetOnChange?: boolean
}

/**
 * Runs a fetcher when deps change and, optionally, on an interval. Data from the previous deps stays on screen until
 * the new answer lands, so a range switch or a refresh never flashes. Pass a fetcher that only closes over values in deps.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: readonly unknown[], options: Options = {}): UseApi<T> {
  const { pollMs, resetOnChange = false } = options
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const fetcherRef = useRef(fetcher)
  const seq = useRef(0)
  const alive = useRef(true)
  const dataRef = useRef<T | null>(null)
  const pollRef = useRef(pollMs)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const run = useCallback(async () => {
    const mine = ++seq.current
    setRefreshing(true)
    try {
      const next = await fetcherRef.current()
      if (!alive.current || mine !== seq.current) return
      setData(next)
      setError(null)
    } catch (e) {
      if (!alive.current || mine !== seq.current) return
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      if (alive.current && mine === seq.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    alive.current = true
    if (resetOnChange) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null)
      setError(null)
      setLoading(true)
    }
    void run()
    return () => {
      alive.current = false
    }
    // deps is the caller's list; run is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps])

  useEffect(() => {
    dataRef.current = data
  }, [data])
  useEffect(() => {
    pollRef.current = pollMs
  })

  const polls = Boolean(pollMs)
  useEffect(() => {
    if (!polls) return
    let timer: number | undefined
    let stopped = false
    const next = () => {
      const p = pollRef.current
      const ms = typeof p === 'function' ? p(dataRef.current) : (p ?? 0)
      if (!ms || stopped) return
      timer = window.setTimeout(async () => {
        if (!document.hidden) await run()
        next()
      }, ms)
    }
    next()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [polls, run])

  return { data, error, loading, refreshing, reload: run }
}
