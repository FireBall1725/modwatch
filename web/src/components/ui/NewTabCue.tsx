// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'

/** Visually hidden "(opens in a new tab)" for any link with target="_blank". Put it inside the link, after its text. */
export default function NewTabCue() {
  const { t } = useTranslation('common')
  return <span className="sr-only"> {t('newTab')}</span>
}
