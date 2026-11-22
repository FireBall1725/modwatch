// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useId, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  /** Second line under the label. */
  description?: ReactNode
  disabled?: boolean
  className?: string
}

/** On/off switch with its label (role="switch"). The whole row is clickable. */
export default function Toggle({ checked, onChange, label, description, disabled, className }: Props) {
  const id = useId()
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-sunk',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'absolute top-0.5 left-0.5 size-4.5 rounded-full transition-transform duration-150',
            checked ? 'translate-x-5 bg-accent-ink' : 'bg-muted',
          )}
        />
      </button>
      <label htmlFor={id} id={`${id}-l`} className="min-w-0 cursor-pointer text-sm text-ink select-none">
        {label}
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
    </div>
  )
}
