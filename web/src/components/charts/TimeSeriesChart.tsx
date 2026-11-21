// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { formatCompact, formatCount, formatShortDate } from '../../lib/format'
import { useElementWidth } from '../../hooks/useElementWidth'
import { linearScale, linePath, nearestIndex, niceTicks, pickIndices, runs, stackTops } from './scale'

export interface ChartSeries {
  key: string
  label: string
  /** CSS colour, usually a token such as var(--color-cf). */
  color: string
  /** One value per x, null where there is no data. */
  values: (number | null)[]
}

interface Props {
  /** ISO time per point, oldest first. */
  x: string[]
  series: ChartSeries[]
  kind?: 'line' | 'area' | 'bar'
  /** Stack series on top of each other (area and bar). */
  stacked?: boolean
  height?: number
  /** Axis labels. Default compact (48k). */
  format?: (n: number) => string
  /** Tooltip values. Default grouped (48,310). */
  tooltipFormat?: (n: number) => string
  /** X labels and tooltip heading. Default "Nov 21". */
  xFormat?: (iso: string) => string
  /** What the chart shows, for the text alternative, such as "Downloads per day, last 30 days". */
  caption: string
  /** Show the legend. Default true when there are two or more series. */
  legend?: boolean
  /** Start the y axis at the data minimum rather than zero (line only). */
  zoomY?: boolean
  className?: string
}

const DASHES = ['', '7 4', '2 4', '10 3 2 3']
const M = { t: 10, r: 12, b: 26 }

/**
 * Responsive SVG time series: lines, areas or bars, optionally stacked, any number of series. Hover or arrow keys
 * (focus the chart) show a tooltip with every series at that point. Series differ by dash pattern and legend marker as well
 * as colour; the legend toggles series. A visually hidden table carries the data for screen readers.
 * Props: x, series, kind, stacked, height, format, tooltipFormat, xFormat, caption, legend, zoomY, className.
 */
