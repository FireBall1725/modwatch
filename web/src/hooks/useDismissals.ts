// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useState } from 'react'
import { dismissKey, dismissRef } from '../components/attention/dismiss'
import { api } from '../lib/api'
import type { AttentionItem } from '../lib/types'

export interface Dismissals {
  /** Dismisses or restores an item, then runs the refresh. Resolves true when it worked. */
  dismiss: (item: AttentionItem) => Promise<boolean>
  restore: (item: AttentionItem) => Promise<boolean>
  /** The key of the item being sent, so its button can show it is busy. */
  busy: string | null
  /** Why the last attempt failed, cleared by the next one. */
  error: string | null
}

/** Dismiss and restore for needs-attention items. `refresh` re-reads whatever the page shows; it runs after the server accepts the change. */
export function useDismissals(refresh: () => Promise<unknown>): Dismissals {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (item: AttentionItem, call: typeof api.attentionDismiss) => {
      const ref = dismissRef(item)
      if (!ref) return false
      setError(null)
      setBusy(dismissKey(item))
      try {
        await call(ref)
        await refresh()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return false
      } finally {
        setBusy(null)
      }
    },
    [refresh],
  )

  const dismiss = useCallback((item: AttentionItem) => run(item, api.attentionDismiss), [run])
  const restore = useCallback((item: AttentionItem) => run(item, api.attentionRestore), [run])
  return { dismiss, restore, busy, error }
}
