// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { formatCount, formatPercent } from '../../lib/format'

export interface DonutSegment {
  key: string
  label: string
  value: number
  color: string
}

interface Props {
  segments: DonutSegment[]
  /** Outer diameter in px. Default 160. */
  size?: number
  /** Centre content: the total and a caption. */
  center?: ReactNode
  format?: (n: number) => string
  /** Names the chart for screen readers. */
  ariaLabel: string
  /** Show the legend with value and share. Default true. */
  legend?: boolean
  className?: string
}

/**
 * Share-of-whole ring for up to five parts; use BarList beyond that.
 * The legend lists name, value and percentage so colour is never the only cue.
 */
export default function Donut({ segments, size = 160, center, format = formatCount, ariaLabel, legend = true, className }: Props) {
  const [hot, setHot] = useState<string | null>(null)
  const total = segments.reduce((a, s) => a + s.value, 0)
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0
  let offset = 0
  return (
    <div className={cx('flex flex-wrap items-center gap-x-6 gap-y-3', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${ariaLabel}: ${segments.map((s) => `${s.label} ${formatPercent(total ? s.value / total : 0)}`).join(', ')}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunk)" strokeWidth="14" />
          {total > 0 &&
            segments.map((s) => {
              if (s.value <= 0) return null
              const len = (s.value / total) * c
              const el = (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hot === s.key ? 18 : 14}
                  strokeDasharray={`${Math.max(0, len - gap)} ${c - Math.max(0, len - gap)}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  opacity={hot && hot !== s.key ? 0.45 : 1}
                  style={{ transition: 'stroke-width 150ms, opacity 150ms' }}
                />
              )
              offset += len
              return el
            })}
        </svg>
        {center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
      </div>
      {legend && (
        <ul className="min-w-0 space-y-1.5 text-sm">
          {segments.map((s, i) => (
            <li
              key={s.key}
              tabIndex={0}
              onMouseEnter={() => setHot(s.key)}
              onMouseLeave={() => setHot(null)}
              onFocus={() => setHot(s.key)}
              onBlur={() => setHot(null)}
              className="flex items-center gap-2 rounded-sm"
            >
              <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-[3px]" style={{ background: s.color, backgroundImage: i % 2 ? 'repeating-linear-gradient(135deg, rgb(0 0 0 / 0.28) 0 2px, transparent 2px 5px)' : undefined }} />
              <span className="text-muted">{s.label}</span>
              <span className="num text-ink">{format(s.value)}</span>
              <span className="num text-faint">{formatPercent(total ? s.value / total : 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
