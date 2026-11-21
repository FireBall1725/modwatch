// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import Icon, { type IconName } from './Icon'

interface Props {
  title: string
  description?: ReactNode
  icon?: IconName
  /** A button or link that moves the person forward. */
  action?: ReactNode
  /** Smaller, for inside a card. */
  compact?: boolean
  className?: string
}

/** Nothing here yet, or nothing matches. Props: title, description, icon, action, compact, className. */
export default function EmptyState({ title, description, icon = 'package', action, compact = false, className }: Props) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'gap-2 py-8' : 'gap-3 py-16', className)}>
      <span className="flex size-12 items-center justify-center rounded-full border border-line bg-sunk text-faint">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-base font-medium text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
