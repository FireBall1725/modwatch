// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Sparkline from '../../components/charts/Sparkline'
import DeltaText from './LabelledDelta'
import HealthDot from '../../components/ui/HealthDot'
import ModIcon from '../../components/ui/ModIcon'
import PlatformBadge from '../../components/ui/PlatformBadge'
import ProgressBar from '../../components/ui/ProgressBar'
import StatusChip from '../../components/ui/StatusChip'
import { cx } from '../../lib/cx'
import { formatCount } from '../../lib/format'
import type { ModSummary, Platform, PlatformInfo } from '../../lib/types'
import { seriesGrowth } from './logic'

const RULE = { ok: 'before:bg-transparent', attention: 'before:bg-review', problem: 'before:bg-bad' }

function PlatformRow({ platform, info }: { platform: Platform; info: PlatformInfo | null }) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  return (
    <li className="flex items-center justify-between gap-2">
      <PlatformBadge platform={platform} size="sm" />
      {info ? <StatusChip status={info.status} rawStatus={info.rawStatus} size="sm" /> : <span className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-xs text-faint">{t('mods.notOnPlatform', { platform: tc(`platform.${platform}`) })}</span>}
    </li>
  )
}

/** One mod: status per platform, issues, combined downloads with the split and a 30 day line. The title link covers the whole card. */
export default function ModCard({ mod, series }: { mod: ModSummary; series: number[] }) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const gh = mod.github
  const growth = seriesGrowth(series)
  const d = mod.downloads

  return (
    <li
      className={cx(
        'group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-e1 transition-colors duration-150 hover:border-line-strong hover:bg-sunk',
        'before:absolute before:inset-y-0 before:left-0 before:w-0.5',
        RULE[mod.health],
      )}
    >
      <div className="flex items-start gap-3">
        <ModIcon src={mod.iconUrl} name={mod.name} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink">
            <Link
              to={`/mods/${mod.slug}`}
              aria-label={t('mods.open', { name: mod.name })}
              className="rounded-sm after:absolute after:inset-0 after:content-[''] group-hover:text-accent"
            >
              {mod.name}
            </Link>
          </h3>
          <HealthDot health={mod.health} showLabel className="mt-0.5" />
        </div>
      </div>

      <ul className="space-y-1.5">
        <PlatformRow platform="curseforge" info={mod.curseforge} />
        <PlatformRow platform="modrinth" info={mod.modrinth} />
      </ul>

      <div className="flex items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <span className="text-muted">{t('mods.issues')}</span>
        {gh === null ? (
          <span className="text-faint">{t('mods.issuesUnknown')}</span>
        ) : gh.open === 0 ? (
          <span className="num text-muted">{t('mods.issuesNone')}</span>
        ) : (
          <span className="flex items-center gap-2.5">
            {gh.openCrashes > 0 && <span className="num text-bad">{t('kpi.crashes', { count: gh.openCrashes })}</span>}
            {gh.openBugs > 0 && <span className="num text-review">{t('kpi.bugs', { count: gh.openBugs })}</span>}
            {gh.open - gh.openBugs - gh.openCrashes > 0 && (
              <span className="num text-ink">
                {t(gh.openBugs + gh.openCrashes > 0 ? 'mods.otherIssues' : 'mods.openIssues', { count: gh.open - gh.openBugs - gh.openCrashes })}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted">{t('mods.downloads')}</div>
          <div className="num text-xl leading-tight font-medium text-ink">{formatCount(d.total)}</div>
          <div className="mt-0.5 text-xs">
            <DeltaText value={d.delta7d} suffix={t('mods.sevenDay')} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          {series.length < 2 && <span className="text-xs text-faint">{t('mods.trendNone')}</span>}
          <Sparkline
            values={series}
            width={104}
            height={36}
            color="var(--color-accent)"
            area
            label={growth === null ? undefined : growth > 0 ? t('mods.trendLabel', { count: growth }) : t('mods.trendFlat')}
          />
        </div>
      </div>
      <ProgressBar
        height={5}
        ariaLabel={`${tc('platform.curseforge')} ${formatCount(d.curseforge)}, ${tc('platform.modrinth')} ${formatCount(d.modrinth)}`}
        segments={[
          { key: 'cf', label: tc('platform.curseforge'), value: d.curseforge, color: 'var(--color-cf)', pattern: 0 },
          { key: 'mr', label: tc('platform.modrinth'), value: d.modrinth, color: 'var(--color-mr)', pattern: 1 },
        ]}
      />
      {d.total > 0 && (
        <p className="num -mt-1.5 text-right text-xs text-faint">
          {[
            { name: tc('platform.curseforge'), n: d.curseforge },
            { name: tc('platform.modrinth'), n: d.modrinth },
          ]
            .filter((x) => x.n > 0)
            .map((x) => `${x.name} ${Math.round((x.n / d.total) * 100)}%`)
            .join(' · ')}
        </p>
      )}
    </li>
  )
}
