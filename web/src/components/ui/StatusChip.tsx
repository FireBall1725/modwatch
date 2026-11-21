// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import type { ReviewStatus } from '../../lib/types'
import Pill, { type Tone } from './Pill'

const STATUS_TONE: Record<ReviewStatus, Tone> = {
  approved: 'ok',
  in_review: 'review',
  changes_required: 'bad',
  rejected: 'bad',
  draft: 'neutral',
  unlisted: 'neutral',
  archived: 'inactive',
  inactive: 'inactive',
  unknown: 'inactive',
}

interface Props {
  status: ReviewStatus
  size?: 'sm' | 'md'
  /** The platform's own word, shown as a tooltip. */
  rawStatus?: string
}

/** Review state as a word, an icon and a colour, for every ReviewStatus. Props: status, size, rawStatus (tooltip). */
export default function StatusChip({ status, size = 'md', rawStatus }: Props) {
  const { t } = useTranslation('common')
  return (
    <Pill tone={STATUS_TONE[status]} icon={status} size={size} title={rawStatus}>
      {t(`status.${status}`)}
    </Pill>
  )
}
