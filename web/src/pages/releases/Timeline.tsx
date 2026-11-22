// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Icon from '../../components/ui/Icon'
import PlatformBadge from '../../components/ui/PlatformBadge'
import Pill, { type Tone } from '../../components/ui/Pill'
import SegmentedControl from '../../components/ui/SegmentedControl'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import { formatCount, formatTime } from '../../lib/format'
import { sortMinecraftDesc } from '../../lib/minecraft'
import type { Platform, ReleaseItem } from '../../lib/types'
import { dayLabel, filterReleases, groupByDay, mergeReleases, minecraftOptions, sortReleases, type PageState } from './logic'

interface Props {
  items: ReleaseItem[] | null
  ownedSlugs: ReadonlySet<string> | null
  mods: { slug: string; name: string }[]
  error: Error | null
  state: PageState
  onChange: (patch: Partial<PageState>) => void
  onRetry: () => void
}

const TYPE_TONE: Record<ReleaseItem['releaseType'], Tone> = { release: 'ok', beta: 'review', alpha: 'bad', unknown: 'inactive' }
const PAGE = 25
/** The page asks the API for this many files; a full response means older ones are cut off. */
const API_LIMIT = 100

function Item({ r }: { r: ReleaseItem }) {
  const { t } = useTranslation('releases')
  const { t: tc } = useTranslation('common')
  const mcs = sortMinecraftDesc(r.minecraftVersions)
  return (
    <li className="grid grid-cols-[3.25rem_1fr] gap-x-3 px-4 py-3 sm:grid-cols-[3.25rem_1fr_auto] sm:px-5">
      <time dateTime={r.publishedAt} className="num pt-0.5 text-xs text-muted">
        {formatTime(r.publishedAt)}
      </time>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {r.modSlug ? (
            <Link to={`/mods/${r.modSlug}`} className="text-sm font-semibold text-ink hover:text-accent">
              {r.modName}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-ink">{r.modName}</span>
          )}
          <span className="num text-sm text-muted">{r.version}</span>
          <PlatformBadge platform={r.platform} size="sm" />
          <Pill tone={TYPE_TONE[r.releaseType]} size="sm">
            {tc(`releaseType.${r.releaseType}`)}
          </Pill>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label={t('timeline.versions')}>
          {mcs.slice(0, 6).map((v) => (
            <span key={v} className="num rounded-sm border border-line bg-sunk px-1.5 py-0.5 text-2xs text-ink">
              {v}
            </span>
          ))}
          {mcs.length > 6 && <span className="num text-2xs text-muted">+{mcs.length - 6}</span>}
          {r.loaders.length > 0 && (
            <span className="text-xs text-muted" role="group" aria-label={t('timeline.loaders')}>
              {r.loaders.join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="col-start-2 mt-1 flex items-center gap-3 text-xs text-muted sm:col-start-3 sm:row-start-1 sm:mt-0 sm:justify-end">
        <span className="num">{t('timeline.downloads', { count: r.downloads, formattedCount: formatCount(r.downloads) })}</span>
        {r.url && (
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t('timeline.open', { name: `${r.modName} ${r.version}`, platform: tc(`platform.${r.platform}`) })}
            className="relative inline-flex size-9 items-center after:absolute after:-inset-1 after:content-['']  justify-center rounded-md hover:bg-raised hover:text-ink"
          >
            <Icon name="external" size={16} />
          </a>
        )}
      </div>
    </li>
  )
}

export default function Timeline({ items, ownedSlugs, mods, error, state, onChange, onRetry }: Props) {
  const { t } = useTranslation('releases')
  const { t: tc } = useTranslation('common')
  const [shown, setShown] = useState(PAGE)

  const merged = useMemo(() => (items ? mergeReleases(items) : null), [items])
  const filtered = useMemo(
    () => (merged ? sortReleases(filterReleases(merged, { platform: state.rplatform, type: state.type, mod: state.mod, mc: state.mc }, state.members ? null : ownedSlugs)) : null),
    [merged, ownedSlugs, state.rplatform, state.type, state.mod, state.mc, state.members],
  )
  const days = useMemo(() => (filtered ? groupByDay(filtered.slice(0, shown)) : []), [filtered, shown])
  const mcOptions = useMemo(() => minecraftOptions(merged ?? []), [merged])
  const platformOptions: { value: Platform | 'all'; label: string }[] = [
    { value: 'all', label: t('timeline.all') },
    { value: 'curseforge', label: tc('platform.curseforge') },
    { value: 'modrinth', label: tc('platform.modrinth') },
  ]
  const reset = () => {
    setShown(PAGE)
  }
  const change = (patch: Partial<PageState>) => {
    reset()
    onChange(patch)
  }

  return (
    <Card
      id="timeline"
      title={t('timeline.title')}
      description={filtered ? (items && items.length >= API_LIMIT ? t('timeline.latest', { count: filtered.length }) : t('timeline.count', { count: filtered.length })) : t('timeline.description')}
      padded={false}
      actions={<SegmentedControl label={t('timeline.platform')} size="sm" options={platformOptions} value={state.rplatform} onChange={(rplatform) => change({ rplatform })} />}
    >
      <div className="grid grid-cols-1 gap-3 px-4 pt-3 pb-3 sm:grid-cols-3 sm:px-5 lg:max-w-3xl">
        <Select
          label={t('timeline.mod')}
          value={state.mod}
          onChange={(mod) => change({ mod })}
          options={[{ value: 'all', label: t('timeline.allMods') }, ...mods.map((m) => ({ value: m.slug, label: m.name }))]}
        />
        <Select
          label={t('timeline.minecraft')}
          value={state.mc}
          onChange={(mc) => change({ mc })}
          options={[{ value: 'all', label: t('timeline.allVersions') }, ...mcOptions.map((v) => ({ value: v, label: v }))]}
        />
        <Select
          label={t('timeline.type')}
          value={state.type}
          onChange={(type) => change({ type: type as PageState['type'] })}
          options={[
            { value: 'all', label: t('timeline.all') },
            ...(['release', 'beta', 'alpha', 'unknown'] as const).map((k) => ({ value: k, label: tc(`releaseType.${k}`) })),
          ]}
        />
      </div>
      <div className="border-t border-line">
        {error && !items ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : !filtered ? (
          <div className="flex flex-col gap-4 p-5" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items && items.length === 0 ? (
          <EmptyState compact icon="releases" title={t('timeline.emptyTitle')} description={t('timeline.emptyBody')} />
        ) : filtered.length === 0 ? (
          <EmptyState compact icon="filter" title={t('timeline.noTitle')} description={t('timeline.noBody')} />
        ) : (
          <>
            {days.map((d) => (
              <section key={d.day} aria-label={dayLabel(d.day)}>
                <h3 className="num border-b border-line bg-sunk px-4 py-2 text-xs font-semibold text-muted sm:px-5">{dayLabel(d.day)}</h3>
                <ul className="divide-y divide-line border-b border-line">
                  {d.items.map((r) => (
                    <Item key={`${r.platform}:${r.modSlug}:${r.version}:${r.publishedAt}`} r={r} />
                  ))}
                </ul>
              </section>
            ))}
            {filtered.length > shown && (
              <div className="flex justify-center p-3">
                <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                  {t('timeline.more', { count: Math.min(PAGE, filtered.length - shown) })}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
