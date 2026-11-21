// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import { formatCount } from '../../lib/format'

export interface BarItem {
  key: string
  label: ReactNode
  value: number
  /** Splits the bar into parts that sum to value; each needs a label for the tooltip and text alternative. */
  parts?: { key: string; label: string; value: number; color: string }[]
  /** Solid colour when there are no parts. Default the accent. */
  color?: string
  /** Text at the far right instead of the value, such as "48.3k  +120". */
  trailing?: ReactNode
  /** Makes the label a link. */
  href?: string
  /** Leading element, such as a ModIcon. */
  leading?: ReactNode
}

interface Props {
  items: BarItem[]
  /** Items shown before "Show all". Default 8; 0 shows all. */
  topN?: number
  format?: (n: number) => string
  /** Format for tooltips and the text alternative. Default the same as format. */
  tooltipFormat?: (n: number) => string
  /** The scale's maximum. Default the largest item, so bars in sibling lists can share a scale. */
  max?: number
  /** Names the list for screen readers. */
  ariaLabel: string
  className?: string
}

/**
 * Horizontal bars with the value written at the end, so the number never depends on the bar. Props: items (key,
 * label, value, parts, color, trailing, href, leading), topN, format, max, ariaLabel. Split bars show their parts in the tooltip.
 */
export default function BarList({ items, topN = 8, format = formatCount, tooltipFormat = format, max, ariaLabel, className }: Props) {
  const { t } = useTranslation('common')
  const [all, setAll] = useState(false)
  const limit = topN > 0 && !all ? topN : items.length
  const shown = items.slice(0, limit)
  const top = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <div className={className}>
      <ul aria-label={ariaLabel} className="space-y-2.5">
        {shown.map((it) => {
          const label = it.href ? (
            <Link to={it.href} className="truncate text-ink hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="truncate text-ink">{it.label}</span>
          )
          const title = it.parts?.map((p) => `${p.label}: ${tooltipFormat(p.value)}`).join(' · ')
          return (
            <li key={it.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                {it.leading}
                {label}
              </div>
              <span className="num text-right text-ink">{it.trailing ?? format(it.value)}</span>
              <div className="col-span-2 h-2 overflow-hidden rounded-full bg-sunk" title={title}>
                <div className="flex h-full gap-px" style={{ width: `${Math.max(it.value > 0 ? 1.5 : 0, (it.value / top) * 100)}%` }}>
                  {it.parts ? (
                    it.parts
                      .filter((p) => p.value > 0)
                      .map((p, i) => (
                        <div
                          key={p.key}
                          style={{
                            width: `${(p.value / Math.max(1, it.value)) * 100}%`,
                            background: p.color,
                            backgroundImage: i % 2 ? 'repeating-linear-gradient(135deg, rgb(0 0 0 / 0.28) 0 2px, transparent 2px 5px)' : undefined,
                          }}
                        />
                      ))
                  ) : (
                    <div className="h-full w-full" style={{ background: it.color ?? 'var(--color-accent)' }} />
                  )}
                </div>
              </div>
              {it.parts && (
                <span className="sr-only">
                  {it.parts.map((p) => `${p.label} ${tooltipFormat(p.value)}`).join(', ')}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {topN > 0 && items.length > topN && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className={cx('mt-3 cursor-pointer text-sm text-muted underline decoration-line-strong underline-offset-2 hover:text-ink')}
        >
          {all ? t('word.showFewer') : t('word.showAll', { count: items.length })}
        </button>
      )}
    </div>
  )
}
