// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import Icon from './Icon'
import NewTabCue from './NewTabCue'

/** Link that opens in a new tab with the external-link glyph. Renders plain text when href is null. */
export default function ExternalLink({ href, children, className, noIcon }: { href: string | null | undefined; children: ReactNode; className?: string; noIcon?: boolean }) {
  if (!href) return <span className={className}>{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cx('inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent', className)}
    >
      {children}
      {!noIcon && <Icon name="external" size={12} className="text-faint" />}
      <NewTabCue />
    </a>
  )
}
