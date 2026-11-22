// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '../../lib/api'
import { OverviewContext, type OverviewState } from '../../hooks/overviewContext'
import { useApi } from '../../hooks/useApi'
import type { Overview } from '../../lib/types'

const IDLE_MS = 60_000
const BUSY_MS = 3_000

/** Fetches the overview once for the whole app and shares it, with Poll now. Wrap the router's routes in it. */
export default function OverviewProvider({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false)
  const [pollError, setPollError] = useState<string | null>(null)
  const res = useApi(api.overview, [], {
    pollMs: (d) => ((d as Overview | null)?.polling ? BUSY_MS : IDLE_MS),
  })
  const { reload } = res

  const pollNow = useCallback(async () => {
    setPollError(null)
    setStarted(true)
    try {
      await api.poll()
    } catch (e) {
      // 409 means one is already running, which is what was asked for.
      if (!(e instanceof ApiError && e.status === 409)) {
        setPollError(e instanceof Error ? e.message : String(e))
        setStarted(false)
        return
      }
    }
    await reload()
    setStarted(false)
  }, [reload])

  const value = useMemo<OverviewState>(
    () => ({ ...res, polling: started || Boolean(res.data?.polling), pollNow, pollError }),
    [res, started, pollNow, pollError],
  )
  return <OverviewContext.Provider value={value}>{children}</OverviewContext.Provider>
}
