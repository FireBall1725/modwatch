// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import SearchInput from '../../components/ui/SearchInput'
import SegmentedControl from '../../components/ui/SegmentedControl'
import Select from '../../components/ui/Select'
import type { DownloadsHistory, ModSummary } from '../../lib/types'
import ModCard from './ModCard'
import { DEFAULT_VIEW, filterMods, modSeries, sortMods, type ShowFilter, type SortKey, type ViewState } from './logic'

interface Props {
  mods: ModSummary[]
  history: DownloadsHistory | null
  view: ViewState
  onView: (patch: Partial<ViewState>) => void
  onPollNow: () => void
  hasPolled: boolean
}

/** Search, filter and sort over the mod cards. Every control writes to the URL through onView. */
export default function ModGrid({ mods, history, view, onView, onPollNow, hasPolled }: Props) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const shown = sortMods(filterMods(mods, view), view.sort)
  const filtered = view.q.trim() !== '' || view.show !== DEFAULT_VIEW.show

  const showOptions: { value: ShowFilter; label: string }[] = [
    { value: 'all', label: t('mods.showAll') },
    { value: 'attention', label: t('mods.showAttention') },
    { value: 'review', label: t('mods.showReview') },
  ]
  const sortOptions: { value: SortKey; label: string }[] = [
    { value: 'downloads', label: t('mods.sortDownloads') },
    { value: 'movement', label: t('mods.sortMovement') },
    { value: 'health', label: t('mods.sortHealth') },
    { value: 'issues', label: t('mods.sortIssues') },
    { value: 'name', label: t('mods.sortName') },
  ]

  return (
    <Card
      id="mods"
      title={t('mods.title')}
      description={filtered ? t('mods.countOf', { shown: shown.length, total: mods.length }) : t('mods.count', { count: mods.length })}
      padded={false}
      className="min-w-0"
    >
      <div className="flex flex-wrap items-end gap-3 px-4 pt-3 pb-4 sm:px-5">
        <SearchInput className="w-full sm:w-64" value={view.q} onChange={(q) => onView({ q })} placeholder={t('mods.search')} />
        <SegmentedControl label={t('mods.show')} options={showOptions} value={view.show} onChange={(show) => onView({ show })} />
        <Select className="w-full sm:ml-auto sm:w-48" label={t('mods.sort')} hideLabel value={view.sort} onChange={(v) => onView({ sort: v as SortKey })} options={sortOptions} />
      </div>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {mods.length === 0 ? (
          <EmptyState
            compact
            title={t('mods.none')}
            description={t('mods.noneDetail')}
            action={
              !hasPolled && (
                <Button variant="primary" icon="refresh" onClick={onPollNow}>
                  {tc('poll.now')}
                </Button>
              )
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            compact
            icon="search"
            title={t('mods.noMatch')}
            description={t('mods.noMatchDetail')}
            action={
              <Button variant="secondary" size="sm" onClick={() => onView({ q: '', show: 'all' })}>
                {t('mods.reset')}
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18.5rem),1fr))] gap-3 sm:gap-4">
            {shown.map((m) => (
              <ModCard key={m.slug} mod={m} series={modSeries(history, m.slug, 30)} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
