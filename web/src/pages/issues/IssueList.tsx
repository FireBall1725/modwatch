// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import DataTable, { type Column } from '../../components/ui/DataTable'
import Icon from '../../components/ui/Icon'
import Pill from '../../components/ui/Pill'
import RelativeTime from '../../components/ui/RelativeTime'
import type { IssueItem } from '../../lib/types'
import KindPill from './KindPill'
import { isProblem, kindRank } from './logic'

const ts = (iso: string) => new Date(iso).getTime()

function ModCell({ issue }: { issue: IssueItem }) {
  const { t } = useTranslation('issues')
  if (issue.modSlug) {
    return (
      <Link to={`/mods/${issue.modSlug}`} className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
        {issue.modName ?? issue.modSlug}
      </Link>
    )
  }
  if (issue.modLabel) {
    return (
      <Link to="/settings" title={t('unclaimed.link')} className="inline-flex items-center gap-1 text-review underline decoration-review/40 underline-offset-2 hover:decoration-review">
        <Icon name="warning" size={13} />
        {t('unclaimedMod', { label: issue.modLabel })}
      </Link>
    )
  }
  return <span className="text-faint">{t('noMod')}</span>
}

function Title({ issue }: { issue: IssueItem }) {
  const { t } = useTranslation('issues')
  return (
    <span className="flex min-w-0 items-start gap-2">
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer noopener"
        className="min-w-0 font-medium text-ink hover:text-accent focus-visible:text-accent"
      >
        <span className="num mr-1.5 text-faint">#{issue.number}</span>
        {issue.title}
        <span className="sr-only"> ({t('openRepo')})</span>
      </a>
      {issue.state === 'closed' && (
        <Pill tone="inactive" icon="check" size="sm" className="mt-0.5 shrink-0">
          {t('state.closed')}
        </Pill>
      )}
    </span>
  )
}

function Age({ issue }: { issue: IssueItem }) {
  const { t } = useTranslation('issues')
  if (issue.state === 'closed' && issue.closedAt) {
    return (
      <>
        {t('state.closed')} <RelativeTime iso={issue.closedAt} />
      </>
    )
  }
  return <RelativeTime iso={issue.createdAt} />
}

function ageTone(i: IssueItem): string {
  if (i.state !== 'open') return 'text-muted'
  const days = (Date.now() - ts(i.createdAt)) / 86_400_000
  return isProblem(i) && days >= 30 ? 'text-review' : 'text-muted'
}

/** The filterable list: a dense table from md up, stacked cards below it. */
export default function IssueList({ issues, caption, empty }: { issues: IssueItem[]; caption: string; empty: ReactNode }) {
  const { t } = useTranslation('issues')
  const columns: Column<IssueItem>[] = [
    { key: 'kind', header: t('col.kind'), cell: (i) => <KindPill kind={i.kind} />, sortValue: (i) => kindRank(i.kind), width: '9rem' },
    { key: 'issue', header: t('col.issue'), cell: (i) => <Title issue={i} />, sortValue: (i) => i.number },
    { key: 'mod', header: t('col.mod'), cell: (i) => <ModCell issue={i} />, sortValue: (i) => i.modName ?? i.modLabel ?? '~', hideBelow: 'lg' },
    {
      key: 'age',
      header: t('col.age'),
      cell: (i) => (
        <span className={ageTone(i)}>
          <Age issue={i} />
        </span>
      ),
      sortValue: (i) => ts(i.createdAt),
      className: 'whitespace-nowrap',
    },
    {
      key: 'comments',
      header: t('col.comments'),
      cell: (i) => (
        <span className="num text-muted" title={t('comments', { count: i.comments })}>
          {i.comments}
        </span>
      ),
      sortValue: (i) => i.comments,
      align: 'right',
      hideBelow: 'xl',
    },
    { key: 'author', header: t('col.author'), cell: (i) => <span className="text-muted">{i.author}</span>, sortValue: (i) => i.author, hideBelow: 'xl' },
    { key: 'updated', header: t('col.updated'), cell: (i) => <span className="text-muted"><RelativeTime iso={i.updatedAt} /></span>, sortValue: (i) => ts(i.updatedAt), hideBelow: 'xl', className: 'whitespace-nowrap' },
  ]

  if (issues.length === 0) return <>{empty}</>

  return (
    <>
      <div className="hidden md:block">
        <DataTable columns={columns} rows={issues} rowKey={(i) => String(i.number)} caption={caption} defaultSort={{ key: 'kind', dir: 'asc' }} dense />
      </div>
      <ul aria-label={caption} className="divide-y divide-line md:hidden">
        {issues.map((i) => (
          <li key={i.number} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <KindPill kind={i.kind} />
              <span className={`text-xs ${ageTone(i)}`}>
                <Age issue={i} />
              </span>
            </div>
            <Title issue={i} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <ModCell issue={i} />
              <span>{i.author}</span>
              <span>{t('comments', { count: i.comments })}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
