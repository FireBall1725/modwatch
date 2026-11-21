// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Dismissals } from '../../hooks/useDismissals'
import type { AttentionItem } from '../../lib/types'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { dismissKey } from './dismiss'

interface Props {
  items: AttentionItem[]
  dismissals: Dismissals
  className?: string
}

/** Items the author dismissed, folded away, each with a Restore button. Renders nothing when there are none. */
export default function DismissedList({ items, dismissals, className }: Props) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const id = useId()
  if (items.length === 0) return null
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line text-sm text-muted hover:border-line-strong hover:text-ink"
      >
        <Icon name={open ? 'chevron_up' : 'chevron_down'} size={14} />
        {t('attention.dismissedToggle', { count: items.length })}
      </button>
      <div id={id} hidden={!open}>
        <ul className="mt-1 divide-y divide-line">
          {items.map((it) => (
            <li key={dismissKey(it) + it.title} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-muted">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm break-words">{it.title}</p>
                {it.detail && <p className="line-clamp-2 text-xs text-faint">{it.detail}</p>}
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon="refresh"
                loading={dismissals.busy === dismissKey(it)}
                onClick={() => void dismissals.restore(it)}
              >
                {t('attention.restore')}
                <span className="sr-only">{`: ${it.title}`}</span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
