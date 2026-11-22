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

/** Platform label in its fixed colour, with the platform's logo. Logo only, the name stays for screen readers and as a tooltip. */
export default function PlatformBadge({ platform, size = 'md', iconOnly = false, absent = false, className }: Props) {
  const { t } = useTranslation('common')
  if (absent) return <PlatformAbsent platform={platform} className={className} />
  const name = t(`platform.${platform}`)
  const s = size === 'sm' ? 12 : 14
  return (
    <span
      title={iconOnly ? name : undefined}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium leading-none whitespace-nowrap',
        iconOnly ? 'p-1.5' : size === 'sm' ? 'px-1.5 py-1 text-2xs' : 'px-2 py-1 text-xs',
        STYLE[platform],
        className,
      )}
    >
      <PlatformMark platform={platform} size={s} />
      <span className={iconOnly ? 'sr-only' : undefined}>{name}</span>
    </span>
  )
}

// The platforms' own logos, on a 24 by 24 grid. They are filled with the badge's colour, so one path works in light and dark.
const LOGO: Record<Platform, string> = {
  curseforge:
    "M18.326 9.2145S23.2261 8.4418 24 6.1882h-7.5066V4.4H0l2.0318 2.3576V9.173s5.1267-.2665 7.1098 1.2372c2.7146 2.516-3.053 5.917-3.053 5.917L5.0995 19.6c1.5465-1.4726 4.494-3.3775 9.8983-3.2857-2.0565.65-4.1245 1.6651-5.7344 3.2857h10.9248l-1.0288-3.2726s-7.918-4.6688-.8336-7.1127z",
  modrinth:
    "M12.252.004a11.78 11.768 0 0 0-8.92 3.73 11 10.999 0 0 0-2.17 3.11 11.37 11.359 0 0 0-1.16 5.169c0 1.42.17 2.5.6 3.77.24.759.77 1.899 1.17 2.529a12.3 12.298 0 0 0 8.85 5.639c.44.05 2.54.07 2.76.02.2-.04.22.1-.26-1.7l-.36-1.37-1.01-.06a8.5 8.489 0 0 1-5.18-1.8 5.34 5.34 0 0 1-1.3-1.26c0-.05.34-.28.74-.5a37.572 37.545 0 0 1 2.88-1.629c.03 0 .5.45 1.06.98l1 .97 2.07-.43 2.06-.43 1.47-1.47c.8-.8 1.48-1.5 1.48-1.52 0-.09-.42-1.63-.46-1.7-.04-.06-.2-.03-1.02.18-.53.13-1.2.3-1.45.4l-.48.15-.53.53-.53.53-.93.1-.93.07-.52-.5a2.7 2.7 0 0 1-.96-1.7l-.13-.6.43-.57c.68-.9.68-.9 1.46-1.1.4-.1.65-.2.83-.33.13-.099.65-.579 1.14-1.069l.9-.9-.7-.7-.7-.7-1.95.54c-1.07.3-1.96.53-1.97.53-.03 0-2.23 2.48-2.63 2.97l-.29.35.28 1.03c.16.56.3 1.16.31 1.34l.03.3-.34.23c-.37.23-2.22 1.3-2.84 1.63-.36.2-.37.2-.44.1-.08-.1-.23-.6-.32-1.03-.18-.86-.17-2.75.02-3.73a8.84 8.839 0 0 1 7.9-6.93c.43-.03.77-.08.78-.1.06-.17.5-2.999.47-3.039-.01-.02-.1-.02-.2-.03Zm3.68.67c-.2 0-.3.1-.37.38-.06.23-.46 2.42-.46 2.52 0 .04.1.11.22.16a8.51 8.499 0 0 1 2.99 2 8.38 8.379 0 0 1 2.16 3.449 6.9 6.9 0 0 1 .4 2.8c0 1.07 0 1.27-.1 1.73a9.37 9.369 0 0 1-1.76 3.769c-.32.4-.98 1.06-1.37 1.38-.38.32-1.54 1.1-1.7 1.14-.1.03-.1.06-.07.26.03.18.64 2.56.7 2.78l.06.06a12.07 12.058 0 0 0 7.27-9.4c.13-.77.13-2.58 0-3.4a11.96 11.948 0 0 0-5.73-8.578c-.7-.42-2.05-1.06-2.25-1.06Z",
}

/** The platform's logo alone, in the current colour. Decorative: the name is given by whatever holds it. */
export function PlatformMark({ platform, size = 14 }: { platform: Platform; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d={LOGO[platform]} fill="currentColor" />
    </svg>
  )
}
