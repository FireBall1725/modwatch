// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import ErrorState from '../../components/ui/ErrorState'
import PageHeader from '../../components/ui/PageHeader'
import { useApi } from '../../hooks/useApi'
import { useDismissals } from '../../hooks/useDismissals'
import { useOverview } from '../../hooks/overviewContext'
import { api } from '../../lib/api'
import { relativeTime } from '../../lib/format'
import type { AttentionItem } from '../../lib/types'
import AttentionList from './AttentionList'
import KpiStrip from './KpiStrip'
import ModGrid from './ModGrid'
import RecentReleases from './RecentReleases'
import OverviewSkeleton from './Skeleton'
import StatusBanner from './StatusBanner'
import SetupBanner from './SetupBanner'
import VersionsCard from './VersionsCard'
import { groupAttention, parseView, verdict, viewToParams, withoutLegacyNewest, type ViewState } from './logic'

export default function OverviewPage() {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const { data, error, loading, reload, pollNow } = useOverview()
  const dismissals = useDismissals(reload)
  const onDismiss = useCallback(
    async (item: AttentionItem) => {
      // The row is gone after this, so focus moves to the list instead of falling back to the page.
      if (await dismissals.dismiss(item)) document.getElementById('needs-attention-body')?.focus({ preventScroll: true })
    },
    [dismissals],
  )
  const history = useApi(() => api.downloadsHistory(30), [])
  const [params, setParams] = useSearchParams()
  const view = useMemo(() => parseView(params), [params])

  const onView = useCallback(
    (patch: Partial<ViewState>) => {
      setParams(viewToParams({ ...parseView(params), ...patch }), { replace: true })
    },
    [params, setParams],
  )

  const groups = useMemo(() => groupAttention(withoutLegacyNewest(data?.attention ?? [], data?.mods ?? [])), [data])
  const versions = useApi(() => api.versions(), [])

  const header = (description?: string) => <PageHeader title={t('title')} description={description} />

  if (loading && !data) {
    return (
      <>
        {header()}
        <OverviewSkeleton />
      </>
    )
  }
  if (!data) {
    return (
      <>
        {header()}
        <ErrorState title={t('error.title')} error={error} onRetry={() => void reload()} />
      </>
    )
  }

  const lastOk = data.lastOkPoll
  let when = ''
  if (lastOk) {
    const r = relativeTime(lastOk.finishedAt)
    when = r.key === 'justNow' ? tc('relative.justNow') : tc(`relative.${r.key}`, { count: r.count })
  }
  const description = lastOk ? t('subtitle', { count: data.totals.mods, when }) : t('subtitleNever')

  const setupProblems = [...data.problems, ...data.sources.filter((s) => s.ok && s.detail && s.source === 'modrinth').map((s) => s.detail as string)]
  const sourceNotes = data.sources.filter((s) => s.ok && s.detail && s.source !== 'modrinth').map((s) => s.detail as string)

  return (
    <>
      {header(description)}
      {error && (
        <p role="alert" className="rounded-md border border-review/40 bg-review-soft/40 px-3 py-2 text-sm text-ink">
          {t('stale', { message: error.message })}
        </p>
      )}
      <SetupBanner problems={setupProblems} />
      <StatusBanner
        verdict={verdict(groups, setupProblems.length)}
        groups={groups}
        setupProblemCount={setupProblems.length}
        sourceNotes={sourceNotes}
        modCount={data.totals.mods}
        sources={data.sources}
      />
      <KpiStrip data={data} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:order-1">
          <AttentionList
            groups={groups}
            notesOpen={view.notes}
            onToggleNotes={() => onView({ notes: !view.notes })}
            dismissed={data.dismissed}
            dismissals={dismissals}
            onDismiss={(item) => void onDismiss(item)}
          />
          <VersionsCard versions={versions.data} loading={versions.loading} />
          <div className="hidden xl:block">
            <RecentReleases releases={data.recentReleases} />
          </div>
        </div>
        <div className="min-w-0 xl:order-2">
          <ModGrid
            mods={data.mods}
            history={history.data}
            view={view}
            onView={onView}
            onPollNow={() => void pollNow()}
            hasPolled={data.lastPoll !== null}
          />
        </div>
        <div className="xl:hidden">
          <RecentReleases releases={data.recentReleases} />
        </div>
      </div>
    </>
  )
}
