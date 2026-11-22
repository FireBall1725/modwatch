// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import Skeleton from '../ui/Skeleton'

/** Suspense fallback while a page chunk loads: a title bar and a block of cards. */
export default function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full !rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full !rounded-lg" />
    </div>
  )
}
