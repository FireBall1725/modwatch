// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { formatCompact, formatCount } from '../../lib/format'
import { heatShade } from '../../lib/heat'

export interface HeatRow {
  key: string
  label: ReactNode
  /** Plain-text name for the text alternative when label is not a string. */
  name: string
}

export interface HeatColumn {
  key: string
  label: string
}

interface Props {
  rows: HeatRow[]
  columns: HeatColumn[]
  /** The value for a cell, or undefined when the row has nothing for that column (drawn as a hatched gap). */
  value: (rowKey: string, colKey: string) => number | undefined
  /** Cell text. Default compact (48k). */
  format?: (n: number) => string
  /** Tooltip text. Default grouped. */
  tooltipFormat?: (n: number) => string
  /** Highlight a column, such as the newest Minecraft version. */
  highlightColumn?: string
  /** Names the matrix for screen readers. */
  caption: string
  /** Text for a missing cell in the tooltip and legend. */
  emptyLabel: string
  className?: string
}

/**
 * Rows by columns grid with a value scale. It is a real table: sticky row labels and header, a number in every filled
 * cell so colour is never the only cue, and a hatched cell for no data. Intensity is square-root scaled so a huge cell does
 * not flatten the small ones. Props: rows, columns, value, format, tooltipFormat, highlightColumn, caption, emptyLabel.
 */
export default function Heatmap({ rows, columns, value, format = formatCompact, tooltipFormat = formatCount, highlightColumn, caption, emptyLabel, className }: Props) {
  const { t } = useTranslation('common')
  let max = 0
  for (const r of rows) for (const c of columns) max = Math.max(max, value(r.key, c.key) ?? 0)
  const shade = (v: number) => heatShade(v, max)
  return (
    <div className={className}>
      <div className="overflow-auto rounded-md" tabIndex={0} role="region" aria-label={caption}>
        <table className="w-full border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <td className="sticky left-0 z-[2] bg-surface" />
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cx('num px-1.5 pb-1 text-center font-medium whitespace-nowrap', c.key === highlightColumn ? 'text-accent' : 'text-muted')}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="sticky left-0 z-[2] max-w-48 bg-surface pr-3 text-left font-normal text-ink">
                  <span className="block truncate">{r.label}</span>
                </th>
                {columns.map((c) => {
                  const v = value(r.key, c.key)
                  const tip = `${r.name}, ${c.label}: ${v === undefined ? emptyLabel : tooltipFormat(v)}`
                  return v === undefined ? (
                    <td
                      key={c.key}
                      title={tip}
                      aria-label={tip}
                      className="h-8 min-w-12 rounded-sm"
                      style={{ background: 'repeating-linear-gradient(135deg, var(--color-sunk) 0 3px, transparent 3px 7px)' }}
                    />
                  ) : (
                    <td
                      key={c.key}
                      title={tip}
                      tabIndex={0}
                      aria-label={tip}
                      className={'num h-8 min-w-12 rounded-sm px-1.5 text-center text-ink'}
                      style={{ background: shade(v) }}
                    >
                      {format(v)}
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
          <span className="inline-block h-3 w-5 rounded-sm" style={{ background: 'repeating-linear-gradient(135deg, var(--color-sunk) 0 3px, transparent 3px 7px)' }} />
          {emptyLabel}
        </span>
      </div>
    </div>
  )
}
