// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { AttentionItem, AttentionRef } from '../../lib/types'

/** What to send to dismiss or restore an item, or null when it can't be: not dismissible, or no mod to key it on. */
export function dismissRef(item: AttentionItem): AttentionRef | null {
  if (!item.dismissible || !item.modSlug) return null
  return { kind: item.kind, modSlug: item.modSlug }
}

/** One key per dismissed kind and mod, the same grain the server dismisses at. */
export function dismissKey(item: Pick<AttentionItem, 'kind' | 'modSlug'>): string {
  return `${item.kind}|${item.modSlug ?? ''}`
}
