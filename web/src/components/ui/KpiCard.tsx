// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'
import Icon, { type IconName } from './Icon'
import Skeleton from './Skeleton'

interface Props {
  label: string
  /** The big figure, already formatted. Wrap it in .num yourself only if it is not a plain string. */
  value: ReactNode
  /** Small text after the value, such as "mods". */
  unit?: string
  icon?: IconName
  /** Tints the icon and a left rule: ok, bad, review or accent. Default none. */
  tone?: 'ok' | 'bad' | 'review' | 'accent'
  /** Line under the value: deltas, a split bar, a note. */
  footer?: ReactNode
  /** Makes the whole card a link. */
  href?: string
  loading?: boolean
  className?: string
}

const TONE = {
  ok: 'text-ok before:bg-ok',
  bad: 'text-bad before:bg-bad',
  review: 'text-review before:bg-review',
  accent: 'text-accent before:bg-accent',
}

/** Headline figure with a label and an optional footer. With an href the card becomes a link. */
export default function KpiCard({ label, value, unit, icon, tone, footer, href, loading, className }: Props) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-muted">{label}</span>
        {icon && <Icon name={icon} size={16} className={tone ? TONE[tone].split(' ')[0] : 'text-faint'} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <span className="num text-[1.75rem] leading-none font-medium text-ink">{value}</span>
        )}
        {unit && !loading && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {(footer || loading) && <div className="mt-3 text-sm text-muted">{loading ? <Skeleton className="h-4 w-40" /> : footer}</div>}
    </>
  )
  const classes = cx(
    'relative block overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-e1',
    tone && 'before:absolute before:inset-y-0 before:left-0 before:w-0.5 ' + TONE[tone].split(' ')[1],
    href && 'transition-colors hover:border-line-strong hover:bg-sunk',
    className,
  )
  return href ? (
    <Link to={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  )
}
