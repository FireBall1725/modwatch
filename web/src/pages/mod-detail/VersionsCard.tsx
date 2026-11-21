// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import BarList from '../../components/charts/BarList'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PartialCountsNote from '../../components/ui/PartialCountsNote'
import Pill from '../../components/ui/Pill'
import type { VersionTotal } from '../../lib/types'
import { formatCount } from '../../lib/format'
import { versionRows } from './logic'

/** Downloads per Minecraft version for this mod, newest version on top, split by platform. */
export default function VersionsCard({ versions, loaders }: { versions: VersionTotal[]; loaders: string[] }) {
  const { t } = useTranslation('modDetail')
  const { t: tc } = useTranslation('common')
  const items = useMemo(
    () =>
      versionRows(versions).map((v) => ({
        key: v.name,
        label: (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="num font-medium">{v.name}</span>
            <span className="text-xs text-muted">
              {tc('platform.curseforge')} {formatCount(v.curseforge)} · {tc('platform.modrinth')} {formatCount(v.modrinth)}
            </span>
          </span>
        ),
        value: v.downloads,
        trailing: (
          <>
            {formatCount(v.downloads)}
            <span className="ml-1.5 text-xs text-muted">{t('versions.files', { count: v.files })}</span>
          </>
        ),
        parts: [
          { key: 'curseforge', label: tc('platform.curseforge'), value: v.curseforge, color: 'var(--color-cf)' },
          { key: 'modrinth', label: tc('platform.modrinth'), value: v.modrinth, color: 'var(--color-mr)' },
        ],
      })),
    [versions, t, tc],
  )
  return (
    <Card title={t('versions.title')} description={t('versions.description')}>
      {items.length === 0 ? (
        <EmptyState compact icon="versions" title={t('versions.empty')} />
      ) : (
        <BarList items={items} topN={10} ariaLabel={t('versions.aria')} />
      )}
      {items.length > 0 && <PartialCountsNote className="mt-3" />}
      {loaders.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm text-muted">
          <span>{t('versions.loaders')}</span>
          {loaders.map((l) => (
            <Pill key={l} tone="neutral" size="sm">
              {l}
            </Pill>
          ))}
        </div>
      )}
    </Card>
  )
}
