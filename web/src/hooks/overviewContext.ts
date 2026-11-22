// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { createContext, useContext } from 'react'
import type { Overview } from '../lib/types'
import type { UseApi } from './useApi'

export interface OverviewState extends UseApi<Overview> {
  /** True while the server reports a poll running, or one was just started from here. */
  polling: boolean
  /** Starts a poll and refreshes the overview quickly until it ends. Resolves once the request is accepted. */
  pollNow: () => Promise<void>
  /** Why the last Poll now failed, if it did. Cleared by the next attempt. */
  pollError: string | null
}

export const OverviewContext = createContext<OverviewState | null>(null)

/** The shared overview, fetched once by the shell and refreshed every minute (every 3 seconds during a poll). Pages read it instead of fetching /overview again. */
export function useOverview(): OverviewState {
  const ctx = useContext(OverviewContext)
  if (!ctx) throw new Error('useOverview needs the OverviewProvider')
  return ctx
}
