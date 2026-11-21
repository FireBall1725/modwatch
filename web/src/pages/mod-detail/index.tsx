// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import HealthDot from '../../components/ui/HealthDot'
import Icon from '../../components/ui/Icon'
import KpiCard from '../../components/ui/KpiCard'
import ModIcon from '../../components/ui/ModIcon'
import PageHeader from '../../components/ui/PageHeader'
import PlatformBadge from '../../components/ui/PlatformBadge'
import ProgressBar from '../../components/ui/ProgressBar'
import RelativeTime from '../../components/ui/RelativeTime'
import Skeleton from '../../components/ui/Skeleton'
import DeltaText from '../../components/ui/DeltaText'
import SeverityBadge from '../../components/ui/SeverityBadge'
import { useApi } from '../../hooks/useApi'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { api, ApiError } from '../../lib/api'
import { cx } from '../../lib/cx'
import { daysBetween, formatCount } from '../../lib/format'
import type { ModDetail } from '../../lib/types'
import DownloadsCard from './DownloadsCard'
import FilesCard from './FilesCard'
import IssuesCard from './IssuesCard'
import PlatformPanel from './PlatformPanel'
import VersionsCard from './VersionsCard'
import { ALL, parsePlatform, parseRange, parseView, type ChartView, type FileFilter, type RangeKey } from './logic'

const LINKS = ['curseforge', 'modrinth', 'github', 'source', 'wiki', 'discord'] as const

function Loading() {
  return (
    <>
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
    </>
  )
}

/** One mod on one page: is anything wrong, what each platform says, downloads, versions, files and issues. */
export default function ModDetailPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation('modDetail')
  const { t: tc } = useTranslation('common')
  const [params, setParams] = useSearchParams()
  const { data, error, loading, reload } = useApi(() => api.mod(slug), [slug], { resetOnChange: true })
  useDocumentTitle(data ? `${data.name} · ${tc('nav.mods')}` : null)

  const range = parseRange(params.get('range'))
  const view = parseView(params.get('view'))
  const filter: FileFilter = { platform: parsePlatform(params.get('platform')), mc: params.get('mc') ?? ALL, type: params.get('type') ?? ALL }
  const showClosed = params.get('closed') === '1'

  const setParam = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(changes)) {
            if (v === null || v === ALL || (k === 'range' && v === '30') || (k === 'view' && v === 'total')) next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const back = (
    <Link to="/mods" className="inline-flex items-center gap-1 text-muted hover:text-ink">
      <Icon name="chevron_left" size={14} />
      {t('back')}
    </Link>
  )

  const missing = useMemo(() => error instanceof ApiError && error.status === 404, [error])
  if (missing) {
    return (
      <>
        <PageHeader title={t('notFound.title')} eyebrow={back} />
        <Card>
          <EmptyState icon="search" title={t('notFound.title')} description={t('notFound.detail', { slug })} action={<Button href="/mods">{t('notFound.action')}</Button>} />
        </Card>
      </>
    )
  }
  if (loading) return <Loading />
  if (!data) {
    return (
      <>
        <PageHeader title={tc('nav.mods')} eyebrow={back} />
        <ErrorState error={error} onRetry={() => void reload()} />
      </>
    )
  }
  return (
    <Detail
      mod={data}
      back={back}
      stale={error}
      onRetry={() => void reload()}
      range={range}
      view={view}
      filter={filter}
      showClosed={showClosed}
      setParam={setParam}
    />
  )
}

interface DetailProps {
  mod: ModDetail
  back: React.ReactNode
  stale: Error | null
  onRetry: () => void
  range: RangeKey
  view: ChartView
  filter: FileFilter
  showClosed: boolean
  setParam: (c: Record<string, string | null>) => void
}

