// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import PlatformBadge from '../../components/ui/PlatformBadge'
import HealthDot from '../../components/ui/HealthDot'
import Icon from '../../components/ui/Icon'
import ModIcon from '../../components/ui/ModIcon'
import Pill from '../../components/ui/Pill'
import ProgressBar from '../../components/ui/ProgressBar'
import RelativeTime from '../../components/ui/RelativeTime'
import StatusChip from '../../components/ui/StatusChip'
import { cx } from '../../lib/cx'
import { daysBetween, formatCount, formatDate, NO_VALUE } from '../../lib/format'
import type { ModSummary, PlatformInfo } from '../../lib/types'
import { isOverAYear, openBugsAndCrashes, releaseVersion, reviewNote, topAttention, versionPreview } from './logic'

/** Icon, name and the single worst reason this mod is not healthy. */
export function ModCell({ mod }: { mod: ModSummary }) {
  const { t } = useTranslation('mods')
  const top = topAttention(mod)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ModIcon src={mod.iconUrl} name={mod.name} size={36} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <HealthDot health={mod.health} />
          <span className="truncate font-medium text-ink">{mod.name}</span>
          {!mod.owned && (
            <Pill tone="info" size="sm" title={t('cell.memberTitle')}>
              {t('cell.member')}
            </Pill>
          )}
        </div>
        {top && top.severity !== 'info' && (
          <p className={cx('mt-0.5 flex min-w-0 items-start gap-1 text-xs leading-snug', top.severity === 'problem' ? 'text-bad' : top.severity === 'warning' ? 'text-review' : 'text-muted')} title={top.detail || top.title}>
            <Icon name={top.severity === 'problem' ? 'problem' : top.severity === 'warning' ? 'warning' : 'info'} size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{top.title}</span>
          </p>
        )}
      </div>
    </div>
  )
}

/** Status chip for one platform, with queue time or the moderator message under it. */
export function StatusCell({ info, platformName }: { info: PlatformInfo | null; platformName?: boolean }) {
  const { t } = useTranslation('mods')
  if (!info) return <span className="text-xs text-faint">{t('cell.notPublished')}</span>
  const note = reviewNote(info)
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {platformName && <PlatformBadge platform={info.platform} size="sm" />}
        <StatusChip status={info.status} size="sm" rawStatus={info.rawStatus} />
      </div>
      {note && (
        <p className="flex max-w-full items-start gap-1 text-xs leading-snug text-muted" title={note.kind === 'message' ? note.text : undefined}>
          <Icon name={note.kind === 'queued' ? 'clock' : 'info'} size={12} className="mt-0.5 shrink-0 text-faint" />
          <span className="line-clamp-2">{note.kind === 'queued' ? t('cell.queued', { count: Math.max(0, daysBetween(note.text)) }) : note.text}</span>
        </p>
      )}
    </div>
  )
}

/** Open crashes and bugs called out, other open issues as a plain count. */
export function IssuesCell({ mod }: { mod: ModSummary }) {
  const { t } = useTranslation('mods')
  if (!mod.github) return <span className="num text-faint" title={t('cell.noRepo')}>{NO_VALUE}</span>
  const { bugs, crashes } = openBugsAndCrashes(mod)
  const other = mod.github.open - bugs - crashes
  if (mod.github.open === 0) return <span className="num text-xs text-muted">0</span>
  if (bugs + crashes === 0) return <span className="num text-xs text-muted">{t('cell.open', { count: other })}</span>
  return (
    <div className="flex flex-wrap items-center gap-1">
      {crashes > 0 && (
        <Pill tone="bad" size="sm" icon="crash">
          {t('cell.crashes', { count: crashes })}
        </Pill>
      )}
      {bugs > 0 && (
        <Pill tone="review" size="sm" icon="bug">
          {t('cell.bugs', { count: bugs })}
        </Pill>
      )}
      {other > 0 && <span className="num text-xs text-muted">{t('cell.otherOpen', { count: other })}</span>}
    </div>
  )
}

/** Combined downloads with a thin platform split under it. */
export function DownloadsCell({ mod, align = 'right' }: { mod: ModSummary; align?: 'left' | 'right' }) {
  const { t } = useTranslation('common')
  const d = mod.downloads
  return (
    <div className={cx('flex flex-col gap-1', align === 'right' ? 'items-end' : 'items-start')}>
      <span className="num font-medium text-ink">{formatCount(d.total)}</span>
      <ProgressBar
        className="w-24"
        height={4}
        format={formatCount}
        ariaLabel={`${t('platform.curseforge')} ${formatCount(d.curseforge)}, ${t('platform.modrinth')} ${formatCount(d.modrinth)}`}
        segments={[
          { key: 'cf', label: t('platform.curseforge'), value: d.curseforge, color: 'var(--color-cf)', pattern: 0 },
          { key: 'mr', label: t('platform.modrinth'), value: d.modrinth, color: 'var(--color-mr)', pattern: 1 },
        ]}
      />
    </div>
  )
}

/** Recent releases read "6 days ago"; past a year it is "Jan 2015", with the exact date as a tooltip. */
function ReleaseAge({ iso }: { iso: string }) {
  if (!isOverAYear(iso)) return <RelativeTime iso={iso} />
  const d = new Date(iso)
  return (
    <time dateTime={iso} title={formatDate(iso)}>
      {d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' }).replace('.', '')}
    </time>
  )
}

export function ReleaseCell({ mod }: { mod: ModSummary }) {
  const { t } = useTranslation(['mods', 'common'])
  const r = mod.latestRelease
  if (!r) return <span className="text-xs text-faint">{t('mods:cell.noRelease')}</span>
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-start gap-1.5">
        <span className="num line-clamp-2 min-w-0 break-words text-ink" title={r.version}>
          {releaseVersion(r.version)}
        </span>
        {r.releaseType !== 'release' && (
          <Pill tone="neutral" size="sm">
            {t(`common:releaseType.${r.releaseType}`)}
          </Pill>
        )}
      </span>
      <span className="text-xs text-muted">
        <ReleaseAge iso={r.publishedAt} />
      </span>
    </div>
  )
}

export function VersionChips({ versions, max = 3 }: { versions: string[]; max?: number }) {
  const { t } = useTranslation('mods')
  const { shown, more } = versionPreview(versions, max)
  if (shown.length === 0) return <span className="text-xs text-faint">{t('cell.noVersions')}</span>
  return (
    <ul className="flex flex-wrap gap-1" aria-label={versions.join(', ')}>
      {shown.map((v) => (
        <li key={v} className="num rounded-sm border border-line bg-sunk px-1.5 py-0.5 text-xs text-ink">
          {v}
        </li>
      ))}
      {more > 0 && (
        <li className="rounded-sm px-1 py-0.5 text-xs text-muted" title={versions.join(', ')}>
          {t('cell.moreVersions', { count: more })}
        </li>
      )}
    </ul>
  )
}

/** Release and Minecraft versions as one line, for table widths where those columns are hidden. */
export function InlineMeta({ mod }: { mod: ModSummary }) {
  const r = mod.latestRelease
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted xl:hidden">
      {r && (
        <span className="flex items-center gap-1.5">
          <span className="num text-ink" title={r.version}>
            {releaseVersion(r.version)}
          </span>
          <ReleaseAge iso={r.publishedAt} />
        </span>
      )}
      <VersionChips versions={mod.minecraftVersions} max={2} />
    </div>
  )
}
