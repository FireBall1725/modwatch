// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Pill from '../../components/ui/Pill'
import RelativeTime from '../../components/ui/RelativeTime'
import { cx } from '../../lib/cx'
import type { IssueItem, IssueKind } from '../../lib/types'
import { countClosed, orderIssues } from './logic'

const KIND_TONE = { crash: 'bad', bug: 'bad', compatibility: 'review', enhancement: 'info', question: 'neutral', other: 'neutral' } as const
const KIND_ICON: Record<IssueKind, 'crash' | 'bug' | 'compatibility' | 'enhancement' | 'question' | 'info'> = {
  crash: 'crash',
  bug: 'bug',
  compatibility: 'compatibility',
  enhancement: 'enhancement',
  question: 'question',
  other: 'info',
}

interface Props {
  issues: IssueItem[]
  linked: boolean
  allUrl: string | null
  slug: string
  showClosed: boolean
  onShowClosed: (v: boolean) => void
}

/** This mod's issues: open ones with crashes and bugs first, closed ones on request. */
export default function IssuesCard({ issues, linked, allUrl, slug, showClosed, onShowClosed }: Props) {
  const { t } = useTranslation('modDetail')
  const { t: tc } = useTranslation('common')
  const rows = useMemo(() => orderIssues(issues, showClosed), [issues, showClosed])
  const closed = countClosed(issues)
  const open = issues.length - closed
  // Issue numbers repeat across repositories, so name the repository when this mod's issues come from more than one.
  const showRepo = new Set(issues.map((i) => i.repo)).size > 1

  return (
    <Card
      title={t('issues.title')}
      description={linked ? t('issues.open', { count: open }) : undefined}
      actions={
        <>
          {closed > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onShowClosed(!showClosed)} aria-pressed={showClosed}>
              {showClosed ? t('issues.hideClosed') : t('issues.showClosed', { count: closed })}
            </Button>
          )}
          {allUrl && (
            <Button size="sm" icon="github" href={allUrl}>
              {t('issues.viewAll')}
            </Button>
          )}
        </>
      }
    >
      {!linked ? (
        <EmptyState compact icon="link" title={t('issues.noLabel')} description={t('issues.noLabelDetail')} action={<Button size="sm" href={`/settings?mod=${encodeURIComponent(slug)}`}>{t('editLinks')}</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState compact icon="check" title={t('issues.none')} description={t('issues.noneDetail')} />
      ) : (
        <ul aria-label={t('issues.list')} className="-my-1 divide-y divide-line">
          {rows.map((i) => (
            <li key={`${i.repo}#${i.number}`} className={cx('flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3', i.state === 'closed' && 'opacity-70')}>
              <Pill tone={KIND_TONE[i.kind]} icon={KIND_ICON[i.kind]} size="sm">
                {tc(`issueKind.${i.kind}`)}
              </Pill>
              <a href={i.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 basis-60 text-sm text-ink hover:underline">
                <span className="num text-muted">
                  {showRepo && i.repo ? `${i.repo}#` : '#'}
                  {i.number}
                </span>{' '}
                {i.title}
              </a>
              <span className="flex items-center gap-3 text-xs text-muted">
                {i.comments > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="info" size={12} />
                    {t('issues.comments', { count: i.comments })}
                  </span>
                )}
                {i.state === 'closed' ? <Pill tone="inactive" size="sm">{t('issues.closed')}</Pill> : null}
                <span>
                  {t('issues.opened')}
                  <RelativeTime iso={i.createdAt} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
