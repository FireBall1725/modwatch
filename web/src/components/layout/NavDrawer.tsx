// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import Brand from './Brand'
import LegacyToggle from './LegacyToggle'
import PrivacyToggle from './PrivacyToggle'
import { NavList } from './SideNav'

/** Phone navigation: a native dialog that slides from the left, so focus is trapped and Escape closes it. Props: open, onClose. Closes itself when the route changes. */
export default function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('common')
  const ref = useRef<HTMLDialogElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  useEffect(() => {
    onClose()
    // Only a route change should close it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={t('nav.label')}
      className="m-0 h-dvh max-h-none w-[min(18rem,85vw)] max-w-none border-r border-line-strong bg-surface p-0 text-ink shadow-e4 backdrop:bg-black/60"
    >
      <div className="flex h-[var(--header-height)] items-center justify-between px-4">
        <Brand />
        <button type="button" onClick={onClose} aria-label={t('word.close')} className="flex size-10 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink">
          <Icon name="close" size={20} />
        </button>
      </div>
      <nav aria-label={t('nav.label')} className="px-3 py-3">
        <NavList showLabels onNavigate={onClose} />
      </nav>
      <LegacyToggle className="block px-6 py-3" />
      <PrivacyToggle className="block px-6 py-3" />
    </dialog>
  )
}
