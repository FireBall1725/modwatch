// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import Icon, { type IconName } from './Icon'

export type Tone = 'ok' | 'review' | 'bad' | 'neutral' | 'inactive' | 'info' | 'accent' | 'cf' | 'mr'

const TONE: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok border-ok/30',
  review: 'bg-review-soft text-review border-review/30',
  bad: 'bg-bad-soft text-bad border-bad/30',
  neutral: 'bg-neutral-soft text-neutral border-neutral/25',
  inactive: 'bg-inactive-soft text-inactive border-inactive/25',
  info: 'bg-info-soft text-info border-info/30',
  accent: 'bg-accent-soft text-accent border-accent/30',
  cf: 'bg-cf-soft text-cf border-cf/35',
  mr: 'bg-mr-soft text-mr border-mr/35',
}

interface Props {
  tone: Tone
  icon?: IconName
  size?: 'sm' | 'md'
  className?: string
  title?: string
  children: ReactNode
}

/** Small rounded label with a tone, an optional icon and text. The base of StatusChip, SeverityBadge and the kind labels. */
export default function Pill({ tone, icon, size = 'md', className, title, children }: Props) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-full border font-medium leading-none whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-1 text-2xs' : 'px-2 py-1 text-xs',
        TONE[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      <span className="truncate">{children}</span>
    </span>
  )
}
