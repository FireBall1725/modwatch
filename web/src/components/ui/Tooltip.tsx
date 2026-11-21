// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { cloneElement, isValidElement, useId, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  /** Short text. Longer explanations belong on the page. */
  content: ReactNode
  side?: 'top' | 'bottom'
  className?: string
  children: ReactNode
}

/**
 * Hover and keyboard-focus tooltip around any content. Props: content, side (top or bottom), className. The trigger must be
 * focusable (a button or link) for keyboard users. The description id is put on the trigger itself, Escape hides the tip,
 * and the tip stays open while the pointer is over it (it has no gap to cross).
 */
export default function Tooltip({ content, side = 'top', className, children }: Props) {
  const id = useId()
  const [dismissed, setDismissed] = useState(false)
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': id })
    : children
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setDismissed(true)
  }
  return (
    <span
      className={cx('group/tip relative inline-flex', className)}
      onKeyDown={onKeyDown}
      onPointerLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {trigger}
      <span
        className={cx(
          'pointer-events-none absolute left-1/2 z-[50] -translate-x-1/2 opacity-0 transition-opacity duration-150',
          !dismissed && 'group-hover/tip:pointer-events-auto group-hover/tip:opacity-100 group-focus-within/tip:pointer-events-auto group-focus-within/tip:opacity-100',
          side === 'top' ? 'bottom-full pb-2' : 'top-full pt-2',
        )}
      >
        <span
          id={id}
          role="tooltip"
          className="block w-max max-w-64 rounded-md border border-line-strong bg-raised px-2.5 py-1.5 text-xs font-normal whitespace-normal text-ink shadow-e3"
        >
          {content}
        </span>
      </span>
    </span>
  )
}
