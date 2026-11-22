// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import PlatformBadge from '../../components/ui/PlatformBadge'
import ProgressBar from '../../components/ui/ProgressBar'
import Skeleton from '../../components/ui/Skeleton'
import { formatCompact } from '../../lib/format'
import type { Versions } from '../../lib/types'
import { topVersions } from './logic'

/** Which Minecraft versions the downloads sit on: the top five, each with its CurseForge and Modrinth split. */
export default function VersionsCard({ versions, loading }: { versions: Versions | null; loading: boolean }) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const top = versions ? topVersions(versions.gameVersions, 5) : []
  const max = top[0]?.downloads ?? 0

  return (
    <Card
      id="minecraft-versions"
      title={t('versions.title')}
      description={t('versions.description')}
      actions={
        <Link to="/versions" className="inline-flex items-center gap-1 text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
          {t('versions.all')}
          <Icon name="arrow_right" size={14} />
        </Link>
      }
    >
      {loading && !versions ? (
        <Skeleton className="h-28 w-full" />
      ) : top.length === 0 ? (
        <p className="text-sm text-muted">{t('versions.none')}</p>
      ) : (
        <ul className="space-y-3">
          {top.map((v) => (
            <li key={v.name}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="num font-medium text-ink">{v.name}</span>
                <span className="num text-muted">{formatCompact(v.downloads)}</span>
              </div>
              <div style={{ width: `${Math.max(4, (v.downloads / max) * 100)}%` }}>
                <ProgressBar
                  height={6}
                  ariaLabel={`${v.name}: ${tc('platform.curseforge')} ${formatCompact(v.curseforge)}, ${tc('platform.modrinth')} ${formatCompact(v.modrinth)}`}
                  segments={[
                    { key: 'cf', label: tc('platform.curseforge'), value: v.curseforge, color: 'var(--color-cf)', pattern: 0 },
                    { key: 'mr', label: tc('platform.modrinth'), value: v.modrinth, color: 'var(--color-mr)', pattern: 1 },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {top.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <PlatformBadge platform="curseforge" size="sm" />
          <PlatformBadge platform="modrinth" size="sm" />
        </div>
      )}
    </Card>
  )
}
