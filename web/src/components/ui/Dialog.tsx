// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  /** Buttons, right aligned. */
  footer?: ReactNode
  children: ReactNode
}

/** Modal built on the native dialog element: focus is trapped, Escape and the backdrop close it, and focus returns to the opener. */
export default function Dialog({ open, onClose, title, footer, children }: Props) {
  const { t } = useTranslation('common')
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] max-w-none rounded-xl border border-line-strong bg-surface p-0 text-ink shadow-e4 backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('word.close')}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </dialog>
  )
}
