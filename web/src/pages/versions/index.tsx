// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import TimeSeriesChart from '../../components/charts/TimeSeriesChart'
import BarList, { type BarItem } from '../../components/charts/BarList'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Icon from '../../components/ui/Icon'
import KpiCard from '../../components/ui/KpiCard'
import ModIcon from '../../components/ui/ModIcon'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import SegmentedControl from '../../components/ui/SegmentedControl'
import Skeleton from '../../components/ui/Skeleton'
import Toggle from '../../components/ui/Toggle'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatCompact, formatCount } from '../../lib/format'
import type { VersionTotal, Versions } from '../../lib/types'
import Matrix from './Matrix'
import {
  type MatrixSpan,
  type PageState,
  type RangeDays,
  type SortMode,
  coverage,
  dailyByVersion,
  filterRows,
  gapRows,
  newestCell,
  parseState,
  seriesTotal,
  serializeState,
  sortLoaders,
  sortTotals,
  topVersion,
  visibleVersions,
  RECENT_VERSIONS,
} from './logic'

const PARTS = (v: VersionTotal, cf: string, mr: string) => [
  { key: 'cf', label: cf, value: v.curseforge, color: 'var(--color-cf)' },
  { key: 'mr', label: mr, value: v.modrinth, color: 'var(--color-mr)' },
]

/** Minecraft versions page: downloads by version and loader, per day by version, and the mod by version matrix. */
export default function VersionsPage() {
  const { t } = useTranslation('versions')
  const { t: tc } = useTranslation('common')
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseState(params), [params])
  const patch = (p: Partial<PageState>) => setParams(serializeState({ ...state, ...p }), { replace: true })
  const { data, error, loading, reload } = useApi(() => api.versions(), [])

  const head = <PageHeader title={tc('nav.versions')} description={t('description')} />
  if (loading) return <>{head}<LoadingView /></>
  if (!data) return <>{head}<ErrorState error={error ?? undefined} onRetry={() => void reload()} /></>
  if (data.gameVersions.length === 0 && data.matrix.rows.length === 0)
    return <>{head}<EmptyState icon="versions" title={t('empty.title')} description={t('empty.text')} /></>
  return (
    <>
      {head}
      {error && <ErrorState compact error={error} onRetry={() => void reload()} />}
      <Content data={data} state={state} patch={patch} />
    </>
  )
}

