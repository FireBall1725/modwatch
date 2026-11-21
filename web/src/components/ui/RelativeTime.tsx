// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { formatDateTime, NO_VALUE, relativeTime } from '../../lib/format'

/** "12 minutes ago" for a timestamp, with the exact date and 24-hour time as a tooltip and a <time> element. Props: iso (null shows a dash). */
export default function RelativeTime({ iso }: { iso: string | null | undefined }) {
  const { t } = useTranslation('common')
  if (!iso) return <span className="text-faint">{NO_VALUE}</span>
  const r = relativeTime(iso)
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {r.key === 'justNow' ? t('relative.justNow') : t(`relative.${r.key}`, { count: r.count })}
    </time>
  )
}
