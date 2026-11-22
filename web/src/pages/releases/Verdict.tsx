// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import Icon from '../../components/ui/Icon'
import Skeleton from '../../components/ui/Skeleton'
import { cx } from '../../lib/cx'
import { openCount, type BoardCounts } from './logic'

interface Props {
  counts: BoardCounts | null
  slow: number
}

const TALLY = ['blocked', 'waiting', 'unpublished', 'dormant', 'approved'] as const
const TALLY_TEXT = { blocked: 'text-bad', waiting: 'text-review', unpublished: 'text-neutral', dormant: 'text-inactive', approved: 'text-ok' }

/** The two-second answer: is anything stuck, and how many projects are in each state. */
export default function Verdict({ counts, slow }: Props) {
  const { t } = useTranslation('releases')
  if (!counts) return <Skeleton className="h-24 w-full rounded-lg" />
  const open = openCount(counts)
  const bad = counts.blocked > 0
  const tone = bad ? 'bad' : open > 0 ? 'review' : 'ok'
  const headline = bad
    ? t('verdict.blocked', { count: counts.blocked })
    : open > 0
      ? t('verdict.open', { count: open })
      : t('verdict.clear')
  const detail = [
    bad && counts.waiting > 0 ? t('verdict.waiting', { count: counts.waiting }) : null,
    slow > 0 ? t('verdict.slow', { count: slow }) : null,
    open === 0 ? t('verdict.clearDetail') : null,
  ].filter(Boolean)

  return (
    <section
      aria-label={headline}
      className={cx(
        'flex flex-col gap-4 rounded-lg border bg-surface p-4 shadow-e1 sm:flex-row sm:items-center sm:justify-between sm:p-5',
        tone === 'bad' && 'border-bad/40',
        tone === 'review' && 'border-review/40',
        tone === 'ok' && 'border-ok/40',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cx(
            'flex size-11 shrink-0 items-center justify-center rounded-full',
            tone === 'bad' && 'bg-bad-soft text-bad',
            tone === 'review' && 'bg-review-soft text-review',
            tone === 'ok' && 'bg-ok-soft text-ok',
          )}
        >
          <Icon name={bad ? 'changes_required' : open > 0 ? 'in_review' : 'approved'} size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-ink">{headline}</p>
          {detail.length > 0 && <p className="text-sm text-muted">{detail.join(' · ')}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-5 gap-2 sm:flex sm:gap-6">
        {TALLY.map((g) => (
          <div key={g} className="flex min-w-0 flex-col-reverse gap-1">
            <dt className="text-xs text-muted">{t(`tally.${g}`)}</dt>
            <dd className={cx('num text-2xl font-semibold leading-none', counts[g] > 0 ? TALLY_TEXT[g] : 'text-faint')}>{counts[g]}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
