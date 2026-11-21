// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import type { Summary } from '../lib/api'
import { relativeTime } from '../lib/format'

interface Props {
  summary: Summary | null
  onPoll: () => void
}

export default function TopBar({ summary, onPoll }: Props) {
  const { t } = useTranslation()
  const last = summary?.lastOkPoll
  const failed = summary?.lastPoll?.state === 'error' ? summary.lastPoll : null
  const polling = summary?.polling ?? false
  const rel = last ? relativeTime(last.finishedAt) : null

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
      <h1 className="text-lg font-semibold tracking-tight">
        <span className="text-accent">{t('app.name')}</span>
        {summary && <span className="num ml-2 text-xs font-normal text-muted">{summary.version}</span>}
      </h1>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="text-muted">
          {rel ? t('topbar.lastUpdated', { when: t(`time.${rel.key}`, { count: rel.count }) }) : t('topbar.neverUpdated')}
        </span>
        <button
          type="button"
          onClick={onPoll}
          disabled={polling}
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {polling ? t('topbar.polling') : t('topbar.pollNow')}
        </button>
      </div>
      {failed?.error && (
        <p className="w-full rounded-md bg-warn-bg px-3 py-2 text-sm text-warn" role="alert">
          {t('topbar.pollFailed', { error: failed.error })}
        </p>
      )}
    </header>
  )
}
