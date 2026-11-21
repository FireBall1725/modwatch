// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { IconName } from '../../components/ui/Icon'
import type { Tone } from '../../components/ui/Pill'
import type { IssueKind } from '../../lib/types'

export const KIND_TONE: Record<IssueKind, Tone> = {
  crash: 'bad',
  bug: 'review',
  compatibility: 'info',
  enhancement: 'accent',
  question: 'neutral',
  other: 'inactive',
}

export const KIND_ICON: Record<IssueKind, IconName> = {
  crash: 'crash',
  bug: 'bug',
  compatibility: 'compatibility',
  enhancement: 'enhancement',
  question: 'question',
  other: 'info',
}

export const KIND_COLOR: Record<IssueKind, string> = {
  crash: 'var(--color-bad)',
  bug: 'var(--color-review)',
  compatibility: 'var(--color-info)',
  enhancement: 'var(--color-accent)',
  question: 'var(--color-neutral)',
  other: 'var(--color-inactive)',
}
