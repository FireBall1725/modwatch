// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import Button from './Button'
import Icon from './Icon'

interface Props {
  /** The failure. Its message is shown as detail. */
  error?: Error | string | null
  title?: string
  /** Adds a Try again button. */
  onRetry?: () => void
  compact?: boolean
  className?: string
}

/** A failed load, with the reason and a retry. role="alert" so it is announced. */
export default function ErrorState({ error, title, onRetry, compact = false, className }: Props) {
  const { t } = useTranslation('common')
  const message = typeof error === 'string' ? error : error?.message
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-bad/30 bg-bad-soft/40 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-12',
        className,
      )}
    >
      <Icon name="problem" size={compact ? 22 : 28} className="text-bad" />
      <p className="text-base font-medium text-ink">{title ?? t('error.title')}</p>
      {message && <p className="max-w-lg text-sm break-words text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry} className="mt-2">
          {t('word.retry')}
        </Button>
      )}
    </div>
  )
}
