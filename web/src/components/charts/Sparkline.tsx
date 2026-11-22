// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useId } from 'react'
import { sparklinePoints } from '../../lib/format'

interface Props {
  /** Values oldest first. Fewer than two draws a flat dotted baseline. */
  values: number[]
  width?: number
  height?: number
  /** CSS colour. Default the accent. */
  color?: string
  /** Fill under the line. */
  area?: boolean
  /** Accessible description, such as "Downloads, last 30 days: up 120". Without it the sparkline is decorative. */
  label?: string
  className?: string
}

/** Tiny trend line with an end dot. Give it a label unless it is decorative. */
export default function Sparkline({ values, width = 96, height = 28, color = 'var(--color-accent)', area = false, label, className }: Props) {
  const gid = useId().replace(/\W/g, '')
  const pts = sparklinePoints(values, width, height, 3)
  const last = pts ? pts.split(' ').at(-1)!.split(',').map(Number) : null
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      {!pts && <line x1="3" x2={width - 3} y1={height / 2} y2={height / 2} stroke="var(--color-line-strong)" strokeDasharray="2 3" />}
      {pts && area && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.35" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`3,${height} ${pts} ${width - 3},${height}`} fill={`url(#${gid})`} />
        </>
      )}
      {pts && <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />}
      {last && <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />}
    </svg>
  )
}
