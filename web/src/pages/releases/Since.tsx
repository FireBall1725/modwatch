// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import ModIcon from '../../components/ui/ModIcon'
import Skeleton from '../../components/ui/Skeleton'
import { cx } from '../../lib/cx'
import { formatDate } from '../../lib/format'
import { STALE_DAYS, type SinceRow } from './logic'

interface Props {
  rows: SinceRow[] | null
  error: Error | null
  onRetry: () => void
}

/** Days since each owned mod last shipped, as bars on one shared scale. */
export default function Since({ rows, error, onRetry }: Props) {
  const { t } = useTranslation('releases')
  const max = Math.max(STALE_DAYS, ...(rows ?? []).map((r) => r.days ?? 0))
  return (
    <Card title={t('since.title')} description={t('since.description', { days: STALE_DAYS })} className="min-w-0">
      {error && !rows ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : !rows ? (
        <div className="flex flex-col gap-4" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState compact title={t('since.empty')} icon="releases" />
      ) : (
        <ol aria-label={t('since.caption')} className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.slug} className="flex items-start gap-3">
              <ModIcon src={r.iconUrl} name={r.name} size={28} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <Link to={`/mods/${r.slug}`} className="min-w-0 truncate text-sm text-ink hover:text-accent">
                    {r.name}
                  </Link>
                  <span className={cx('num shrink-0 text-sm font-medium', r.freshness === 'stale' ? 'text-review' : r.freshness === 'none' ? 'text-faint' : 'text-ink')}>
                    {r.days === null ? t('since.none') : r.days === 0 ? t('since.today') : t('since.days', { count: r.days })}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-sunk" aria-hidden="true">
                  <div
                    className={cx('h-full rounded-full', r.freshness === 'stale' ? 'bg-review' : 'bg-accent')}
                    style={{ width: `${r.days === null ? 0 : Math.max(2, Math.round((r.days / max) * 100))}%` }}
                  />
                </div>
                {(r.freshness === 'stale' || r.at) && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {r.freshness === 'stale' && <span className="font-medium text-review">{t('since.stale')}</span>}
                    {r.at && <span>{formatDate(r.at)}</span>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
