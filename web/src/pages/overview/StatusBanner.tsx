// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../../components/ui/Icon'
import { cx } from '../../lib/cx'
import type { SourceStatus } from '../../lib/types'
import HealthDot from '../../components/ui/HealthDot'
import { failingSources, type AttentionGroups, type Verdict } from './logic'

const LOOK: Record<Verdict, { icon: IconName; box: string; icon_: string }> = {
  problem: { icon: 'problem', box: 'border-bad/40 bg-bad-soft/50', icon_: 'bg-bad-soft text-bad' },
  warning: { icon: 'warning', box: 'border-review/40 bg-review-soft/40', icon_: 'bg-review-soft text-review' },
  note: { icon: 'info', box: 'border-info/30 bg-info-soft/30', icon_: 'bg-info-soft text-info' },
  clear: { icon: 'check', box: 'border-ok/35 bg-ok-soft/40', icon_: 'bg-ok-soft text-ok' },
}

interface Props {
  verdict: Verdict
  groups: AttentionGroups
  setupProblems: string[]
  modCount: number
  sources: SourceStatus[]
  /** Plain-words limits on a working source, such as no GitHub token. */
  sourceNotes?: string[]
}

/** The two second answer: one sentence about the state of everything, with the counts behind it. */
export default function StatusBanner({ verdict, groups, setupProblems, modCount, sources, sourceNotes = [] }: Props) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const look = LOOK[verdict]
  const down = failingSources(sources)

  const headline = (() => {
    if (verdict === 'clear') return t('verdict.clear')
    if (groups.problem.length > 0) return t('verdict.problem', { count: groups.problem.length })
    if (setupProblems.length > 0) return t('verdict.setup', { count: setupProblems.length })
    if (groups.warning.length > 0) return t('verdict.warning', { count: groups.warning.length })
    return t('verdict.note', { count: groups.info.length })
  })()

  const headlineKey: 'problem' | 'warning' | 'info' | null =
    verdict === 'clear' ? null : groups.problem.length > 0 ? 'problem' : setupProblems.length > 0 ? null : groups.warning.length > 0 ? 'warning' : 'info'

  const counts: { key: 'problem' | 'warning' | 'info'; label: string; tone: string }[] = [
    { key: 'problem', label: t('verdict.problems'), tone: 'text-bad' },
    { key: 'warning', label: t('verdict.warnings'), tone: 'text-review' },
    { key: 'info', label: t('verdict.notes'), tone: 'text-info' },
  ]

  return (
    <section aria-labelledby="overview-verdict" className={cx('rounded-lg border p-4 sm:p-5', look.box)}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-72 items-center gap-4">
          <span className={cx('flex size-12 shrink-0 items-center justify-center rounded-full', look.icon_)}>
            <Icon name={look.icon} size={26} />
          </span>
          <div className="min-w-0">
            <h2 id="overview-verdict" className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {headline}
            </h2>
            <span className="sr-only" role="status" aria-live="polite">
              {headline}
            </span>
            {verdict === 'clear' ? (
              <p className="mt-0.5 text-sm text-muted">{t('verdict.clearDetail', { count: modCount })}</p>
            ) : (
              <ul className="mt-1.5 flex empty:hidden flex-wrap gap-x-4 gap-y-1 text-sm">
                {counts
                  .filter((c) => c.key !== headlineKey && groups[c.key].length > 0)
                  .map((c) => (
                    <li key={c.key} className="flex items-baseline gap-1.5">
                      <span className={cx('num font-medium', c.tone)}>{groups[c.key].length}</span>
                      <span className="text-muted">{c.label.toLowerCase()}</span>
                    </li>
                  ))}
                {setupProblems.length > 0 && groups.problem.length > 0 && (
                  <li className="flex items-baseline gap-1.5">
                    <span className="num font-medium text-bad">{setupProblems.length}</span>
                    <span className="text-muted">{t('verdict.setup', { count: setupProblems.length }).replace(/^\d+\s/, '')}</span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {down.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label={t('sources.title')}>
              {down.map((s) => (
                <li key={s.source} className="flex items-center gap-1.5 text-sm text-ink">
                  <HealthDot health="down" />
                  <Link to="/settings" className="underline decoration-line-strong underline-offset-4 hover:decoration-accent">
                    {t('sources.down', { name: tc(`source.${s.source}`, { defaultValue: s.source }) })}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {verdict !== 'clear' && (
            <Link
              to="#needs-attention"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('needs-attention')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
                document.getElementById('needs-attention-body')?.focus({ preventScroll: true })
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent"
            >
              {t('verdict.seeList')}
              <Icon name="arrow_down" size={14} />
            </Link>
          )}
        </div>
      </div>
      {setupProblems.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-bad/25 pt-3 text-sm text-ink">
          {setupProblems.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <Icon name="problem" size={14} className="mt-0.5 shrink-0 text-bad" />
              <span>
                {p}{' '}
                <Link to="/settings" className="underline decoration-line-strong underline-offset-4 hover:decoration-accent">
                  {t('verdict.openSettings')}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
      {sourceNotes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {sourceNotes.map((n) => (
            <li key={n} className="flex items-start gap-2">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              {n}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