function Detail({ mod, back, stale, onRetry, range, view, filter, showClosed, setParam }: DetailProps) {
  const { t } = useTranslation('modDetail')
  const { t: tc } = useTranslation('common')
  const gh = mod.github
  const oldest = gh?.oldestOpenBugAt ?? null
  const rel = mod.latestRelease
  const d = mod.downloads
  const linkItems = LINKS.filter((k) => mod.links[k])

  return (
    <>
      <PageHeader
        eyebrow={back}
        leading={<ModIcon src={mod.iconUrl} name={mod.name} size={56} />}
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {mod.name}
            <span className="text-sm font-normal">
              <HealthDot health={mod.health} showLabel />
            </span>
          </span>
        }
        description={
          <>
            {mod.summary}
            {!mod.owned && <span className="ml-2 text-faint">{t('owned')}</span>}
          </>
        }
        actions={
          <Button icon="edit" href={`/settings?mod=${encodeURIComponent(mod.slug)}`}>
            {t('editLinks')}
          </Button>
        }
      />

      {linkItems.length > 0 && (
        <nav aria-label={t('links.label')} className="-mt-3 flex flex-wrap gap-2">
          {linkItems.map((k) => (
            <Button key={k} size="sm" variant="ghost" className="min-h-11 border border-line sm:min-h-0" icon={k === 'github' || k === 'source' ? 'github' : 'external'} href={mod.links[k]!}>
              {t(`links.${k}`)}
              <span className="sr-only"> {t('newTab')}</span>
            </Button>
          ))}
        </nav>
      )}

      {stale && <ErrorState compact error={stale} onRetry={onRetry} />}

      <section aria-label={t('verdict.title')} className={cx('rounded-lg border p-4 sm:p-5', mod.attention.length ? (mod.health === 'problem' ? 'border-bad/40 bg-bad-soft' : 'border-review/40 bg-review-soft') : 'border-ok/30 bg-ok-soft')}>
        {mod.attention.length === 0 ? (
          <div className="flex items-start gap-3">
            <Icon name="check" size={20} className="mt-0.5 text-ok" />
            <div>
              <h2 className="text-base font-semibold text-ink">{t('verdict.ok')}</h2>
              <p className="text-sm text-muted">{t('verdict.okDetail')}</p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-base font-semibold text-ink">{t('verdict.attention', { count: mod.attention.length })}</h2>
            <ul className="divide-y divide-line/60">
              {mod.attention.map((a, i) => (
                <li key={`${a.kind}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 first:pt-0 last:pb-0">
                  <SeverityBadge severity={a.severity} size="sm" />
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-sm font-medium text-ink">{a.title}</p>
                    <p className="text-sm text-muted">{a.detail}</p>
                  </div>
                  {a.url && (
                    <Button size="sm" variant="secondary" icon="external" href={a.url}>
                      {t(a.url.includes('github.com') ? 'verdict.openGithub' : a.url.includes('curseforge.com') ? 'verdict.openCurseforge' : a.url.includes('modrinth.com') ? 'verdict.openModrinth' : 'verdict.open')}
                      <span className="sr-only"> {t('newTab')}</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          className="col-span-2 xl:col-span-1"
          label={t('kpi.downloads')}
          icon="downloads"
          value={formatCount(d.total)}
          footer={
            <div className="space-y-2">
              <ProgressBar
                height={6}
                ariaLabel={t('kpi.split', { cf: formatCount(d.curseforge), mr: formatCount(d.modrinth) })}
                segments={[
                  { key: 'curseforge', label: tc('platform.curseforge'), value: d.curseforge, color: 'var(--color-cf)', pattern: 0 },
                  { key: 'modrinth', label: tc('platform.modrinth'), value: d.modrinth, color: 'var(--color-mr)', pattern: 1 },
                ]}
                legend
                format={formatCount}
              />
            </div>
          }
        />
        <KpiCard
          label={t('kpi.day')}
          icon="trend_up"
          value={<DeltaText value={d.delta24h} plain />}
          footer={
            <span>
              {t('kpi.week')} <DeltaText value={d.delta7d} />
            </span>
          }
        />
        <KpiCard
          label={t('kpi.issues')}
          icon="issues"
          tone={gh && (gh.openCrashes > 0 || gh.openBugs > 0) ? 'bad' : undefined}
          value={gh ? formatCount(gh.open) : '–'}
          footer={
            !gh ? (
              <span>{t('issues.noLabel')}</span>
            ) : gh.open === 0 ? (
              <span>{t('kpi.issuesNone')}</span>
            ) : (
              <span className="flex flex-wrap gap-x-3">
                {gh.openCrashes > 0 && <span className="text-bad">{t('kpi.crashes', { count: gh.openCrashes })}</span>}
                {gh.openBugs > 0 && <span className="text-bad">{t('kpi.bugs', { count: gh.openBugs })}</span>}
                {oldest && <span>{t('kpi.oldest', { age: tc('relative.days', { count: Math.max(0, daysBetween(oldest)) }) })}</span>}
              </span>
            )
          }
        />
        <KpiCard
          className="col-span-2 xl:col-span-1"
          label={t('kpi.latest')}
          icon="releases"
          value={<span className="num">{rel ? rel.version : '–'}</span>}
          footer={
            rel ? (
              <span className="flex flex-wrap items-center gap-x-2">
                <PlatformBadge platform={rel.platform} size="sm" />
                <span className="num">{rel.minecraftVersions.join(', ')}</span>
                <RelativeTime iso={rel.publishedAt} />
              </span>
            ) : (
              <span>{t('kpi.noRelease')}</span>
            )
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PlatformPanel platform="curseforge" info={mod.curseforge} slug={mod.slug} />
        <PlatformPanel platform="modrinth" info={mod.modrinth} slug={mod.slug} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <DownloadsCard history={mod.history} range={range} view={view} onRange={(r) => setParam({ range: r })} onView={(v) => setParam({ view: v })} />
        </div>
        <div className="min-w-0">
          <VersionsCard versions={mod.gameVersions} loaders={mod.loaders} />
        </div>
      </div>

      <FilesCard
        files={mod.files}
        filter={filter}
        onFilter={(c) => setParam(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? null])))}
      />

      <IssuesCard
        issues={mod.issues}
        linked={Boolean(gh)}
        allUrl={mod.links.issues}
        slug={mod.slug}
        showClosed={showClosed}
        onShowClosed={(v) => setParam({ closed: v ? '1' : null })}
      />
    </>
  )
}
