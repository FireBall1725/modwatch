// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import PlatformBadge from '../../components/ui/PlatformBadge'
import Pill, { type Tone } from '../../components/ui/Pill'
import RelativeTime from '../../components/ui/RelativeTime'
import { newestMinecraft } from '../../lib/minecraft'
import type { ReleaseItem } from '../../lib/types'

const TYPE_TONE: Record<ReleaseItem['releaseType'], Tone> = { release: 'ok', beta: 'review', alpha: 'info', unknown: 'inactive' }

/** The newest releases across both platforms, newest first. */
export default function RecentReleases({ releases }: { releases: ReleaseItem[] }) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const sorted = [...releases].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const groups = new Map<string, { first: ReleaseItem; platforms: ReleaseItem['platform'][] }>()
  for (const r of sorted) {
    const k = `${r.modSlug ?? r.modName}|${r.version}`
    const g = groups.get(k)
    if (!g) groups.set(k, { first: r, platforms: [r.platform] })
    else if (!g.platforms.includes(r.platform)) g.platforms.push(r.platform)
  }
  const shown = [...groups.values()].slice(0, 6)
  return (
    <Card
      title={t('releases.title')}
      padded={false}
      actions={
        <Link to="/releases" className="inline-flex min-h-8 items-center gap-1 text-sm text-muted hover:text-ink">
          {t('releases.all')}
          <Icon name="arrow_right" size={14} />
        </Link>
      }
    >
      {shown.length === 0 ? (
        <EmptyState compact title={t('releases.empty')} description={t('releases.emptyDetail')} icon="releases" />
      ) : (
        <ul className="divide-y divide-line px-4 pb-2 sm:px-5">
          {shown.map(({ first: r, platforms }) => {
            const mc = newestMinecraft(r.minecraftVersions)
            return (
              <li key={`${r.modName}-${r.version}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {r.modSlug ? (
                      <Link to={`/mods/${r.modSlug}`} className="truncate text-sm font-medium text-ink hover:underline hover:underline-offset-2">
                        {r.modName}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium text-ink">{r.modName}</span>
                    )}
                    <span className="num text-sm text-muted">{r.version}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-faint">
                    <RelativeTime iso={r.publishedAt} />
                    {mc && (
                      <span className="num">
                        {t('releases.minecraft')} {mc}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Pill tone={TYPE_TONE[r.releaseType]} size="sm">
                    {tc(`releaseType.${r.releaseType}`)}
                  </Pill>
                  {platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} size="sm" />
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
