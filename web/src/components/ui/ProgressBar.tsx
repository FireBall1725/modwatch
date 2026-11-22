// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { cx } from '../../lib/cx'

export interface BarSegment {
  key: string
  label: string
  value: number
  /** CSS colour, a token such as var(--color-cf). */
  color: string
  /** Pattern index for the non-colour cue: 0 solid, 1 diagonal stripes, 2 dots. */
  pattern?: 0 | 1 | 2
}

interface Props {
  segments: BarSegment[]
  /** Bar height in px. Default 8. */
  height?: number
  /** Text alternative; defaults to "label value, label value". */
  ariaLabel?: string
  /** Format for the legend values. */
  format?: (n: number) => string
  /** Show a legend of name, value and share under the bar. */
  legend?: boolean
  className?: string
}

/** Stacked share bar, for the CurseForge and Modrinth split. Segments differ by pattern as well as colour. */
export default function ProgressBar({ segments, height = 8, ariaLabel, format = (n) => String(n), legend = false, className }: Props) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const label = ariaLabel ?? segments.map((s) => `${s.label} ${format(s.value)}`).join(', ')
  return (
    <div className={className}>
      <div
        role="img"
        aria-label={label}
        className="flex w-full gap-px overflow-hidden rounded-full bg-sunk"
        style={{ height }}
      >
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s, i) => (
              <div
                key={s.key}
                style={{
                  width: `${(s.value / total) * 100}%`,
                  background: s.color,
                  backgroundImage: patternImage(s.pattern ?? (i % 3) as 0 | 1 | 2),
                }}
              />
            ))}
      </div>
      {legend && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {segments.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cx('inline-block size-2.5 rounded-[3px]')}
                style={{ background: s.color, backgroundImage: patternImage(s.pattern ?? (i % 3) as 0 | 1 | 2) }}
              />
              {s.label}
              <span className="num text-ink">{format(s.value)}</span>
              <span className="num text-faint">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function patternImage(p: 0 | 1 | 2): string | undefined {
  if (p === 1) return 'repeating-linear-gradient(135deg, rgb(0 0 0 / 0.28) 0 2px, transparent 2px 5px)'
  if (p === 2) return 'radial-gradient(rgb(0 0 0 / 0.3) 1px, transparent 1.4px)'
  return undefined
}
