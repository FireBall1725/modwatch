// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import Icon from './Icon'

/** A quiet one-line note for pages that list per-file download numbers: CurseForge counts each file on its own. */
export default function PartialCountsNote({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  return (
    <p className={cx('flex items-start gap-1.5 text-xs text-muted', className)}>
      <Icon name="info" size={14} className="mt-0.5 shrink-0 text-faint" />
      <span className="min-w-0">{t('word.partialCounts')}</span>
    </p>
  )
}
