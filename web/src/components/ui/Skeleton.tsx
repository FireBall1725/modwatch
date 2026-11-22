// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { cx } from '../../lib/cx'

/** Loading placeholder. Set the size with h-* and w-* classes; lines renders that many text-height bars. Decorative, hidden from screen readers. */
export default function Skeleton({ className, lines }: { className?: string; lines?: number }) {
  if (lines && lines > 1) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cx('skeleton h-3.5 rounded-sm', i === lines - 1 ? 'w-2/3' : 'w-full', className)} />
        ))}
      </div>
    )
  }
  return <div aria-hidden="true" className={cx('skeleton rounded-sm', className ?? 'h-4 w-full')} />
}
