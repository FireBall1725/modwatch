// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import type { Health } from '../../lib/types'

type Kind = Health | 'up' | 'down'

const COLOR: Record<Kind, string> = {
  ok: 'bg-ok',
  up: 'bg-ok',
  attention: 'bg-review',
  problem: 'bg-bad',
  down: 'bg-bad',
}

interface Props {
  /** A mod's health, or up and down for a data source. */
  health: Kind
  /** Draws the word next to the dot. Without it the word is a tooltip and a screen reader label. */
  showLabel?: boolean
  className?: string
}

/** Coloured dot plus a shape cue (ok is a filled disc, attention a diamond, problem a square) and a name. Props: health, showLabel, className. */
export default function HealthDot({ health, showLabel = false, className }: Props) {
  const { t } = useTranslation('common')
  const label = t(`health.${health}`)
  const shape = health === 'attention' ? 'rotate-45 rounded-[2px]' : health === 'problem' || health === 'down' ? 'rounded-[2px]' : 'rounded-full'
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs text-muted', className)} title={showLabel ? undefined : label}>
      <span aria-hidden="true" className={cx('inline-block size-2.5', COLOR[health], shape)} />
      <span className={showLabel ? undefined : 'sr-only'}>{label}</span>
    </span>
  )
}
