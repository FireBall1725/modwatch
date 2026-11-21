// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { VersionTotal } from '../lib/api'
import { formatCount } from '../lib/format'

const TOP = 8

function Bars({ title, rows }: { title: string; rows: VersionTotal[] }) {
  const { t } = useTranslation()
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, TOP)
  const max = Math.max(1, ...rows.map((r) => r.downloads))

  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-3">
      <h2 className="text-xs uppercase tracking-wide text-muted">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('versions.empty')}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {shown.map((r) => (
            <li key={r.name} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="num truncate" title={r.name}>{r.name}</span>
              <span className="h-2 rounded-full bg-sunk" aria-hidden="true">
                <span className="block h-2 rounded-full bg-accent" style={{ width: `${Math.max(2, (r.downloads / max) * 100)}%` }} />
              </span>
              <span className="num text-right text-muted" title={t('versions.files', { count: r.files })}>
                {formatCount(r.downloads)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > TOP && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs text-accent hover:underline">
          {all ? t('versions.showLess') : t('versions.showAll', { count: rows.length })}
        </button>
      )}
    </section>
  )
}

interface Props {
  gameVersions: VersionTotal[]
  loaders: VersionTotal[]
}

export default function VersionsPanel({ gameVersions, loaders }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 lg:grid-cols-2">
        <Bars title={t('versions.minecraft')} rows={gameVersions} />
        <Bars title={t('versions.loaders')} rows={loaders} />
      </div>
      <p className="text-xs text-muted">{t('versions.hint')}</p>
    </div>
  )
}
