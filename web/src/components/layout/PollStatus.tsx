// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { formatTime } from '../../lib/format'
import { useOverview } from '../../hooks/overviewContext'
import HealthDot from '../ui/HealthDot'
import Tooltip from '../ui/Tooltip'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import RelativeTime from '../ui/RelativeTime'

/** Health dots for each data source, each with a tooltip that carries the error and the limits in plain words. */
export function SourceHealth() {
  const { t } = useTranslation('common')
  const { data } = useOverview()
  if (!data) return null
  return (
    <ul className="flex items-center gap-3" aria-label={t('poll.sources')}>
      {data.sources.map((s) => (
        <li key={s.source}>
          <Tooltip
            side="bottom"
            content={
              <span className="block space-y-1">
                <span className="block font-medium">{t(`source.${s.source}`, { defaultValue: s.source })}</span>
                <span className="block text-muted">{s.ok ? t('source.ok') : (s.error ?? t('source.down'))}</span>
                {s.detail && <span className="block text-muted">{s.detail}</span>}
                <span className="block text-faint">
                  {t('poll.lastGood')}: {s.lastOkAt ? formatTime(s.lastOkAt) : t('poll.never')}
                </span>
              </span>
            }
          >
            <Link to="/settings" className="flex items-center gap-1.5 rounded-sm text-xs text-muted hover:text-ink">
              <HealthDot health={s.ok ? 'up' : 'down'} />
              <span>{t(`source.${s.source}`, { defaultValue: s.source })}</span>
            </Link>
          </Tooltip>
        </li>
      ))}
    </ul>
  )
}

/** Last good poll on a 24-hour clock, a failure note when the newest poll failed, and the Poll now button. */
export default function PollStatus({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('common')
  const o = useOverview()
  const ok = o.data?.lastOkPoll
  const failed = o.data?.lastPoll && o.data.lastPoll.state === 'error'
  return (
    <div className="flex items-center gap-3">
      {!compact && (
        <div className="min-w-0 text-right text-xs leading-tight">
          {o.error && !o.data ? (
            <span className="text-bad">{t('poll.unreachable')}</span>
          ) : ok ? (
            <>
              <p className="text-muted">
                {t('poll.lastGood')} <span className="num text-ink">{formatTime(ok.finishedAt)}</span>
              </p>
              <p className="text-faint">
                {failed ? <span className="text-bad">{t('poll.lastFailed')}</span> : <RelativeTime iso={ok.finishedAt} />}
              </p>
            </>
          ) : (
            <span className="text-muted">{o.loading ? '' : t('poll.never')}</span>
          )}
        </div>
      )}
      {o.pollError && (
        <p role="alert" className={compact ? 'fixed inset-x-4 top-16 z-[60] rounded-md border border-bad/50 bg-raised px-3 py-2 text-sm text-bad shadow-e3' : 'max-w-64 text-xs text-bad'}>
          {t('poll.failed', { message: o.pollError })}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {o.polling ? t('poll.polling') : ok ? t('poll.doneAt', { time: formatTime(ok.finishedAt) }) : ''}
      </p>
      <Button
        variant="secondary"
        size="sm"
        icon={o.polling ? undefined : 'refresh'}
        loading={o.polling}
        onClick={() => void o.pollNow()}
        iconOnly={compact}
      >
        {o.polling ? t('poll.polling') : t('poll.now')}
      </Button>
      {!compact && !o.polling && o.refreshing && <Icon name="dot" size={10} className="text-accent" />}
    </div>
  )
}
