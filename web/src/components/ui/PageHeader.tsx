// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  title: ReactNode
  description?: ReactNode
  /** Small line above the title: a breadcrumb, a back link. */
  eyebrow?: ReactNode
  /** Right side: buttons, range selectors. Wraps under the title on narrow screens. */
  actions?: ReactNode
  /** Something left of the title, such as a mod icon. */
  leading?: ReactNode
  className?: string
}

/** Page title block. Props: title (the page's h1), description, eyebrow, actions, leading. Every page renders exactly one. */
export default function PageHeader({ title, description, eyebrow, actions, leading, className }: Props) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-xs font-medium tracking-wide text-faint">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
