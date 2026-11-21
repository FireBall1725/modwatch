// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DeltaText from '../../components/ui/DeltaText'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import PageHeader from '../../components/ui/PageHeader'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import { useApi } from '../../hooks/useApi'
import { useOverview } from '../../hooks/overviewContext'
import { api } from '../../lib/api'
import { formatCount } from '../../lib/format'
import HealthTiles from './HealthTiles'
import ModCards from './ModCards'
import ModsTable from './ModsTable'
import Toolbar from './Toolbar'
import {
  DEFAULT_QUERY,
  defaultDir,
  SORT_KEYS,
  filterBase,
  filterMods,
  healthCounts,
  minecraftOptions,
  parseQuery,
  serializeQuery,
  sortMods,
  summarize,
  type ModsQuery,
  type SortKey,
} from './logic'

export default function ModsPage() {
  const { t } = useTranslation(['mods', 'common'])
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseQuery(params), [params])
  const overview = useOverview()
  // A new successful poll changes the numbers, so ask again when it lands.
  const list = useApi(() => api.mods(), [overview.data?.lastOkPoll?.id ?? 0])

  const update = useCallback(
    (patch: Partial<ModsQuery>) => setParams(serializeQuery({ ...query, ...patch }), { replace: true }),
    [query, setParams],
  )
  const clear = useCallback(
    () => setParams(serializeQuery({ ...DEFAULT_QUERY, members: query.members, sort: query.sort, dir: query.dir }), { replace: true }),
    [query, setParams],
  )

  const all = list.data
  const view = useMemo(() => {
    if (!all) return null
    const base = filterBase(all, query)
    const rows = sortMods(filterMods(all, query), query.sort, query.dir)
    return {
      counts: healthCounts(base),
      rows,
      totals: summarize(rows),
      versions: minecraftOptions(all),
      ownedCount: all.filter((m) => m.owned).length,
      hiddenMembers: all.some((m) => !m.owned),
    }
  }, [all, query])

  const description = view ? t('description', { count: query.members ? all!.length : view.ownedCount }) : undefined

  return (
    <>
      <PageHeader title={t('title')} description={description} />

      {list.error && !all ? (
        <ErrorState error={list.error} title={t('error.title')} onRetry={() => void list.reload()} />
      ) : (
        <>
          <HealthTiles counts={view?.counts ?? null} value={query.health} onChange={(health) => update({ health })} />
          {view && view.counts.problem === 0 && view.counts.attention === 0 && query.health === 'all' && view.counts.all > 0 && (
            <p className="-mt-3 text-sm text-ok">{t('health.allClear')}</p>
          )}

          <Card className="!overflow-visible">
            <Toolbar query={query} minecraft={view?.versions ?? []} onChange={update} onClear={clear} />
          </Card>

          {!view ? (
            <LoadingList />
          ) : (
            <>
              <p role="status" className="sr-only">
                {t('results.count', { count: view.rows.length })}
              </p>
              {list.error && (
                <ErrorState compact error={list.error} title={t('error.title')} onRetry={() => void list.reload()} />
              )}
              {all!.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="mods"
                    title={t('empty.noneTitle')}
                    description={t('empty.noneBody')}
                    action={<Button href="/settings" variant="secondary">{t('empty.noneAction')}</Button>}
                  />
                </Card>
              ) : view.rows.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="search"
                    title={t('empty.noMatchTitle')}
                    description={t('empty.noMatchBody')}
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="secondary" onClick={clear}>{t('filters.clear')}</Button>
                        {!query.members && view.hiddenMembers && (
                          <Button variant="ghost" onClick={() => update({ members: true })}>{t('empty.showMembers')}</Button>
                        )}
                      </div>
                    }
                  />
                </Card>
              ) : (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-3 md:hidden">
                    <Select
                      label={t('sort.label')}
                      value={query.sort}
                      onChange={(v) => update({ sort: v as SortKey, dir: defaultDir(v as SortKey) })}
                      options={SORT_KEYS.map((k) => ({ value: k, label: t(`sort.${k}`) }))}
                      className="min-w-0 flex-1"
                    />
                    <Button
                      variant="secondary"
                      icon={query.dir === 'asc' ? 'arrow_up' : 'arrow_down'}
                      onClick={() => update({ dir: query.dir === 'asc' ? 'desc' : 'asc' })}
                      className="min-h-11"
                    >
                      {query.dir === 'asc' ? t('sort.ascending') : t('sort.descending')}
                    </Button>
                  </div>

                  <div className="md:hidden">
                    <ModCards mods={view.rows} />
                  </div>
                  <Card padded={false} className="hidden overflow-hidden md:block">
                    <ModsTable mods={view.rows} sort={query.sort} dir={query.dir} onSort={(sort, dir) => update({ sort, dir })} />
                  </Card>

                  <ul
                    aria-label={t('totals.label')}
                    className="m-0 flex list-none flex-wrap items-center gap-x-6 gap-y-1 p-0 px-1 text-sm text-muted"
                  >
                    <li>
                      <span>
                        {view.rows.length === all!.filter((m) => query.members || m.owned).length
                          ? t('totals.mods', { count: view.rows.length })
                          : t('showing', { shown: view.rows.length, total: all!.filter((m) => query.members || m.owned).length })}
                      </span>
                    </li>
                    <li><span className="num text-ink">{formatCount(view.totals.downloads)}</span> {t('totals.downloads')}</li>
                    <li><DeltaText value={view.totals.delta7d} suffix={t('totals.week')} /></li>
                    {view.totals.openCrashes > 0 && <li className="text-bad">{t('totals.openCrashes', { count: view.totals.openCrashes })}</li>}
                    {view.totals.openBugs > 0 && <li className="text-review">{t('totals.openBugs', { count: view.totals.openBugs })}</li>}
                  </ul>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

function LoadingList() {
  const { t } = useTranslation('common')
  return (
    <Card padded={false} className="overflow-hidden">
      <span className="sr-only" role="status">{t('word.loading')}</span>
      <div className="divide-y divide-line/60">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1"><Skeleton lines={2} /></div>
            <Skeleton className="hidden h-6 w-24 md:block" />
            <Skeleton className="hidden h-6 w-24 md:block" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </Card>
  )
}
