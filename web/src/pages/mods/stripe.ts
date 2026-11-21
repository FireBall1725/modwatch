// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { Health } from '../../lib/types'

/** Left edge colour that marks a row's health at a glance. */
export const STRIPE: Record<Health, string> = {
  ok: 'border-l-transparent',
  attention: 'border-l-review',
  problem: 'border-l-bad',
}