export default function TimeSeriesChart({
  x,
  series,
  kind = 'line',
  stacked = false,
  height = 260,
  format = formatCompact,
  tooltipFormat = formatCount,
  xFormat = formatShortDate,
  caption,
  legend,
  zoomY = false,
  className,
}: Props) {
  const { t } = useTranslation('common')
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const gid = useId().replace(/\W/g, '')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<number | null>(null)
  // What the polite live region says. Only keyboard moves set it; pointer moves update the picture and stay silent.
  const [spoken, setSpoken] = useState('')

  const visible = useMemo(() => series.filter((s) => !hidden.has(s.key)), [series, hidden])
  const n = x.length
  const showLegend = legend ?? series.length > 1
  const stack = stacked && kind !== 'line'

  const layout = useMemo(() => {
    const tops = stack ? stackTops(visible.map((s) => s.values)) : null
    const all = stack ? (tops?.at(-1) ?? []) : visible.flatMap((s) => s.values.filter((v): v is number => v !== null))
    const dataMax = all.length ? Math.max(...all) : 0
    const dataMin = zoomY && kind === 'line' && all.length ? Math.min(...all) : 0
    const tk = niceTicks(dataMin, dataMax, width < 480 ? 4 : 5)
    const labelWidth = Math.max(...tk.ticks.map((v) => format(v).length), 2) * 6.6 + 10
    return { tops, tk, left: Math.max(36, Math.round(labelWidth)) }
  }, [visible, stack, zoomY, kind, width, format])

  const left = layout.left
  const innerW = Math.max(0, width - left - M.r)
  const innerH = height - M.t - M.b
  const y = linearScale(layout.tk.min, layout.tk.max, M.t + innerH, M.t)
  const step = n > 1 ? innerW / (n - 1) : innerW
  const bandW = n > 0 ? innerW / n : innerW
  const xAt = (i: number) => (kind === 'bar' ? left + bandW * (i + 0.5) : left + (n > 1 ? i * step : innerW / 2))
  const xTicks = pickIndices(n, Math.max(2, Math.floor(innerW / 90)))

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const [a, b] = kind === 'bar' ? [left + bandW / 2, left + innerW - bandW / 2] : [left, left + innerW]
    setActive(nearestIndex(px, n, a, b))
  }
  const onKey = (e: KeyboardEvent) => {
    if (n === 0) return
    const cur = active ?? n - 1
    const map: Record<string, number> = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 }
    if (e.key === 'Escape') {
      setSpoken('')
      return setActive(null)
    }
    if (e.key in map) {
      e.preventDefault()
      const next = Math.min(n - 1, Math.max(0, map[e.key]))
      setActive(next)
      setSpoken(`${xFormat(x[next])}: ${visible.map((s) => `${s.label} ${s.values[next] === null ? '–' : tooltipFormat(s.values[next])}`).join(', ')}`)
    }
  }

  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(key)) next.delete(key)
      else if (visible.length > 1) next.add(key)
      return next
    })

  const summary = series
    .map((s) => {
      const vals = s.values.filter((v): v is number => v !== null)
      return vals.length ? `${s.label}: ${tooltipFormat(vals[0])} to ${tooltipFormat(vals[vals.length - 1])}` : null
    })
    .filter(Boolean)
    .join('. ')
  const rowsForTable = Array.from({ length: n }, (_, i) => i)
  const hasData = n > 0 && series.some((s) => s.values.some((v) => v !== null))

  const tipLeft = active === null ? 0 : xAt(active)
  const flip = active !== null && tipLeft > left + innerW / 2

  return (
    <figure className={cx('relative m-0', className)}>
      {showLegend && (
        <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1" aria-label={t('chart.legend')}>
          {series.map((s, i) => {
            const off = hidden.has(s.key)
            return (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={!off}
                  onClick={() => toggle(s.key)}
                  className={cx(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs',
                    off ? 'text-faint line-through' : 'text-muted hover:text-ink',
                  )}
                >
                  <LegendMark color={s.color} kind={kind} dash={DASHES[i % DASHES.length]} index={i} off={off} />
                  {s.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div
        ref={ref}
        className="relative touch-pan-y outline-none"
        style={{ height }}
        tabIndex={hasData ? 0 : -1}
        role="group"
        aria-label={`${caption}. ${t('chart.keyboardHint')}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        onKeyDown={onKey}
        onBlur={() => {
          setActive(null)
          setSpoken('')
        }}
      >
        {width > 0 && hasData && (
          <svg width={width} height={height} className="block" aria-hidden="true">
            <defs>
              {visible.map((s) => (
                <linearGradient key={s.key} id={`${gid}${s.key.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={s.color} stopOpacity={stack ? 0.55 : 0.28} />
                  <stop offset="1" stopColor={s.color} stopOpacity={stack ? 0.3 : 0} />
                </linearGradient>
              ))}
            </defs>
            {layout.tk.ticks.map((v) => (
              <g key={v}>
                <line x1={left} x2={left + innerW} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v === layout.tk.min ? undefined : '2 4'} />
                <text x={left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="num" fontSize="11" fill="var(--color-faint)">
                  {format(v)}
                </text>
              </g>
            ))}
            {xTicks.map((i) => (
              <text
                key={i}
                x={xAt(i)}
                y={height - 7}
                textAnchor={i === 0 && kind !== 'bar' ? 'start' : i === n - 1 && kind !== 'bar' ? 'end' : 'middle'}
                fontSize="11"
                fill="var(--color-faint)"
              >
                {xFormat(x[i])}
              </text>
            ))}

            {kind === 'bar' &&
              visible.map((s, si) =>
                s.values.map((v, i) => {
                  if (v === null) return null
                  const groupW = Math.max(1, bandW * 0.72)
                  const w = stack ? groupW : groupW / visible.length
                  const x0 = xAt(i) - groupW / 2 + (stack ? 0 : si * w)
                  const top = layout.tops ? layout.tops[si][i] : v
                  const base = layout.tops && si > 0 ? layout.tops[si - 1][i] : 0
                  const yTop = y(top)
                  const h = Math.max(0, y(base) - yTop)
                  return <rect key={`${s.key}${i}`} x={x0} y={yTop} width={Math.max(1, w - (w > 4 ? 1 : 0))} height={h} rx={w > 6 ? 2 : 0} fill={s.color} opacity={active === null || active === i ? 1 : 0.55} />
                }),
              )}

            {kind === 'area' &&
              visible.map((s, si) =>
                runs(s.values).map((run, ri) => {
                  const topPts: [number, number][] = run.map(([i, v]) => [xAt(i), y(layout.tops ? layout.tops[si][i] : v)])
                  const basePts: [number, number][] = run.map(([i]) => [xAt(i), y(layout.tops && si > 0 ? layout.tops[si - 1][i] : 0)]).reverse() as [number, number][]
                  return <path key={`${s.key}a${ri}`} d={`${linePath(topPts)} L${basePts.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(' L')} Z`} fill={`url(#${gid}${s.key.replace(/\W/g, '')})`} />
                }),
              )}

            {kind !== 'bar' &&
              visible.map((s, si) => {
                const idx = series.indexOf(s)
                return runs(s.values).map((run, ri) => {
                  const pts: [number, number][] = run.map(([i, v]) => [xAt(i), y(layout.tops ? layout.tops[si][i] : v)])
                  return pts.length === 1 ? (
                    <circle key={`${s.key}${ri}`} cx={pts[0][0]} cy={pts[0][1]} r="3" fill={s.color} />
                  ) : (
                    <path
                      key={`${s.key}${ri}`}
                      d={linePath(pts)}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={kind === 'line' && !stack ? DASHES[idx % DASHES.length] || undefined : undefined}
                    />
                  )
                })
              })}

            {active !== null && (
              <g>
                {kind !== 'bar' && <line x1={xAt(active)} x2={xAt(active)} y1={M.t} y2={M.t + innerH} stroke="var(--color-line-strong)" />}
                {kind !== 'bar' &&
                  visible.map((s, si) => {
                    const v = s.values[active]
                    if (v === null) return null
                    return <circle key={s.key} cx={xAt(active)} cy={y(layout.tops ? layout.tops[si][active] : v)} r="4" fill="var(--color-ground)" stroke={s.color} strokeWidth="2" />
                  })}
              </g>
            )}
          </svg>
        )}
        {width > 0 && !hasData && (
          <p className="flex h-full items-center justify-center text-sm text-muted">{t('chart.noData')}</p>
        )}
        {active !== null && hasData && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-[50] min-w-40 rounded-md border border-line-strong bg-raised px-3 py-2 text-xs shadow-e3"
            style={{ top: M.t, left: flip ? undefined : tipLeft + 14, right: flip ? width - tipLeft + 14 : undefined }}
          >
            <p className="mb-1 font-medium text-ink">{xFormat(x[active])}</p>
            <ul className="space-y-0.5">
              {visible.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted">
                    <LegendMark color={s.color} kind={kind} dash={DASHES[series.indexOf(s) % DASHES.length]} index={series.indexOf(s)} />
                    {s.label}
                  </span>
                  <span className="num text-ink">{s.values[active] === null ? '–' : tooltipFormat(s.values[active])}</span>
                </li>
              ))}
              {stack && visible.length > 1 && (
                <li className="flex items-center justify-between gap-4 border-t border-line pt-1 text-muted">
                  <span>{t('chart.total')}</span>
                  <span className="num text-ink">{tooltipFormat(layout.tops?.at(-1)?.[active] ?? 0)}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {spoken}
      </p>
      <figcaption className="sr-only">
        {caption}. {summary}
      </figcaption>
      {hasData && (
        // The table sits in its own clipped box: an absolutely positioned table ignores overflow and width and would widen the page.
        <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{t('chart.date')}</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsForTable.map((i) => (
              <tr key={i}>
                <th scope="row">{xFormat(x[i])}</th>
                {series.map((s) => (
                  <td key={s.key}>{s.values[i] === null ? '–' : tooltipFormat(s.values[i])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </figure>
  )
}

const MARKS = ['square', 'circle', 'diamond', 'triangle'] as const

/** Legend swatch: a dashed stroke for lines, a distinct shape for areas and bars. */
function LegendMark({ color, kind, dash, index, off }: { color: string; kind: string; dash: string; index: number; off?: boolean }) {
  const shape = MARKS[index % MARKS.length]
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden="true" opacity={off ? 0.4 : 1} className="shrink-0">
      {kind === 'line' ? (
        <line x1="1" x2="17" y1="5" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dash || undefined} strokeLinecap="round" />
      ) : shape === 'circle' ? (
        <circle cx="9" cy="5" r="4" fill={color} />
      ) : shape === 'diamond' ? (
        <path d="M9 .5L13.5 5 9 9.5 4.5 5z" fill={color} />
      ) : shape === 'triangle' ? (
        <path d="M9 .8L13.6 9.2H4.4z" fill={color} />
      ) : (
        <rect x="5" y="1" width="8" height="8" rx="1.5" fill={color} />
      )}
    </svg>
  )
}
