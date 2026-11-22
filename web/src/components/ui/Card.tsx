// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ElementType, ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  title?: ReactNode
  description?: ReactNode
  /** Right side of the header: a range selector, a button. */
  actions?: ReactNode
  /** Default true. Set false for tables and lists that run edge to edge. */
  padded?: boolean
  as?: ElementType
  className?: string
  id?: string
  children?: ReactNode
}

/** Surface panel. The title is a level 2 heading. */
export default function Card({ title, description, actions, padded = true, as: Tag = 'section', className, id, children }: Props) {
  const labelled = typeof title === 'string' && id ? `${id}-title` : undefined
  return (
    <Tag id={id} aria-labelledby={labelled} className={cx('rounded-lg border border-line bg-surface shadow-e1', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 id={labelled} className="text-base font-semibold text-ink">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(padded && 'p-4 sm:p-5', Boolean(title || actions) && padded && '!pt-3')}>{children}</div>
    </Tag>
  )
}
