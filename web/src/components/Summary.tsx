// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import type { Totals } from '../lib/api'
import { formatCount, formatDelta } from '../lib/format'

function Card({ label, value, tone, hint }: { label: string; value: string; tone?: 'up' | 'down'; hint?: string }) {
  const colour = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink'
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`num mt-1 text-2xl font-medium ${colour}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function tone(n: number | null): 'up' | 'down' | undefined {
  if (n === null || n === 0) return undefined
  return n > 0 ? 'up' : 'down'
}

export default function Summary({ totals }: { totals: Totals }) {
  const { t } = useTranslation()
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('summary.downloads')}>
      <Card label={t('summary.downloads')} value={formatCount(totals.downloads)} />
      <Card
        label={t('summary.day')}
        value={formatDelta(totals.delta24h)}
        tone={tone(totals.delta24h)}
        hint={totals.delta24h === null ? t('summary.noDelta') : undefined}
      />
      <Card
        label={t('summary.week')}
        value={formatDelta(totals.delta7d)}
        tone={tone(totals.delta7d)}
        hint={totals.delta7d === null ? t('summary.noDelta') : undefined}
      />
      <Card label={t('summary.mods')} value={formatCount(totals.mods)} />
    </section>
  )
}
