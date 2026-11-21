// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import Icon from '../../components/ui/Icon'
import RelativeTime from '../../components/ui/RelativeTime'
import type { IssueItem, IssuesSummary } from '../../lib/types'
import KindPill from './KindPill'
import { openProblems, verdict } from './logic'

const FRAME = {
  problems: 'border-bad/40 bg-bad-soft/50',
  requests: 'border-info/30 bg-info-soft/40',
  clear: 'border-ok/35 bg-ok-soft/50',
}
const ICON = { problems: 'problem', requests: 'info', clear: 'check' } as const
const ICON_TONE = { problems: 'text-bad', requests: 'text-info', clear: 'text-ok' }

/** The two-second answer: is a bug or crash open? Lists the culprits so no click is needed to see them. */
export default function Verdict({ summary, problems }: { summary: IssuesSummary; problems: IssueItem[] }) {
  const { t } = useTranslation('issues')
  const v = verdict(summary)
  const list = openProblems(problems)
  return (
    <section aria-labelledby="verdict" className={`rounded-lg border p-4 sm:p-5 ${FRAME[v]}`}>
      <div className="flex items-center gap-3">
        <Icon name={ICON[v]} size={26} className={`shrink-0 ${ICON_TONE[v]}`} />
        <div className="min-w-0">
          <h2 id="verdict" className="text-lg leading-snug font-semibold text-ink">
            {v === 'clear'
              ? t('verdict.clear')
              : v === 'requests'
                ? t('verdict.requests', { count: summary.open })
                : t('verdict.problems', {
                    crashes: t('verdict.crashes', { count: summary.openCrashes }),
                    bugs: t('verdict.bugs', { count: summary.openBugs }),
                  })}
          </h2>
          {v === 'clear' && <p className="text-sm text-muted">{t('verdict.clearDetail')}</p>}
        </div>
      </div>
      {v === 'problems' && list.length > 0 && (
        <ul className="mt-4 divide-y divide-line/70 rounded-md border border-line bg-surface/60">
          {list.map((i) => (
            <li key={i.number} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <KindPill kind={i.kind} />
              <a href={i.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 basis-56 font-medium text-ink hover:text-accent">
                <span className="num mr-1.5 text-faint">#{i.number}</span>
                {i.title}
              </a>
              <span className="text-muted">{i.modName ?? i.modLabel ?? ''}</span>
              <span className="text-muted">
                <RelativeTime iso={i.createdAt} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
