// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DeltaText from '../../components/ui/DeltaText'
import { cx } from '../../lib/cx'
import { STRIPE } from './stripe'
import { formatCount } from '../../lib/format'
import type { ModSummary } from '../../lib/types'
import { IssuesCell, ModCell, StatusCell, VersionChips } from './cells'
import PlatformBadge from '../../components/ui/PlatformBadge'
import ProgressBar from '../../components/ui/ProgressBar'

/** The narrow layout: one stacked card per mod, same facts, regrouped for a thumb. */
export default function ModCards({ mods }: { mods: ModSummary[] }) {
  const { t } = useTranslation(['mods', 'common'])
  return (
    <ul className="flex flex-col gap-2.5">
      {mods.map((m) => (
        <li key={m.slug}>
          <Link
            to={`/mods/${encodeURIComponent(m.slug)}`}
            className={cx('block rounded-lg border border-l-[3px] border-line bg-surface p-3.5 text-inherit no-underline shadow-e1 active:bg-sunk', STRIPE[m.health])}
          >
            <ModCell mod={m} />
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
              <div>
                <PlatformBadge platform="curseforge" size="sm" />
                <div className="mt-1.5">
                  <StatusCell info={m.curseforge} platform="curseforge" />
                </div>
              </div>
              <div>
                <PlatformBadge platform="modrinth" size="sm" />
                <div className="mt-1.5">
                  <StatusCell info={m.modrinth} platform="modrinth" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-line/60 pt-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="num text-lg font-semibold text-ink">{formatCount(m.downloads.total)}</span>
                  <DeltaText value={m.downloads.delta7d} suffix={t('mods:cell.sevenDays')} />
                </div>
                <ProgressBar
                  className="mt-1.5 w-32"
                  height={4}
                  format={formatCount}
                  ariaLabel={`${t('common:platform.curseforge')} ${formatCount(m.downloads.curseforge)}, ${t('common:platform.modrinth')} ${formatCount(m.downloads.modrinth)}`}
                  segments={[
                    { key: 'cf', label: t('common:platform.curseforge'), value: m.downloads.curseforge, color: 'var(--color-cf)', pattern: 0 },
                    { key: 'mr', label: t('common:platform.modrinth'), value: m.downloads.modrinth, color: 'var(--color-mr)', pattern: 1 },
                  ]}
                />
              </div>
              <IssuesCell mod={m} />
            </div>
            <div className="mt-2.5">
              <VersionChips versions={m.minecraftVersions} max={4} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
