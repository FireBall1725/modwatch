// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { useOverview } from '../../hooks/overviewContext'

/** Version line at the bottom of every page. The server's version when known, the build's own otherwise. */
export default function Footer() {
  const { t } = useTranslation('common')
  const { data } = useOverview()
  return (
    <footer className="border-t border-line px-[var(--gutter)] py-4 text-xs text-faint">
      <span>
        Modwatch <span className="num text-muted">{data?.version ?? __APP_VERSION__}</span>
      </span>
      <span aria-hidden="true"> · </span>
      <span>{t('app.tagline')}</span>
    </footer>
  )
}
