// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable, { type Column } from '../../components/ui/DataTable'
import DeltaText from '../../components/ui/DeltaText'
import EmptyState from '../../components/ui/EmptyState'
import ExternalLink from '../../components/ui/ExternalLink'
import PlatformBadge from '../../components/ui/PlatformBadge'
import Pill from '../../components/ui/Pill'
import RelativeTime from '../../components/ui/RelativeTime'
import Select from '../../components/ui/Select'
import { formatCount } from '../../lib/format'
import { compareMinecraft } from '../../lib/minecraft'
import type { FileItem } from '../../lib/types'
import { ALL, fileMinecraftVersions, fileReleaseTypes, filterFiles, type FileFilter } from './logic'

const TYPE_TONE = { release: 'ok', beta: 'review', alpha: 'bad', unknown: 'inactive' } as const

interface Props {
  files: FileItem[]
  filter: FileFilter
  onFilter: (next: Partial<FileFilter>) => void
}

/** Every file on both platforms, filterable by platform, Minecraft version and release type. */
export default function FilesCard({ files, filter, onFilter }: Props) {
  const { t } = useTranslation('modDetail')
  const { t: tc } = useTranslation('common')
  const rows = useMemo(() => filterFiles(files, filter), [files, filter])
  const filtered = filter.platform !== ALL || filter.mc !== ALL || filter.type !== ALL

  const columns: Column<FileItem>[] = [
    {
      key: 'name',
      header: t('files.name'),
      sortValue: (f) => f.name.toLowerCase(),
      cell: (f) => (
        <div className="min-w-0">
          <ExternalLink href={f.url} className="max-w-[16ch] sm:max-w-[40ch]">
            <span className="num truncate" title={f.name}>{f.name}</span>
          </ExternalLink>
          <div className="mt-1 sm:hidden">
            <PlatformBadge platform={f.platform} size="sm" />
          </div>
        </div>
      ),
    },
    { key: 'platform', header: t('files.platform'), hideBelow: 'sm', sortValue: (f) => f.platform, cell: (f) => <PlatformBadge platform={f.platform} size="sm" /> },
    { key: 'version', header: t('files.version'), hideBelow: 'md', sortValue: (f) => f.version, className: 'num', cell: (f) => f.version },
    {
      key: 'type',
      header: t('files.type'),
      hideBelow: 'sm',
      sortValue: (f) => f.releaseType,
      cell: (f) => (
        <Pill tone={TYPE_TONE[f.releaseType]} size="sm">
          {tc(`releaseType.${f.releaseType}`)}
        </Pill>
      ),
    },
    {
      key: 'mc',
      header: t('files.minecraft'),
      sortValue: (f) => f.minecraftVersions.slice().sort(compareMinecraft).at(-1) ?? null,
      cell: (f) => <span className="num">{f.minecraftVersions.join(', ') || '–'}</span>,
    },
    { key: 'loaders', header: t('files.loaders'), hideBelow: 'xl', cell: (f) => <span className="text-muted">{f.loaders.join(', ') || '–'}</span> },
    { key: 'published', header: t('files.published'), hideBelow: 'md', sortValue: (f) => f.publishedAt, cell: (f) => <RelativeTime iso={f.publishedAt} /> },
    { key: 'week', header: t('files.week'), align: 'right', hideBelow: 'lg', sortValue: (f) => f.delta7d, cell: (f) => <DeltaText value={f.delta7d} /> },
    { key: 'downloads', header: t('files.downloads'), align: 'right', className: 'num', sortValue: (f) => f.downloads, cell: (f) => formatCount(f.downloads) },
  ]

  const typeOptions = fileReleaseTypes(files)
  return (
    <Card
      title={t('files.title')}
      description={filtered && rows.length !== files.length ? t('files.shown', { shown: rows.length, total: files.length }) : t('files.count', { count: files.length })}
      padded={false}
      actions={
        files.length > 0 && (
          <>
            <Select
              label={t('files.filterPlatform')}
              value={filter.platform}
              onChange={(v) => onFilter({ platform: v as FileFilter['platform'] })}
              options={[{ value: ALL, label: t('files.all') }, { value: 'curseforge', label: tc('platform.curseforge') }, { value: 'modrinth', label: tc('platform.modrinth') }]}
            />
            <Select
              label={t('files.filterMinecraft')}
              value={filter.mc}
              onChange={(v) => onFilter({ mc: v })}
              options={[{ value: ALL, label: t('files.all') }, ...fileMinecraftVersions(files).map((v) => ({ value: v, label: v }))]}
            />
            <Select
              label={t('files.filterType')}
              value={filter.type}
              onChange={(v) => onFilter({ type: v })}
              options={[{ value: ALL, label: t('files.all') }, ...typeOptions.map((v) => ({ value: v, label: tc(`releaseType.${v}`) }))]}
            />
            {filtered && (
              <Button variant="ghost" size="sm" onClick={() => onFilter({ platform: ALL, mc: ALL, type: ALL })}>
                {tc('word.clear')}
              </Button>
            )}
          </>
        )
      }
    >
      <div className="mt-3">
        {files.length === 0 ? (
          <EmptyState compact icon="package" title={t('files.none')} description={t('files.noneDetail')} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(f) => `${f.platform}-${f.id}`}
            caption={t('files.caption')}
            defaultSort={{ key: 'downloads', dir: 'desc' }}
            dense
            maxHeight="32rem"
            empty={<EmptyState compact icon="filter" title={t('files.empty')} description={t('files.emptyDetail')} />}
          />
        )}
      </div>
    </Card>
  )
}
