// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  /** Short text. Longer explanations belong on the page. */
  content: ReactNode
  side?: 'top' | 'bottom'
  className?: string
  children: ReactNode
}

/**
 * Hover and keyboard-focus tooltip around any content; the trigger must be focusable for keyboard users.
 * The tip is always in the DOM and the trigger points at it with aria-describedby. Escape closes it from anywhere.
 */
export default function Tooltip({ content, side = 'top', className, children }: Props) {
  const id = useId()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const open = (hovered || focused) && !dismissed

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissed(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const leave = (nextHovered: boolean, nextFocused: boolean) => {
    if (!nextHovered && !nextFocused) setDismissed(false)
  }

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': [(children.props as { 'aria-describedby'?: string })['aria-describedby'], id].filter(Boolean).join(' '),
      })
    : children
  return (
    <span
      className={cx('relative inline-flex', className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false)
        leave(false, focused)
      }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        setFocused(false)
        leave(hovered, false)
      }}
    >
      {trigger}
      <span
        className={cx(
          'absolute left-1/2 z-[50] -translate-x-1/2 transition-opacity duration-150',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
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
