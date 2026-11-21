// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  src: string | null | undefined
  name: string
  /** Pixel size, square. Default 40. */
  size?: number
  className?: string
}

const HUES = [335, 205, 150, 40, 270, 18, 175, 95]

/** Mod icon with a monogram on a hashed hue when there is no URL or it fails to load. Props: src, name, size, className. Decorative; the name sits next to it. */
export default function ModIcon({ src, name, size = 40, className }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const show = src && failed !== src
  const initials = name
    .split(/[\s:]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  const hue = HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
  const box = { width: size, height: size }
  if (show) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(src)}
        style={box}
        className={cx('shrink-0 rounded-md bg-sunk object-cover', className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, background: `linear-gradient(135deg, hsl(${hue} 45% 34%), hsl(${hue} 40% 18%))`, fontSize: size * 0.38 }}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold text-ink/90', className)}
    >
      {initials}
    </span>
  )
}
