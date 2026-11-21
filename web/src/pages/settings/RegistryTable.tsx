// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import DataTable, { type Column } from '../../components/ui/DataTable'
import ModIcon from '../../components/ui/ModIcon'
import { PlatformMark } from '../../components/ui/PlatformBadge'
import Pill from '../../components/ui/Pill'
import Tooltip from '../../components/ui/Tooltip'
import type { CatalogEntry, Platform } from '../../lib/types'
import { isSingle } from './logic'

interface Props {
  entries: CatalogEntry[]
  icons: Map<string, string>
  narrow: boolean
  onEdit: (e: CatalogEntry) => void
  onToggleHidden: (e: CatalogEntry) => void
  onUnlink: (e: CatalogEntry, p: Platform) => void
  empty: React.ReactNode
}

/** The linked entries: a sortable table on wide screens, one card per entry on narrow ones. */
export default function RegistryTable({ entries, icons, narrow, onEdit, onToggleHidden, onUnlink, empty }: Props) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')

  const platformCell = (e: CatalogEntry, p: Platform) => {
    const id = p === 'curseforge' ? e.curseforgeId : e.modrinthId
    if (id === null) return <span className="text-faint">{t('registry.notLinked')}</span>
    return (
      <span className="inline-flex items-center gap-1">
        <span className={p === 'curseforge' ? 'text-cf' : 'text-mr'}>
          <PlatformMark platform={p} />
        </span>
        <span className="num text-ink">{id}</span>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon="unlink"
          className={narrow ? '!size-11 text-muted' : '!size-8 text-muted'}
          onClick={() => onUnlink(e, p)}
        >
          {t('registry.unlinkLabel', { platform: tc(`platform.${p}`), name: e.name })}
        </Button>
      </span>
    )
  }

  const labelCell = (e: CatalogEntry) =>
    e.githubLabel ? (
      <span className="num break-words">{t('registry.labelDefault', { label: e.githubLabel })}</span>
    ) : (
      <Tooltip content={t('registry.noLabelHint', { label: t('registry.labelDefault', { label: e.slug }) })}>
        <span tabIndex={0} className="rounded-sm text-faint">
          {t('registry.noLabel')}
        </span>
      </Tooltip>
    )

  const pills = (e: CatalogEntry) => (
    <span className="flex flex-wrap items-center gap-1.5">
      {e.hidden && (
        <Pill tone="inactive" size="sm" icon="eye">
          {t('registry.hidden')}
        </Pill>
      )}
      {!e.auto && (
        <Pill tone="accent" size="sm" title={t('registry.manualHint')}>
          {t('registry.manual')}
        </Pill>
      )}
      {isSingle(e) && !e.hidden && (
        <Pill tone="review" size="sm" icon="warning" title={t('registry.onePlatformHint')}>
          {t('registry.onePlatform')}
        </Pill>
      )}
    </span>
  )

  const actions = (e: CatalogEntry) => (
    <span className="flex items-center justify-end gap-1.5">
      <Button size={narrow ? 'md' : 'sm'} variant="secondary" onClick={() => onToggleHidden(e)} aria-label={t(e.hidden ? 'registry.unhideLabel' : 'registry.hideLabel', { name: e.name })}>
        {e.hidden ? t('registry.unhide') : t('registry.hide')}
      </Button>
      <Button size={narrow ? 'md' : 'sm'} icon="edit" aria-label={t('registry.editLabel', { name: e.name })} onClick={() => onEdit(e)}>
        {t('registry.edit')}
      </Button>
    </span>
  )

  const nameCell = (e: CatalogEntry) => (
    <span className="flex min-w-[12rem] items-center gap-3">
      <ModIcon src={icons.get(e.slug)} name={e.name} size={36} className={e.hidden ? 'opacity-50' : undefined} />
      <span className="min-w-0">
        <span className={`block font-medium break-words ${e.hidden ? 'text-muted' : 'text-ink'}`}>{e.name}</span>
        <span className="num block truncate text-xs text-faint" title={e.slug}>{e.slug}</span>
      </span>
    </span>
  )

  if (entries.length === 0) return <>{empty}</>

  if (narrow) {
    return (
      <ul className="divide-y divide-line" aria-label={t('registry.caption')}>
        {[...entries].sort((a, b) => a.name.localeCompare(b.name)).map((e) => (
          <li key={e.slug} className="space-y-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              {nameCell(e)}
            </div>
            {pills(e)}
            <dl className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1 text-sm">
              <dt className="text-faint">{tc('platform.curseforge')}</dt>
              <dd>{platformCell(e, 'curseforge')}</dd>
              <dt className="text-faint">{tc('platform.modrinth')}</dt>
              <dd>{platformCell(e, 'modrinth')}</dd>
              <dt className="text-faint">{t('registry.label')}</dt>
              <dd className="min-w-0 break-words">{labelCell(e)}</dd>
            </dl>
            {actions(e)}
          </li>
        ))}
      </ul>
    )
  }

  const columns: Column<CatalogEntry>[] = [
    { key: 'name', header: t('registry.mod'), cell: (e) => <span className="flex flex-wrap items-center gap-x-3 gap-y-1">{nameCell(e)}{pills(e)}</span>, sortValue: (e) => e.name.toLowerCase() },
    { key: 'cf', header: tc('platform.curseforge'), cell: (e) => platformCell(e, 'curseforge'), sortValue: (e) => e.curseforgeId, width: '8.5rem' },
    { key: 'mr', header: tc('platform.modrinth'), cell: (e) => platformCell(e, 'modrinth'), sortValue: (e) => e.modrinthId, width: '8.5rem' },
    { key: 'label', header: t('registry.label'), cell: labelCell, sortValue: (e) => e.githubLabel ?? e.slug, hideBelow: 'lg', className: 'min-w-[10rem] max-w-[16rem] break-words' },
    { key: 'actions', header: <span className="sr-only">{t('registry.edit')}</span>, cell: actions, align: 'right', width: '9.5rem' },
  ]
  return (
    <DataTable
      columns={columns}
      rows={entries}
      rowKey={(e) => e.slug}
      caption={t('registry.caption')}
      defaultSort={{ key: 'name', dir: 'asc' }}
      stickyHeader={false}
      dense
    />
  )
}
