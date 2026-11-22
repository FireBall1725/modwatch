// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable, { type Column } from '../../components/ui/DataTable'
import DeltaText from '../../components/ui/DeltaText'
import EmptyState from '../../components/ui/EmptyState'
import ExternalLink from '../../components/ui/ExternalLink'
import PlatformBadge from '../../components/ui/PlatformBadge'
import LoaderBadge, { LoaderMark } from '../../components/ui/LoaderBadge'
import ProgressBar from '../../components/ui/ProgressBar'
import Pill from '../../components/ui/Pill'
import RelativeTime from '../../components/ui/RelativeTime'
import Select from '../../components/ui/Select'
import { formatCount } from '../../lib/format'
import { compareMinecraft } from '../../lib/minecraft'
import type { FileItem } from '../../lib/types'
import { ALL, fileMinecraftVersions, fileReleaseTypes, filterFiles, groupReleases, mergeByVersion, visibleReleases, type FileFilter, type MergedFile, type ReleaseGroup } from './logic'

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
  const [showAll, setShowAll] = useState(false)
  const groups = useMemo(() => groupReleases(rows), [rows])
  const shown = visibleReleases(groups, showAll)
  const hidden = groups.length - shown.length
  const filtered = filter.platform !== ALL || filter.mc !== ALL || filter.type !== ALL

  const columns: Column<MergedFile>[] = [
    {
      key: 'mc',
      header: t('files.minecraft'),
      sortValue: (r) => r.minecraftVersions.slice().sort(compareMinecraft).at(-1) ?? null,
      cell: (r) => <span className="num font-medium text-ink">{r.minecraftVersions.join(', ') || '–'}</span>,
    },
    {
      key: 'loaders',
      header: t('files.loaders'),
      hideBelow: 'sm',
      cell: (r) =>
        r.loaders.length === 0 ? (
          <span className="text-muted">–</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1.5">
            {r.loaders.map((l) => (
              <LoaderBadge key={l} loader={l} />
            ))}
          </span>
        ),
    },
    {
      key: 'files',
      header: t('files.files'),
      cell: (r) => {
        // One group per loader, so each download link says which loader it is for.
        const groups = new Map<string, MergedFile['files']>()
        for (const f of r.files) {
          const k = f.loaders.join(', ')
          groups.set(k, [...(groups.get(k) ?? []), f])
        }
        return (
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {[...groups.entries()].map(([loader, files]) => (
              <span key={loader} className="inline-flex items-center gap-1.5">
                {groups.size > 1 && loader !== '' && (
                  <span className="text-muted" title={loader}>
                    <LoaderMark loader={loader} />
                    <span className="sr-only">{loader}</span>
                  </span>
                )}
                {files.map((f) => (
                  <ExternalLink key={`${f.platform}-${f.url ?? f.name}`} href={f.url} noIcon className="no-underline">
                    <span title={f.name}>
                      <PlatformBadge platform={f.platform} size="sm" iconOnly />
                      <span className="sr-only">{t('files.open', { name: f.name })}</span>
                    </span>
                  </ExternalLink>
                ))}
              </span>
            ))}
          </span>
        )
      },
    },
    { key: 'week', header: t('files.week'), align: 'right', hideBelow: 'lg', sortValue: (r) => r.delta7d, cell: (r) => <DeltaText value={r.delta7d} /> },
    {
      key: 'downloads',
      header: t('files.downloads'),
      align: 'right',
      sortValue: (r) => r.total,
      cell: (r) => (
        <span className="ml-auto flex max-w-64 items-center justify-end gap-3">
          <span className="hidden min-w-0 flex-1 sm:block">
            <ProgressBar
              height={6}
              ariaLabel={t('files.split', { cf: formatCount(r.curseforge), mr: formatCount(r.modrinth) })}
              segments={[
                { key: 'curseforge', label: tc('platform.curseforge'), value: r.curseforge, color: 'var(--color-cf)', pattern: 0 },
                { key: 'modrinth', label: tc('platform.modrinth'), value: r.modrinth, color: 'var(--color-mr)', pattern: 1 },
              ]}
            />
          </span>
          <span className="num flex shrink-0 flex-col items-end leading-tight">
            <span className="text-ink">{formatCount(r.total)}</span>
            <span className="text-2xs text-faint">
              <span className="text-cf">{formatCount(r.curseforge)}</span>
              {' · '}
              <span className="text-mr">{formatCount(r.modrinth)}</span>
            </span>
          </span>
        </span>
      ),
    },
  ]

  const typeOptions = fileReleaseTypes(files)
  return (
    <Card
      title={t('files.title')}
      description={`${filtered && rows.length !== files.length ? t('files.shown', { shown: rows.length, total: files.length }) : t('files.count', { count: files.length })} · ${t('files.releases', { count: groups.length })}`}
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
        ) : rows.length === 0 ? (
          <EmptyState compact icon="filter" title={t('files.empty')} description={t('files.emptyDetail')} />
        ) : (
          <>
            {shown.map((g) => (
              <ReleaseSection key={g.name} group={g} columns={columns} caption={t('files.captionRelease', { release: g.name })} />
            ))}
            {(hidden > 0 || showAll) && groups.length > 1 && (
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <Button variant="secondary" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? t('files.showLatest') : t('files.showOlder', { count: hidden })}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

/** One release: its name, whether it is a pre-release, when it came out and what it has been downloaded, then its files. */
function ReleaseSection({ group, columns, caption }: { group: ReleaseGroup; columns: Column<MergedFile>[]; caption: string }) {
  const { t } = useTranslation('modDetail')
  const rows = useMemo(() => mergeByVersion(group.files), [group.files])
  return (
    <section className="border-t border-line first:border-t-0" aria-label={group.name}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-3 sm:px-5">
        <h3 className="num text-base font-semibold text-ink">{group.name}</h3>
        <Pill tone={group.prerelease ? 'review' : 'ok'} size="sm">
          {group.prerelease ? t('files.prerelease') : t('files.release')}
        </Pill>
        <span className="flex gap-1.5">
          {group.platforms.map((p) => (
            <PlatformBadge key={p} platform={p} size="sm" iconOnly />
          ))}
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          {group.publishedAt && <RelativeTime iso={group.publishedAt} />}
          <span aria-hidden="true">·</span>
          <span className="num">{t('files.downloadsTotal', { n: formatCount(group.downloads) })}</span>
        </span>
      </header>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        caption={caption}
        defaultSort={{ key: 'mc', dir: 'desc' }}
        dense
        stickyHeader={false}
      />
    </section>
  )
}
