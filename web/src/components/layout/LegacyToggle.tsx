// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { useOverview } from '../../hooks/overviewContext'
import { useShowLegacy } from '../../lib/legacyPref'
import Toggle from '../ui/Toggle'

/** Switches mods marked legacy in or out of every list and chart. Hidden while no mod is legacy, unless it is on, so it can always be turned off. */
export default function LegacyToggle({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const [show, setShow] = useShowLegacy()
  const { data } = useOverview()
  const count = data?.totals.legacyMods ?? 0
  if (count === 0 && !show) return null
  return (
    <span title={t('app.showLegacyHint')} className={className}>
      <Toggle checked={show} onChange={setShow} label={<span className="text-xs text-muted">{t('app.showLegacy', { count })}</span>} />
    </span>
  )
}
