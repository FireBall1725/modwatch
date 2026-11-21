// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

export interface SegmentOption<V extends string | number> {
  value: V
  label: ReactNode
  /** Accessible name when the label is an icon or a short form. */
  ariaLabel?: string
}

interface Props<V extends string | number> {
  options: SegmentOption<V>[]
  value: V
  onChange: (value: V) => void
  /** Names the group for screen readers, such as "Range". */
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/** Single-choice button group, for ranges and view switches. Arrow keys move the choice. Props: options, value, onChange, label (accessible group name), size, className. */
export default function SegmentedControl<V extends string | number>({ options, value, onChange, label, size = 'md', className }: Props<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (i + dir + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-md border border-line-strong bg-sunk p-0.5', className)}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx(
              'cursor-pointer rounded-[7px] font-medium whitespace-nowrap transition-colors duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              on ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
