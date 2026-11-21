// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import type { History, ModStat } from '../lib/api'
import { formatCount, formatDelta, relativeTime } from '../lib/format'
import Sparkline from './Sparkline'

interface Props {
  mods: ModStat[]
  history: History
}

function Delta({ n }: { n: number | null }) {
  const colour = n === null || n === 0 ? 'text-muted' : n > 0 ? 'text-up' : 'text-down'
  return <span className={`num ${colour}`}>{formatDelta(n)}</span>
}

export default function ModsTable({ mods, history }: Props) {
  const { t } = useTranslation()
  if (mods.length === 0) {
    return <p className="rounded-lg border border-line bg-surface px-4 py-8 text-center text-muted">{t('table.empty')}</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2 font-medium">{t('table.mod')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('table.downloads')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('table.day')}</th>
            <th className="px-4 py-2 text-right font-medium">{t('table.week')}</th>
            <th className="px-4 py-2 font-medium">{t('table.trend')}</th>
            <th className="hidden px-4 py-2 font-medium md:table-cell">{t('table.updated')}</th>
          </tr>
        </thead>
        <tbody>
          {mods.map((m) => {
            const rel = m.dateModified ? relativeTime(m.dateModified) : null
            return (
              <tr key={m.id} className="border-b border-line last:border-0 hover:bg-sunk">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    {m.logoUrl ? (
                      <img src={m.logoUrl} alt="" width={28} height={28} className="rounded bg-sunk" loading="lazy" />
                    ) : (
                      <span className="size-7 rounded bg-sunk" aria-hidden="true" />
                    )}
                    <a href={m.websiteUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-accent">
                      {m.name}
                    </a>
                    {!m.owned && <span className="rounded-full bg-sunk px-2 py-0.5 text-xs text-muted">{t('table.member')}</span>}
                  </div>
                </td>
                <td className="num px-4 py-2 text-right">{formatCount(m.downloads)}</td>
                <td className="px-4 py-2 text-right"><Delta n={m.delta24h} /></td>
                <td className="px-4 py-2 text-right"><Delta n={m.delta7d} /></td>
                <td className="px-4 py-2">
                  <Sparkline values={(history[String(m.id)] ?? []).map((s) => s.downloads)} />
                </td>
                <td className="hidden px-4 py-2 text-muted md:table-cell">
                  {rel ? t(`time.${rel.key}`, { count: rel.count }) : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
