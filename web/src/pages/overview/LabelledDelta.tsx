// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import DeltaText from '../../components/ui/DeltaText'
import { NO_VALUE } from '../../lib/format'

/** DeltaText that keeps its window label when there is no history yet, so a dash never stands alone. */
export default function LabelledDelta({ value, suffix }: { value: number | null | undefined; suffix?: string }) {
  const { t } = useTranslation('common')
  if (value === null || value === undefined) {
    return (
      <span className="num whitespace-nowrap text-faint" title={t('word.noHistory')}>
        {NO_VALUE}
        {suffix && <span className="ml-1 font-sans text-xs">{suffix}</span>}
      </span>
    )
  }
  return <DeltaText value={value} suffix={suffix} />
}
