// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { formatDelta, NO_VALUE } from '../../lib/format'
import Icon from './Icon'

interface Props {
  value: number | null | undefined
  /** Text after the number, such as "24h". */
  suffix?: string
  /** Hide the arrow. */
  plain?: boolean
  className?: string
}

/** Signed movement: green up with an arrow, red down, muted zero, a dash with a hidden "not available yet" (and the same suffix) when unknown. Props: value, suffix, plain, className. */
export default function DeltaText({ value, suffix, plain = false, className }: Props) {
  const { t } = useTranslation('common')
  if (value === null || value === undefined) {
    return (
      <span className={cx('num inline-flex items-center whitespace-nowrap text-faint', className)}>
        <span aria-hidden="true">{NO_VALUE}</span>
        <span className="sr-only">{t('word.notAvailable')}</span>
        {suffix && <span className="ml-1 font-sans text-xs">{suffix}</span>}
      </span>
    )
  }
  const tone = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-muted'
  return (
    <span className={cx('num inline-flex items-center gap-0.5 whitespace-nowrap', tone, className)}>
      {!plain && value !== 0 && <Icon name={value > 0 ? 'arrow_up' : 'arrow_down'} size={12} />}
      {formatDelta(value)}
      {suffix && <span className="ml-1 font-sans text-xs text-faint">{suffix}</span>}
    </span>
  )
}