function Content({ data, state, patch }: { data: Versions; state: PageState; patch: (p: Partial<PageState>) => void }) {
  const { t } = useTranslation('versions')
  const { t: tc } = useTranslation('common')
  const [allGaps, setAllGaps] = useState(false)
  const latest = data.latestMinecraft
  const rows = data.matrix.rows
  const cov = coverage(rows, latest)
  const gaps = gapRows(rows, latest)
  const top = topVersion(data.gameVersions)
  const topLoader = sortLoaders(data.loaders)[0] ?? null
  const latestTotal = data.gameVersions.find((v) => v.name === latest)
  const cf = tc('platform.curseforge')
  const mr = tc('platform.modrinth')

  const versionItems: BarItem[] = sortTotals(data.gameVersions, state.sort).map((v) => ({
    key: v.name,
    label: <span className={v.name === latest ? 'num text-accent' : 'num'}>{v.name}</span>,
    value: v.downloads,
    parts: PARTS(v, cf, mr),
    trailing: (
      <span className="num" title={formatCount(v.downloads)}>
        <span className="mr-2 hidden text-xs text-muted sm:inline">{cf} {formatCompact(v.curseforge)} · {mr} {formatCompact(v.modrinth)}</span>
        {formatCompact(v.downloads)}
      </span>
    ),
  }))
  const loaderItems: BarItem[] = sortLoaders(data.loaders).map((v) => ({
    key: v.name,
    label: <span className="capitalize">{v.name}</span>,
    value: v.downloads,
    parts: PARTS(v, cf, mr),
  }))

  const daily = useMemo(() => dailyByVersion(data.history, state.range), [data.history, state.range])
  const chartSeries = daily.series.map((s, i) => ({
    key: s.key,
    label: s.key === 'other' ? t('chart.other') : s.key,
    color: s.key === 'other' ? '#958ea2' : `var(--color-s${(i % 8) + 1})`,
    values: s.values,
  }))

  const columns = visibleVersions(data.matrix.versions, state.span).map((v) => ({ key: v, label: v }))
  const shownRows = filterRows(rows, state.query, state.gapsOnly, latest)
  const hasMoreVersions = data.matrix.versions.length > RECENT_VERSIONS

  return (
    <>
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={cov.total > 0 && cov.have < cov.total ? 'warning' : 'check'}
          tone={cov.total > 0 && cov.have < cov.total ? 'review' : 'ok'}
          label={t('kpi.newest')}
          value={<span className="num">{latest ?? tc('table.empty')}</span>}
          footer={latest ? t('kpi.coverage', { count: cov.total, have: cov.have, total: cov.total }) : undefined}
        />
        <KpiCard
          icon="downloads"
          label={t('kpi.onNewest')}
          value={<span className="num">{latestTotal ? formatCompact(latestTotal.downloads) : '–'}</span>}
          footer={latestTotal ? <SplitFooter v={latestTotal} cf={cf} mr={mr} /> : t('kpi.noFiles')}
        />
        <KpiCard
          icon="trend_up"
          label={t('kpi.top')}
          value={<span className="num">{top?.name ?? '–'}</span>}
          footer={top ? <SplitFooter v={top} cf={cf} mr={mr} /> : undefined}
        />
        <KpiCard
          icon="package"
          label={t('kpi.topLoader')}
          value={<span className="capitalize">{topLoader?.name ?? '–'}</span>}
          footer={topLoader ? <SplitFooter v={topLoader} cf={cf} mr={mr} /> : undefined}
        />
      </div>

      {latest && (
        <Card
          title={t('gaps.title', { version: latest })}
          description={gaps.length ? t('gaps.some', { count: gaps.length, total: cov.total, version: latest }) : t('gaps.none', { version: latest })}
        >
          {gaps.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ok">
              <Icon name="check" size={16} />
              {t('gaps.allCovered')}
            </p>
          ) : (
            <ul id="gap-list" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {(allGaps ? gaps : gaps.slice(0, 8)).map((r) => {
                const n = newestCell(r)
                return (
                  <li key={r.slug}>
                    <Link to={`/mods/${r.slug}`} className="flex items-center gap-3 rounded-md border border-line bg-sunk px-3 py-2 hover:border-line-strong">
                      <ModIcon src={r.iconUrl} name={r.name} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                        <span className="num block text-xs text-muted">{n ? t('gaps.newestFile', { version: n }) : t('gaps.noFiles')}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {gaps.length > 8 && (
            <button type="button" onClick={() => setAllGaps(!allGaps)} aria-expanded={allGaps} aria-controls="gap-list" className="mt-3 text-sm text-accent hover:underline">
              {allGaps ? tc('word.showFewer') : tc('word.showAll', { count: gaps.length })}
            </button>
          )}
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="min-w-0 xl:col-span-2"
          title={t('byVersion.title')}
          description={t('byVersion.note')}
          actions={
            <SegmentedControl<SortMode>
              size="sm"
              label={t('sort.label')}
              value={state.sort}
              onChange={(sort) => patch({ sort })}
              options={[
                { value: 'version', label: t('sort.version') },
                { value: 'downloads', label: t('sort.downloads') },
              ]}
            />
          }
        >
          <PlatformKey cf={cf} mr={mr} />
          <BarList items={versionItems} topN={14} ariaLabel={t('byVersion.title')} />
        </Card>
        <Card className="min-w-0" title={t('byLoader.title')}>
          <PlatformKey cf={cf} mr={mr} />
          <BarList items={loaderItems} topN={8} format={formatCompact} ariaLabel={t('byLoader.title')} />
        </Card>
      </div>

      <Card
        className="min-w-0"
        title={t('daily.title')}
        description={t('daily.description')}
        actions={
          <SegmentedControl<RangeDays>
            size="sm"
            label={tc('range.label')}
            value={state.range}
            onChange={(range) => patch({ range })}
            options={[
              { value: 7, label: tc('range.days_7') },
              { value: 30, label: tc('range.days_30') },
              { value: 90, label: tc('range.days_90') },
            ]}
          />
        }
      >
        {seriesTotal(daily) === 0 ? (
          <EmptyState compact icon="calendar" title={tc('chart.noData')} description={tc('word.noHistory')} />
        ) : (
          <div className="relative overflow-hidden">
            <TimeSeriesChart kind="bar" stacked x={daily.x} series={chartSeries} height={300} caption={t('daily.caption', { days: state.range })} />
          </div>
        )}
      </Card>

      <Card
        className="min-w-0"
        title={t('matrix.title')}
        description={t('matrix.description')}
        actions={
          hasMoreVersions ? (
            <SegmentedControl<MatrixSpan>
              size="sm"
              label={t('matrix.spanLabel')}
              value={state.span}
              onChange={(span) => patch({ span })}
              options={[
                { value: 'recent', label: t('matrix.recent', { count: RECENT_VERSIONS }) },
                { value: 'all', label: t('matrix.all') },
              ]}
            />
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <SearchInput className="w-full sm:w-64" value={state.query} onChange={(query) => patch({ query })} placeholder={t('matrix.search')} />
          {latest && <Toggle checked={state.gapsOnly} onChange={(gapsOnly) => patch({ gapsOnly })} label={t('matrix.gapsOnly', { version: latest })} />}
          <span className="num ml-auto text-xs text-muted" aria-live="polite">
            {t('matrix.count', { count: rows.length, shown: shownRows.length, total: rows.length })}
          </span>
        </div>
        {shownRows.length === 0 ? (
          <EmptyState compact icon="search" title={t('matrix.none')} action={undefined} />
        ) : (
          <Matrix
            caption={t('matrix.title')}
            emptyLabel={t('matrix.noFile')}
            highlightColumn={latest ?? undefined}
            columns={columns}
            rows={shownRows.map((r) => ({
              key: r.slug,
              name: r.name,
              label: (
                <Link to={`/mods/${r.slug}`} className="flex items-center gap-2 hover:underline">
                  <ModIcon src={r.iconUrl} name={r.name} size={20} />
                  <span className="truncate">{r.name}</span>
                </Link>
              ),
            }))}
            value={(slug, v) => rows.find((r) => r.slug === slug)?.cells[v]?.downloads}
          />
        )}
      </Card>
    </>
  )
}

function SplitFooter({ v, cf, mr }: { v: VersionTotal; cf: string; mr: string }) {
  return (
    <span className="num text-xs text-muted">
      {cf} {formatCompact(v.curseforge)} · {mr} {formatCompact(v.modrinth)}
    </span>
  )
}

function PlatformKey({ cf, mr }: { cf: string; mr: string }) {
  return (
    <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cf" />{cf}</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-mr" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgb(0 0 0 / 0.28) 0 2px, transparent 2px 5px)' }} />{mr}</span>
    </p>
  )
}

function LoadingView() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <KpiCard key={i} loading label="" value="" />)}
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-96 w-full xl:col-span-2" />
        <Skeleton className="h-96 w-full" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}
