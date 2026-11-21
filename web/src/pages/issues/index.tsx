// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import BarList, { type BarItem } from '../../components/charts/BarList'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Icon from '../../components/ui/Icon'
import KpiCard from '../../components/ui/KpiCard'
import PageHeader from '../../components/ui/PageHeader'
import SearchInput from '../../components/ui/SearchInput'
import SegmentedControl from '../../components/ui/SegmentedControl'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import { api } from '../../lib/api'
import { NO_VALUE, relativeTime } from '../../lib/format'
import type { Issues } from '../../lib/types'
import { useApi } from '../../hooks/useApi'
import IssueList from './IssueList'
import { KIND_COLOR, KIND_ICON } from './kinds'
import Verdict from './Verdict'
import {
  AGES,
  KINDS,
  NO_MOD,
  UNCLAIMED,
  activeFilterCount,
  filterIssues,
  modOptions,
  oldestOpenProblem,
  parseFilters,
  serializeFilters,
  sortIssues,
  splitOpen,
  unclaimedLabels,
  type Filters,
} from './logic'

/** Whole days with the same rounding RelativeTime uses, so the KPI and the list agree. */
function oldestDays(iso: string): number {
  const r = relativeTime(iso)
  return r.key === 'days' ? r.count : 0
}

function PageSkeleton() {
  return (
    <>
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
    </>
  )
}

