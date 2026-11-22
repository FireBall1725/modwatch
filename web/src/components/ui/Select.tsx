// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useId } from 'react'
import { cx } from '../../lib/cx'
import Icon from './Icon'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Always set; shown above the control unless hideLabel is true, then only read by screen readers. */
  label: string
  hideLabel?: boolean
  className?: string
}

/** Native select with a label. A native control keeps mobile pickers and keyboard behaviour for free. */
export default function Select({ value, onChange, options, label, hideLabel = false, className }: Props) {
  const id = useId()
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1 block text-xs font-medium text-muted'}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full cursor-pointer appearance-none rounded-md border border-line-strong bg-sunk pr-9 pl-3 text-sm text-ink"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron_down" size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-faint" />
      </div>
    </div>
  )
}
