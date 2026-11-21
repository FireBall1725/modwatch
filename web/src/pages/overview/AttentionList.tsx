// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import DismissButton from '../../components/attention/DismissButton'
import DismissedList from '../../components/attention/DismissedList'
import { dismissKey } from '../../components/attention/dismiss'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon, { type IconName } from '../../components/ui/Icon'
import type { Dismissals } from '../../hooks/useDismissals'
import { cx } from '../../lib/cx'
import type { AttentionItem, AttentionKind, Severity } from '../../lib/types'
import type { AttentionGroups } from './logic'

const KIND_ICON: Record<AttentionKind, IconName> = {
  crash_open: 'crash',
  bug_open: 'bug',
  review_stuck: 'clock',
  review_pending: 'in_review',
  not_approved: 'rejected',
  missing_platform: 'unlink',
  no_latest_minecraft: 'versions',
  stale_release: 'clock',
  source_down: 'problem',
  unlinked: 'unlink',
}

const TONE: Record<Severity, { icon: string; rule: string; head: string }> = {
  problem: { icon: 'text-bad', rule: 'before:bg-bad', head: 'text-bad' },
  warning: { icon: 'text-review', rule: 'before:bg-review', head: 'text-review' },
  info: { icon: 'text-info', rule: 'before:bg-info', head: 'text-info' },
}

const GROUP_KEY: Record<Severity, string> = { problem: 'problems', warning: 'warnings', info: 'notes' }

const SEVERITY_ICON: Record<Severity, IconName> = { problem: 'problem', warning: 'warning', info: 'info' }

/** Where a row goes inside the app: the mod page, or Settings for things only the registry can fix. */
function target(item: AttentionItem): string {
  if (item.modSlug) return `/mods/${item.modSlug}`
  return '/settings'
}

interface RowProps {
  item: AttentionItem
  busy: boolean
  onDismiss: (item: AttentionItem) => void
}

function Row({ item, busy, onDismiss }: RowProps) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const tone = TONE[item.severity]
  return (
    <li className={cx('relative flex items-start gap-3 py-3 pr-1 pl-4 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full', tone.rule)}>
      <Icon name={KIND_ICON[item.kind]} size={18} className={cx('mt-0.5 shrink-0', tone.icon)} />
      <div className="min-w-0 flex-1">
        <Link to={target(item)} className="block rounded-sm text-sm font-medium text-ink hover:underline hover:decoration-line-strong hover:underline-offset-2">
          {item.title}
        </Link>
        {item.detail && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{item.detail}</p>}
      </div>
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${t('attention.open', { where: hostOf(item.url) })}: ${item.title} ${tc('newTab')}`}
          title={t('attention.open', { where: hostOf(item.url) })}
          className="-my-1 flex size-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink"
        >
          <Icon name="external" size={16} />
        </a>
      )}
      {item.dismissible && <DismissButton item={item} busy={busy} onDismiss={() => onDismiss(item)} />}
    </li>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

interface Props {
  groups: AttentionGroups
  notesOpen: boolean
  onToggleNotes: () => void
  /** Items the author dismissed; they can be restored from the list under the card. */
  dismissed: AttentionItem[]
  dismissals: Dismissals
  /** Dismisses an item and then puts focus back on the list, since the row it was on is gone. */
  onDismiss: (item: AttentionItem) => void
}

/** Every attention item, grouped by severity. Problems and warnings are always listed; notes fold away. */
export default function AttentionList({ groups, notesOpen, onToggleNotes, dismissed, dismissals, onDismiss }: Props) {
  const { t } = useTranslation('overview')
  const { t: tc } = useTranslation('common')
  const total = groups.problem.length + groups.warning.length + groups.info.length

  const section = (sev: Severity, items: AttentionItem[]) =>
    items.length === 0 ? null : (
      <div key={sev}>
        <h3 className={cx('flex items-center gap-1.5 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase', TONE[sev].head)}>
          <Icon name={SEVERITY_ICON[sev]} size={14} />
          {t(`verdict.${GROUP_KEY[sev]}`)}
          <span className="num font-medium text-faint">{items.length}</span>
        </h3>
        <ul className="divide-y divide-line">
          {items.map((it, i) => (
            <Row key={`${it.kind}-${it.modSlug}-${i}`} item={it} busy={dismissals.busy === dismissKey(it)} onDismiss={onDismiss} />
          ))}
        </ul>
      </div>
    )

  return (
    <Card id="needs-attention" title={t('attention.title')} className="scroll-mt-20" padded={false}>
      <div id="needs-attention-body" tabIndex={-1} className="px-4 pb-4 outline-none sm:px-5">
        {total === 0 ? (
          <EmptyState compact icon="check" title={t('attention.empty')} description={t('attention.emptyDetail')} />
        ) : (
          <>
            {section('problem', groups.problem)}
            {section('warning', groups.warning)}
            {groups.info.length > 0 && (
              <div>
                {notesOpen && section('info', groups.info)}
                <button
                  type="button"
                  onClick={onToggleNotes}
                  aria-expanded={notesOpen}
                  className="mt-2 flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line text-sm text-muted hover:border-line-strong hover:text-ink"
                >
                  <Icon name={notesOpen ? 'chevron_up' : 'chevron_down'} size={14} />
                  {notesOpen ? t('attention.hideNotes') : t('attention.showNotes', { count: groups.info.length })}
                </button>
              </div>
            )}
          </>
        )}
        {dismissals.error && (
          <p role="alert" className="mt-3 rounded-md border border-bad/40 bg-bad-soft/50 px-3 py-2 text-sm text-ink">
            {tc('attention.failed', { message: dismissals.error })}
          </p>
        )}
        <DismissedList items={dismissed} dismissals={dismissals} className="mt-3" />
      </div>
    </Card>
  )
}
