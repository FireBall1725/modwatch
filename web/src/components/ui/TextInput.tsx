// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useId, type InputHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  label: string
  /** Persistent hint under the field. */
  helper?: string
  /** Error under the field; also sets aria-invalid. */
  error?: string | null
  /** Use the mono face, for ids and slugs. */
  mono?: boolean
}

/** Labelled text field with helper and error text. Props: value, onChange, label, helper, error, mono, plus any input attribute. */
export default function TextInput({ value, onChange, label, helper, error, mono, className, ...rest }: Props) {
  const id = useId()
  const note = error ?? helper
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${id}-n` : undefined}
        className={cx(
          'h-10 w-full rounded-md border bg-sunk px-3 text-sm text-ink placeholder:text-faint',
          error ? 'border-bad' : 'border-line-strong',
          mono && 'num',
        )}
        {...rest}
      />
      {note && (
        <p id={`${id}-n`} role={error ? 'alert' : undefined} className={cx('mt-1 text-xs', error ? 'text-bad' : 'text-muted')}>
          {note}
        </p>
      )}
    </div>
  )
}
