// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { useHideMoney } from '../../lib/privacyPref'
import Toggle from '../ui/Toggle'

/** Replaces every money amount with dots while it is on, so a screen can be shared. Remembered in this browser. */
export default function PrivacyToggle({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const [hidden, setHidden] = useHideMoney()
  return (
    <span title={t('app.hideAmountsHint')} className={className}>
      <Toggle checked={hidden} onChange={setHidden} label={<span className="text-xs text-muted">{t('app.hideAmounts')}</span>} />
    </span>
  )
}
