// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { TFunction } from 'i18next'
import { relativeTime } from './format'

/** "just now", "5 minutes ago", "3 months ago", "12 years ago" for a timestamp. t must be the common namespace's. */
export function relativeLabel(t: TFunction<'common'>, iso: string, now: Date = new Date()): string {
  const r = relativeTime(iso, now)
  return r.key === 'justNow' ? t('relative.justNow') : t(`relative.${r.key}`, { count: r.count })
}
