// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import type { Platform } from '../../lib/types'

/** The one phrase for a mod that has no page on a platform: "Not on CurseForge". A dashed pill. Props: platform, className, bare (text only, no pill). */
export default function PlatformAbsent({ platform, className, bare = false }: { platform: Platform; className?: string; bare?: boolean }) {
  const { t } = useTranslation('common')
  const text = t('word.notOnPlatform', { platform: t(`platform.${platform}`) })
  if (bare) return <span className={cx('text-xs text-faint', className)}>{text}</span>
  return <span className={cx('inline-block rounded-full border border-dashed border-line-strong px-2 py-0.5 text-xs whitespace-nowrap text-faint', className)}>{text}</span>
}
