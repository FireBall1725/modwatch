// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Icon from '../../components/ui/Icon'
import ModIcon from '../../components/ui/ModIcon'
import PlatformBadge from '../../components/ui/PlatformBadge'
import Pill from '../../components/ui/Pill'
import RelativeTime from '../../components/ui/RelativeTime'
import SearchInput from '../../components/ui/SearchInput'
import SegmentedControl from '../../components/ui/SegmentedControl'
import Skeleton from '../../components/ui/Skeleton'
import StatusChip from '../../components/ui/StatusChip'
import Toggle from '../../components/ui/Toggle'
import { cx } from '../../lib/cx'
import type { Platform } from '../../lib/types'
import { groupBoard, type BoardGroup, type BoardRow, type PageState } from './logic'

interface Props {
  rows: BoardRow[] | null
  /** Rows before the filter, to tell "no projects" from "nothing matches". */
  total: number
  /** Approved rows the toggle would reveal. */
  hiddenApproved: number
  error: Error | null
  state: PageState
  onChange: (patch: Partial<PageState>) => void
  onRetry: () => void
}

const GROUP_TEXT: Record<BoardGroup, string> = {
  blocked: 'text-bad',
  waiting: 'text-review',
  unpublished: 'text-neutral',
  dormant: 'text-inactive',
  approved: 'text-ok',
}

function Row({ row }: { row: BoardRow }) {
  const { t } = useTranslation('releases')
  const { t: tc } = useTranslation('common')
  const { info } = row
  const asked = info.requestedStatus && info.requestedStatus !== info.rawStatus ? info.requestedStatus : null
  const statusLabel = (s: string) => {
    const key = norm(s) === 'approved' ? 'approved' : null
    return key ? tc(`status.${key}`).toLowerCase() : s
  }
  const norm = (x: string) => x.toLowerCase().replace(/[\s_]/g, '')
  const rawDiffers = Boolean(info.rawStatus) && norm(info.rawStatus) !== norm(tc(`status.${info.status}`))
  return (
    <li className={cx('flex flex-col gap-2 px-4 py-3 sm:px-5', row.group === 'blocked' && 'border-l-2 border-l-bad', row.group !== 'blocked' && 'border-l-2 border-l-transparent')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ModIcon src={row.iconUrl} name={row.name} size={32} />
        <Link to={`/mods/${row.slug}`} className="min-w-0 flex-1 basis-40 truncate text-sm font-semibold text-ink hover:text-accent">
          {row.name}
        </Link>
        <div className="order-last flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
          <PlatformBadge platform={row.platform} size="sm" />
          <StatusChip status={info.status} size="sm" rawStatus={info.rawStatus} />
          {row.queueDays !== null && (
            <Pill tone={row.slow ? 'bad' : 'review'} icon="clock" size="sm">
              {row.queueDays === 0 ? t('board.queueNew') : t('board.queue', { count: row.queueDays })}
              {row.slow && <span className="sr-only"> {t('board.slow')}</span>}
            </Pill>
          )}
          {row.group === 'waiting' && row.queueDays === null && <span className="text-xs text-faint">{t('board.queueUnknown')}</span>}
        </div>
        <a
          href={info.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t('board.open', { platform: tc(`platform.${row.platform}`) })}
          title={t('board.open', { platform: tc(`platform.${row.platform}`) })}
          className="relative inline-flex size-9 items-center justify-center rounded-md text-muted after:absolute after:-inset-1 after:content-[''] hover:bg-raised hover:text-ink"
        >
          <Icon name="external" size={16} />
        </a>
      </div>
      {(asked || rawDiffers || info.updatedAt) && (
        <p className="flex flex-wrap gap-x-3 pl-0 text-xs text-muted sm:pl-11">
          {rawDiffers && (
            <span className="font-mono text-faint" title={t('board.rawStatus')}>
              <span className="sr-only">{t('board.rawStatus')}: </span>
              {info.rawStatus}
            </span>
          )}
          {asked && <span>{t('board.requested', { status: statusLabel(asked) })}</span>}
          {info.updatedAt && (
            <span>
              {t('board.updated')} <RelativeTime iso={info.updatedAt} />
            </span>
          )}
        </p>
      )}
      {info.statusMessage && (
        <blockquote className="ml-0 rounded-md border border-line bg-sunk px-3 py-2 text-sm text-ink sm:ml-11">
          <span className="mb-0.5 block text-xs font-medium text-muted">{t('board.message')}</span>
          {info.statusMessage}
        </blockquote>
      )}
    </li>
  )
}

export default function Board({ rows, total, hiddenApproved, error, state, onChange, onRetry }: Props) {
  const { t } = useTranslation('releases')
  const { t: tc } = useTranslation('common')
  const options: { value: Platform | 'all'; label: string }[] = [
    { value: 'all', label: t('board.allPlatforms') },
    { value: 'curseforge', label: tc('platform.curseforge') },
    { value: 'modrinth', label: tc('platform.modrinth') },
  ]
  const filtered = state.q !== '' || state.platform !== 'all'
  const sections = rows ? groupBoard(rows) : []

  return (
    <Card
      id="board"
      title={t('board.title')}
      padded={false}
      actions={
        <SegmentedControl label={t('board.platform')} size="sm" options={options} value={state.platform} onChange={(platform) => onChange({ platform })} />
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 pt-3 pb-3 sm:px-5">
        <SearchInput value={state.q} onChange={(q) => onChange({ q })} placeholder={t('board.search')} className="w-full sm:w-64" />
        <Toggle checked={state.approved} onChange={(approved) => onChange({ approved })} label={t('board.showApproved', { count: hiddenApproved })} />
        <Toggle checked={state.members} onChange={(members) => onChange({ members })} label={t('board.showMembers')} />
      </div>
      <div className="border-t border-line">
        {error && !rows ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : !rows ? (
          <div className="flex flex-col gap-4 p-5" aria-busy="true">
            <span role="status" className="sr-only">
              {tc('word.loading')}
            </span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-md" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            ))}
          </div>
        ) : sections.length === 0 ? (
          total === 0 ? (
            <EmptyState compact icon="package" title={t('board.noneTitle')} description={t('board.noneBody')} />
          ) : filtered ? (
            <EmptyState
              compact
              icon="search"
              title={t('board.emptyFilterTitle')}
              description={t('board.emptyFilterBody')}
              action={
                <Button size="sm" variant="secondary" onClick={() => onChange({ q: '', platform: 'all' })}>
                  {t('board.unfilter')}
                </Button>
              }
            />
          ) : (
            <EmptyState compact icon="approved" title={t('board.emptyApprovedTitle')} description={t('board.emptyApprovedBody')} />
          )
        ) : (
          sections.map((s) => (
            <section key={s.group} aria-labelledby={`g-${s.group}`}>
              <h3 id={`g-${s.group}`} className="flex items-center gap-2 border-b border-line bg-sunk px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase sm:px-5">
                <span className={GROUP_TEXT[s.group]}>{t(`group.${s.group}`)}</span>
                <span className="num rounded-full bg-raised px-1.5 py-0.5 text-2xs text-muted">{s.rows.length}</span>
              </h3>
              <ul className="divide-y divide-line border-b border-line last:border-b-0">
                {s.rows.map((r) => (
                  <Row key={r.key} row={r} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </Card>
  )
}
