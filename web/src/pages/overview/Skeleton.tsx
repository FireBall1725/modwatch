// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import KpiCard from '../../components/ui/KpiCard'
import Skeleton from '../../components/ui/Skeleton'

/** Shape of the page while the first overview request is in flight. */
export default function OverviewSkeleton() {
  const { t } = useTranslation('common')
  return (
    <div aria-busy="true" aria-label={t('word.loading')} className="flex flex-col gap-[var(--section-gap)]">
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <KpiCard label="" value="" loading />
        </div>
        <KpiCard label="" value="" loading />
        <KpiCard label="" value="" loading />
        <KpiCard label="" value="" loading className="col-span-2 lg:col-span-1" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Skeleton className="h-96 w-full rounded-lg" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18.5rem),1fr))] gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
