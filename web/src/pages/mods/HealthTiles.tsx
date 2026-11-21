// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import HealthDot from '../../components/ui/HealthDot'
import Skeleton from '../../components/ui/Skeleton'
import { cx } from '../../lib/cx'
import { formatCount } from '../../lib/format'
import type { HealthFilter } from './logic'

const ORDER: HealthFilter[] = ['problem', 'attention', 'ok', 'all']

const ACTIVE: Record<HealthFilter, string> = {
  problem: 'border-bad bg-bad-soft',
  attention: 'border-review bg-review-soft',
  ok: 'border-ok bg-ok-soft',
  all: 'border-accent bg-accent-soft',
}
const NUMBER: Record<HealthFilter, string> = {
  problem: 'text-bad',
  attention: 'text-review',
  ok: 'text-ok',
  all: 'text-ink',
}

interface Props {
  counts: Record<HealthFilter, number> | null
  value: HealthFilter
  onChange: (v: HealthFilter) => void
}

/** The two-second answer: how many mods have a problem, need attention or are fine. Each tile filters the list. */
export default function HealthTiles({ counts, value, onChange }: Props) {
  const { t } = useTranslation('mods')
  return (
    <div role="group" aria-label={t('health.label')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ORDER.map((k) => {
        const n = counts?.[k]
        const on = value === k
        const zero = n === 0 && k !== 'all'
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on && k !== 'all' ? 'all' : k)}
            className={cx(
              'flex min-w-0 cursor-pointer flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors duration-150',
              on ? ACTIVE[k] : 'border-line bg-surface hover:border-line-strong hover:bg-raised',
            )}
          >
            <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
              {k !== 'all' && <HealthDot health={k} />}
              {t(`health.${k}`)}
            </span>
            {counts ? (
              <span className={cx('num text-2xl leading-none font-semibold', zero ? 'text-faint' : NUMBER[k])}>{formatCount(n)}</span>
            ) : (
              <Skeleton className="mt-1 h-6 w-10" />
            )}
          </button>
        )
      })}
    </div>
  )
}
