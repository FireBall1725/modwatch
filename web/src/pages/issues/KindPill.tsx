// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import Pill from '../../components/ui/Pill'
import type { IssueKind } from '../../lib/types'
import { KIND_ICON, KIND_TONE } from './kinds'

/** Issue kind as a toned pill with an icon and the word. */
export default function KindPill({ kind, size = 'sm' }: { kind: IssueKind; size?: 'sm' | 'md' }) {
  const { t } = useTranslation('common')
  return (
    <Pill tone={KIND_TONE[kind]} icon={KIND_ICON[kind]} size={size}>
      {t(`issueKind.${kind}`)}
    </Pill>
  )
}
