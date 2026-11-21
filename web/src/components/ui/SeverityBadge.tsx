// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import type { Severity } from '../../lib/types'
import Pill, { type Tone } from './Pill'
import type { IconName } from './Icon'

const MAP: Record<Severity, { tone: Tone; icon: IconName }> = {
  problem: { tone: 'bad', icon: 'problem' },
  warning: { tone: 'review', icon: 'warning' },
  info: { tone: 'info', icon: 'info' },
}

/** Severity of an attention item: word, icon and colour. Props: severity, size. */
export default function SeverityBadge({ severity, size = 'md' }: { severity: Severity; size?: 'sm' | 'md' }) {
  const { t } = useTranslation('common')
  const { tone, icon } = MAP[severity]
  return (
    <Pill tone={tone} icon={icon} size={size}>
      {t(`severity.${severity}`)}
    </Pill>
  )
}
