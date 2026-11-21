// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import Icon from './Icon'

interface Props {
  value: string
  onChange: (value: string) => void
  /** Also the accessible label. */
  placeholder: string
  className?: string
}

/** Search box with a clear button. Props: value, onChange, placeholder (also its accessible label), className. Escape clears. */
export default function SearchInput({ value, onChange, placeholder, className }: Props) {
  const { t } = useTranslation('common')
  return (
    <div className={cx('relative min-w-0', className)}>
      <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && value && onChange('')}
        className="h-10 w-full rounded-md border border-line-strong bg-sunk pr-9 pl-9 text-sm text-ink placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('word.clear')}
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted hover:text-ink"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  )
}
