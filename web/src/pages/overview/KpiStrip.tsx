// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import DeltaText from './LabelledDelta'
import KpiCard from '../../components/ui/KpiCard'
import ProgressBar from '../../components/ui/ProgressBar'
import { formatCompact, formatCount } from '../../lib/format'
import type { Overview } from '../../lib/types'
import { sourceIsDown } from './logic'

/** Headline numbers: downloads with the platform split, issues, mods needing attention, projects in review. */
export default function KpiStrip({ data }: { data: Overview }) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const { totals, sources } = data
  const d = totals.downloads
  const issuesTone = totals.openCrashes > 0 ? 'bad' : totals.openBugs > 0 ? 'review' : 'ok'
  const attentionTone = data.mods.some((m) => m.health === 'problem') ? 'bad' : totals.needAttention > 0 ? 'review' : 'ok'

  return (
    <section aria-label={t('title')} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
      <KpiCard
        className="col-span-2 lg:col-span-3 xl:col-span-1"
        label={t('kpi.downloads')}
        icon="downloads"
        tone="accent"
        href="/downloads"
        value={formatCount(d.total)}
        footer={
          <div className="space-y-3">
            <ProgressBar
              height={8}
              format={formatCompact}
              legend
              segments={[
                { key: 'cf', label: tc('platform.curseforge'), value: d.curseforge, color: 'var(--color-cf)', pattern: 0 },
                { key: 'mr', label: tc('platform.modrinth'), value: d.modrinth, color: 'var(--color-mr)', pattern: 1 },
              ]}
            />
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <DeltaText value={d.delta24h} suffix={t('kpi.last24h')} />
              <DeltaText value={d.delta7d} suffix={t('kpi.last7d')} />
            </div>
          </div>
        }
      />
      <KpiCard
        className="col-span-2 sm:col-span-1"
        label={t('kpi.issues')}
        icon="issues"
        tone={issuesTone}
        href="/issues"
        value={formatCount(totals.openIssues)}
        footer={
          <span className="flex flex-col gap-0.5">
            {totals.openBugs + totals.openCrashes === 0 ? (
              <span>{t('kpi.noBugs')}</span>
            ) : (
              <span className="flex flex-wrap gap-x-3">
                {totals.openCrashes > 0 && <span className="text-bad">{t('kpi.crashes', { count: totals.openCrashes })}</span>}
                {totals.openBugs > 0 && <span className="text-review">{t('kpi.bugs', { count: totals.openBugs })}</span>}
              </span>
            )}
            {sourceIsDown(sources, 'github') && <span className="text-review">{t('kpi.issuesStale')}</span>}
          </span>
        }
      />
      <KpiCard
        label={t('kpi.attention')}
        icon="warning"
        tone={attentionTone}
        href="/?show=attention"
        value={formatCount(totals.needAttention)}
        unit={t('kpi.ofMods', { count: totals.mods })}
        footer={totals.needAttention === 0 ? t('kpi.attentionNone') : undefined}
      />
      <KpiCard
        label={t('kpi.review')}
        icon="in_review"
        tone={totals.inReview > 0 ? 'review' : 'ok'}
        href="/releases"
        value={formatCount(totals.inReview)}
        footer={totals.inReview === 0 ? t('kpi.reviewNone') : t('kpi.reviewSome', { count: totals.inReview })}
      />
    </section>
  )
}
