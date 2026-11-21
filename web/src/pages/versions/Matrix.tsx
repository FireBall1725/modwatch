// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { formatCompact, formatCount } from '../../lib/format'
import { heatShade } from '../../lib/heat'

export interface MatrixRow {
  key: string
  label: ReactNode
  name: string
}

interface Props {
  rows: MatrixRow[]
  columns: { key: string; label: string }[]
  value: (rowKey: string, colKey: string) => number | undefined
  highlightColumn?: string
  caption: string
  emptyLabel: string
}

const HATCH = 'repeating-linear-gradient(135deg, var(--color-sunk) 0 3px, transparent 3px 7px)'

/** Local copy of the shared Heatmap whose columns stretch to fill the card; the shared table is content width. */
export default function Matrix({ rows, columns, value, highlightColumn, caption, emptyLabel }: Props) {
  const { t } = useTranslation('common')
  let max = 0
  for (const r of rows) for (const c of columns) max = Math.max(max, value(r.key, c.key) ?? 0)
  const shade = (v: number) => heatShade(v, max)
  return (
    <div className="min-w-0 max-w-full">
      <div className="max-w-full overflow-auto overscroll-x-contain rounded-md" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <td className="sticky left-0 z-[2] bg-surface" />
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx('num min-w-16 px-1.5 pb-1 text-center font-medium whitespace-nowrap', c.key === highlightColumn ? 'text-accent' : 'text-muted')}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="sticky left-0 z-[2] w-36 max-w-36 min-w-32 sm:w-56 sm:max-w-56 sm:min-w-40 bg-surface pr-3 text-left font-normal text-ink">
                  <span className="block truncate" title={r.name}>{r.label}</span>
                </th>
                {columns.map((c) => {
                  const v = value(r.key, c.key)
                  const tip = `${r.name}, ${c.label}: ${v === undefined ? emptyLabel : formatCount(v)}`
                  return v === undefined ? (
                    <td key={c.key} title={tip} aria-label={tip} className="h-8 rounded-sm" style={{ background: HATCH }} />
                  ) : (
                    <td
                      key={c.key}
                      title={tip}
                      tabIndex={0}
                      aria-label={tip}
                      className={'num h-8 rounded-sm px-1.5 text-center text-ink'}
                      style={{ background: shade(v) }}
                    >
                      {formatCompact(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
        <span className="flex items-center gap-2">
          {t('chart.fewer')}
          <span className="h-2.5 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${shade(0)}, ${shade(max || 1)})` }} />
          {t('chart.more')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm" style={{ background: HATCH }} />
          {emptyLabel}
        </span>
      </div>
    </div>
  )
}
