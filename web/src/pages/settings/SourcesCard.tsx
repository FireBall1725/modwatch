// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { useOverview } from '../../hooks/overviewContext'
import Card from '../../components/ui/Card'
import HealthDot from '../../components/ui/HealthDot'
import RelativeTime from '../../components/ui/RelativeTime'
import Skeleton from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import { formatDateTime } from '../../lib/format'

/** Each source with its last success, its error and the limits it runs under, failing ones first. */
export default function SourcesCard() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { data, loading } = useOverview()
  const sources = data ? [...data.sources].sort((a, b) => Number(a.ok) - Number(b.ok)) : []
  return (
    <Card title={t('sources.title')} id="sources" padded={false}>
      {loading ? (
        <div className="space-y-4 p-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : sources.length === 0 ? (
        <EmptyState compact title={t('sources.empty')} icon="info" />
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {sources.map((s) => (
            <li key={s.source} className="space-y-2 px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <HealthDot health={s.ok ? 'up' : 'down'} />
                  {tc(`source.${s.source}`, { defaultValue: s.source })}
                </span>
                <span className={s.ok ? 'text-xs text-ok' : 'text-xs font-medium text-bad'}>{s.ok ? t('sources.up') : t('sources.down')}</span>
              </div>
              {!s.ok && s.error && (
                <p className="flex gap-2 rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-ink">
                  <Icon name="problem" size={16} className="mt-0.5 shrink-0 text-bad" />
                  <span className="min-w-0 break-words">{s.error}</span>
                </p>
              )}
              {s.detail && <p className="text-sm text-muted">{s.detail}</p>}
              <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
                <div className="flex gap-1.5">
                  <dt>{t('sources.lastOk')}</dt>
                  <dd className={s.ok ? 'num text-muted' : 'num text-sm font-medium text-ink'} title={s.lastOkAt ? formatDateTime(s.lastOkAt) : undefined}>
                    {s.lastOkAt ? <RelativeTime iso={s.lastOkAt} /> : t('sources.never')}
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>{t('sources.checked')}</dt>
                  <dd className="num text-muted">
                    <RelativeTime iso={s.checkedAt} />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
