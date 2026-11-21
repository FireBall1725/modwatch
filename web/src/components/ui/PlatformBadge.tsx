// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import PlatformAbsent from './PlatformAbsent'
import type { Platform } from '../../lib/types'

const STYLE: Record<Platform, string> = {
  curseforge: 'bg-cf-soft text-cf border-cf/35',
  modrinth: 'bg-mr-soft text-mr border-mr/35',
}

interface Props {
  platform: Platform
  size?: 'sm' | 'md'
  /** Show only the mark; the name stays available to screen readers and as a tooltip. */
  iconOnly?: boolean
  /** The mod has no page on this platform: shows the shared "Not on {platform}" pill instead of the badge. */
  absent?: boolean
  className?: string
}

/** Platform label in its fixed colour. The mark differs in shape (diamond, ring) as well as colour, and the name is always present. Props: platform, size, iconOnly, absent, className. */
export default function PlatformBadge({ platform, size = 'md', iconOnly = false, absent = false, className }: Props) {
  const { t } = useTranslation('common')
  if (absent) return <PlatformAbsent platform={platform} className={className} />
  const name = t(`platform.${platform}`)
  const s = size === 'sm' ? 10 : 12
  return (
    <span
      title={iconOnly ? name : undefined}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium leading-none whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-1 text-2xs' : 'px-2 py-1 text-xs',
        STYLE[platform],
        className,
      )}
    >
      <PlatformMark platform={platform} size={s} />
      <span className={iconOnly ? 'sr-only' : undefined}>{name}</span>
    </span>
  )
}

/** The shape alone: a filled diamond for CurseForge, a ring for Modrinth. */
export function PlatformMark({ platform, size = 12 }: { platform: Platform; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      {platform === 'curseforge' ? (
        <path d="M6 .8L11.2 6 6 11.2.8 6z" fill="currentColor" />
      ) : (
        <circle cx="6" cy="6" r="4.1" fill="none" stroke="currentColor" strokeWidth="2.2" />
      )}
    </svg>
  )
}