/** Open issues across all mods: the verdict first, then counts, then a filterable list whose filters live in the URL. */
export default function IssuesPage() {
  const { t } = useTranslation('issues')
  const { t: tc } = useTranslation('common')
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const setFilters = useCallback((patch: Partial<Filters>) => setParams(serializeFilters({ ...filters, ...patch }), { replace: true }), [filters, setParams])

  const open = useApi<Issues>(() => api.issues('open'), [])
  const other = useApi<Issues | null>(() => (filters.state === 'open' ? Promise.resolve(null) : api.issues(filters.state)), [filters.state])

  if (open.loading) {
    return (
      <>
        <PageHeader title={t('title')} />
        <PageSkeleton />
      </>
    )
  }
  if (!open.data) {
    return (
      <>
        <PageHeader title={t('title')} />
        <ErrorState title={t('error.title')} error={open.error} onRetry={open.reload} />
      </>
    )
  }

  const { summary, repo } = open.data
  const openIssues = open.data.issues
  const listLoading = filters.state !== 'open' && (other.loading || !other.data)
  const source = filters.state === 'open' ? openIssues : (other.data?.issues ?? [])
  const shown = sortIssues(filterIssues(source, filters))
  const oldest = oldestOpenProblem(openIssues)
  const unclaimed = unclaimedLabels(openIssues)
  const mods = modOptions(source)
  const filterCount = activeFilterCount(filters)
  const modsWithIssues = summary.byMod.length

  const byMod: BarItem[] = summary.byMod.map((m) => {
    const s = splitOpen(m)
    return {
      key: m.slug,
      label: m.name,
      value: m.open,
      href: `/issues?mod=${encodeURIComponent(m.slug)}`,
      parts: [
        { key: 'crash', label: t('byMod.crashes', { count: s.crashes }), value: s.crashes, color: 'var(--color-bad)' },
        { key: 'bug', label: t('byMod.bugs', { count: s.bugs }), value: s.bugs, color: 'var(--color-review)' },
        { key: 'other', label: t('byMod.other'), value: s.other, color: 'var(--color-neutral)' },
      ].filter((p) => p.value > 0),
      trailing: (
        <span className="num inline-flex items-center gap-2">
          {s.crashes > 0 && (
            <span className="inline-flex items-center gap-0.5 text-bad">
              <Icon name="crash" size={12} />
              {s.crashes}
            </span>
          )}
          {s.bugs > 0 && (
            <span className="inline-flex items-center gap-0.5 text-review">
              <Icon name="bug" size={12} />
              {s.bugs}
            </span>
          )}
          <span className="w-5 text-right text-ink">{m.open}</span>
        </span>
      ),
    }
  })

  const byKind: BarItem[] = [...summary.byKind]
    .filter((k) => k.open > 0)
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
    .map((k) => ({
      key: k.kind,
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Icon name={KIND_ICON[k.kind]} size={14} className="text-muted" />
          {tc(`issueKind.${k.kind}`)}
        </span>
      ),
      value: k.open,
      color: KIND_COLOR[k.kind],
      href: `/issues?kind=${k.kind}`,
    }))

  const modSelect = [
    { value: 'all', label: t('filter.allMods') },
    ...mods.map((m) => ({
      value: m.value,
      label: m.value === UNCLAIMED ? t('filter.unclaimed') : m.value === NO_MOD ? t('filter.noMod') : `${m.name} (${m.count})`,
    })),
  ]
  // Keep a linked mod selectable even when it has no issues in this state.
  if (filters.mod !== 'all' && !modSelect.some((o) => o.value === filters.mod)) modSelect.push({ value: filters.mod, label: filters.mod })

  const clear = () => setFilters({ q: '', mod: 'all', kind: 'all', age: 'any' })

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description', { repo })}
        actions={
          <Button variant="secondary" size="sm" icon="github" href={`https://github.com/${repo}/issues`}>
            {t('openRepo')}
          </Button>
        }
      />

      <Verdict summary={summary} problems={openIssues} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={t('kpi.open')}
          value={summary.open}
          icon="issues"
          footer={summary.open > 0 ? t('kpi.mods', { count: modsWithIssues }) : t('kpi.closed', { count: summary.closed })}
        />
        <KpiCard label={t('kpi.crashes')} value={summary.openCrashes} icon="crash" tone={summary.openCrashes > 0 ? 'bad' : 'ok'} />
        <KpiCard label={t('kpi.bugs')} value={summary.openBugs} icon="bug" tone={summary.openBugs > 0 ? 'review' : 'ok'} />
        <KpiCard
          label={t('kpi.oldest')}
          value={oldest ? t('kpi.days', { count: oldestDays(oldest.createdAt) }) : NO_VALUE}
          icon="clock"
          footer={
            oldest ? (
              <a href={oldest.url} title={oldest.title} target="_blank" rel="noreferrer noopener" className="block truncate hover:text-ink">
                <span className="num">#{oldest.number}</span> {oldest.title}
              </a>
            ) : (
              t('kpi.oldestNone')
            )
          }
        />
      </div>

      {unclaimed.length > 0 && (
        <section aria-labelledby="unclaimed-title" className="rounded-lg border border-review/35 bg-review-soft/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <Icon name="warning" size={20} className="mt-0.5 shrink-0 text-review" />
              <div className="min-w-0">
                <h2 id="unclaimed-title" className="text-base font-semibold text-ink">
                  {t('unclaimed.title')}
                </h2>
                <p className="mt-0.5 text-sm text-muted">{t('unclaimed.description')}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {unclaimed.map((u) => (
                    <li key={u.label}>
                      <Link
                        to={`/issues?mod=${UNCLAIMED}&q=${encodeURIComponent(u.label)}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-review/35 bg-surface px-2 py-1 text-sm hover:border-review"
                      >
                        <span className="font-mono text-xs text-ink">{u.label}</span>
                        <span className="text-xs text-muted">{t('unclaimed.issues', { count: u.count })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Button variant="secondary" size="sm" icon="link" href="/settings">
              {t('unclaimed.link')}
            </Button>
          </div>
        </section>
      )}

      {summary.open > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-5">
          <Card title={t('byMod.title')} className="min-w-0 lg:col-span-3">
            <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
              {[
                ['crash', 'var(--color-bad)'],
                ['bug', 'var(--color-review)'],
                ['other', 'var(--color-neutral)'],
              ].map(([k, c]) => (
                <li key={k} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: c }} />
                  {t(`byMod.legend.${k}`)}
                </li>
              ))}
            </ul>
            <BarList items={byMod} topN={8} ariaLabel={t('byMod.aria')} />
          </Card>
          <Card title={t('byKind.title')} className="min-w-0 lg:col-span-2">
            <BarList items={byKind} topN={0} ariaLabel={t('byKind.aria')} />
          </Card>
        </div>
      )}

      <Card
        title={t('list.title')}
        padded={false}
        actions={
          <span className="num text-sm text-muted" aria-live="polite">
            {filterCount > 0 || filters.state !== 'open'
              ? t('list.of', { shown: shown.length, total: source.length })
              : t('list.shown', { count: shown.length })}
          </span>
        }
        className="min-w-0"
      >
        <div className="grid grid-cols-2 gap-3 px-4 pt-3 pb-4 sm:px-5 lg:grid-cols-[minmax(14rem,1fr)_12rem_11rem_11rem_auto]">
          <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} placeholder={t('filter.search')} className="col-span-2 lg:col-span-1 lg:self-end" />
          <Select label={t('filter.mod')} value={filters.mod} onChange={(mod) => setFilters({ mod })} options={modSelect} className="col-span-2 lg:col-span-1" />
          <Select
            label={t('filter.kind')}
            value={filters.kind}
            onChange={(kind) => setFilters({ kind: kind as Filters['kind'] })}
            options={[{ value: 'all', label: t('filter.allKinds') }, ...KINDS.map((k) => ({ value: k, label: tc(`issueKind.${k}`) }))]}
          />
          <Select
            label={t('filter.age')}
            value={filters.age}
            onChange={(age) => setFilters({ age: age as Filters['age'] })}
            options={AGES.map((a) => ({ value: a, label: t(a === 'any' ? 'filter.ageAny' : `filter.age${a}`) }))}
          />
          <div className="flex items-end justify-between gap-3 col-span-2 lg:col-span-1">
            <SegmentedControl
              label={t('filter.state')}
              value={filters.state}
              onChange={(state) => setFilters({ state })}
              options={[
                { value: 'open', label: t('filter.open') },
                { value: 'closed', label: t('filter.closed') },
                { value: 'all', label: t('filter.all') },
              ]}
            />
            {filterCount > 0 && (
              <Button variant="ghost" size="sm" icon="close" onClick={clear}>
                {t('filter.clear')}
              </Button>
            )}
          </div>
        </div>
        <div className="border-t border-line">
          {listLoading ? (
            other.error ? (
              <ErrorState compact title={t('error.title')} error={other.error} onRetry={other.reload} />
            ) : (
              <div className="space-y-3 p-4" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )
          ) : (
            <IssueList
              issues={shown}
              caption={t('list.caption', { repo })}
              empty={
                source.length === 0 && filterCount === 0 ? (
                  <EmptyState compact icon="check" title={t('empty.none')} description={t('empty.noneDescription', { repo })} />
                ) : (
                  <EmptyState
                    compact
                    icon="filter"
                    title={t('empty.title')}
                    description={t('empty.description')}
                    action={
                      filterCount > 0 ? (
                        <Button variant="secondary" size="sm" onClick={clear}>
                          {t('filter.clear')}
                        </Button>
                      ) : undefined
                    }
                  />
                )
              }
            />
          )}
        </div>
      </Card>
    </>
  )
}
