// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { sparklinePoints } from '../lib/format'

interface Props {
  values: number[]
  width?: number
  height?: number
}

/** A small trend line. The range is the line's own, so it shows direction, not size. */
export default function Sparkline({ values, width = 96, height = 24 }: Props) {
  const points = sparklinePoints(values, width, height)
  if (!points) return <span className="text-muted">–</span>
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
