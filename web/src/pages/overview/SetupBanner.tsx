// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'

/** Setup problems, such as a missing token. Shown above everything else on the page, with a link to Settings. */
export default function SetupBanner({ problems }: { problems: string[] }) {
  const { t } = useTranslation('overview')
  if (problems.length === 0) return null
  return (
    <section aria-labelledby="overview-setup" role="alert" className="rounded-lg border-2 border-bad/60 bg-bad-soft/50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bad-soft text-bad">
          <Icon name="problem" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="overview-setup" className="text-base font-semibold text-ink">
            {t('setup.title', { count: problems.length })}
          </h2>
          <ul className="mt-1.5 space-y-1 text-sm text-ink">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Link
            to="/settings"
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-md border border-bad/50 bg-surface px-3 text-sm font-medium text-ink hover:border-bad hover:bg-sunk"
          >
            {t('setup.open')}
            <Icon name="arrow_right" size={14} />
          </Link>
        </div>
      </div>
    </section>
  )
}
