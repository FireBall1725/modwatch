// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import type { AttentionItem } from '../../lib/types'
import Icon from '../ui/Icon'

interface Props {
  item: AttentionItem
  busy: boolean
  onDismiss: () => void
  className?: string
}

/** The small "x" on a needs-attention row. Only shown for items the server allows dismissing; the caller checks item.dismissible. */
export default function DismissButton({ item, busy, onDismiss, className }: Props) {
  const { t } = useTranslation('common')
  return (
    <button
      type="button"
      onClick={onDismiss}
      disabled={busy}
      title={t('attention.dismissHint')}
      aria-label={t('attention.dismiss', { title: item.title })}
      className={cx(
        '-my-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink disabled:cursor-wait disabled:opacity-50',
        className,
      )}
    >
      <Icon name={busy ? 'refresh' : 'close'} size={16} className={busy ? 'spin' : undefined} />
    </button>
  )
}
