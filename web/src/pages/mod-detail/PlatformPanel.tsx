// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import ExternalLink from '../../components/ui/ExternalLink'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PlatformAbsent from '../../components/ui/PlatformAbsent'
import PlatformBadge from '../../components/ui/PlatformBadge'
import RelativeTime from '../../components/ui/RelativeTime'
import StatusChip from '../../components/ui/StatusChip'
import DeltaText from '../../components/ui/DeltaText'
import { cx } from '../../lib/cx'
import { formatCount, NO_VALUE } from '../../lib/format'
import type { Platform, PlatformInfo } from '../../lib/types'
import { panelTone, queueDays, type PanelTone } from './logic'

const RULE: Record<PanelTone, string> = {
  ok: 'border-t-ok',
  review: 'border-t-review',
  bad: 'border-t-bad',
  neutral: 'border-t-neutral',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 py-1.5 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  )
}

/** Review state of one platform: the status, what was asked for, the moderator's words and the wait. */
export default function PlatformPanel({ platform, info, onEdit }: { platform: Platform; info: PlatformInfo | null; onEdit: () => void }) {
  const { t } = useTranslation('modDetail')
  const { t: tc } = useTranslation('common')
  const name = tc(`platform.${platform}`)

  if (!info) {
    return (
      <Card className="border-dashed" title={<PlatformBadge platform={platform} />}>
        <p>
          <PlatformAbsent platform={platform} />
        </p>
        <p className="mt-2 text-sm text-muted">{t('status.notListedDetail')}</p>
        <Button className="mt-3" size="sm" icon="link" onClick={onEdit}>
          {t('status.linkAction')}
        </Button>
      </Card>
    )
  }

  const days = queueDays(info)
  const tone = panelTone(info)
  const full = info.status !== 'approved' || days !== null
  const openLink = (
    <ExternalLink href={info.url} className="text-sm">
      {t('status.open', { platform: name })}
    </ExternalLink>
  )
  return (
    <Card className={cx('border-t-2', RULE[tone])} title={<PlatformBadge platform={platform} />} actions={<><StatusChip status={info.status} rawStatus={info.rawStatus} />{openLink}</>}>
      <dl className="divide-y divide-line">
        {full && info.rawStatus.toLowerCase() !== info.status.replace('_', ' ') && info.rawStatus.toLowerCase() !== info.status && (
          <Row label={t('status.raw')}>
            <span className="num">{info.rawStatus.toLowerCase()}</span>
          </Row>
        )}
        {info.requestedStatus && info.requestedStatus !== info.rawStatus.toLowerCase() && <Row label={t('status.requested')}><span className="num">{info.requestedStatus}</span></Row>}
        {full && (
          <Row label={t('status.queue')}>
            {days === null ? <span className="text-muted">{t('status.notQueued')}</span> : <span className={cx('num font-medium', days >= 7 && 'text-review')}>{t('status.queueDays', { count: days })}</span>}
          </Row>
        )}
        {full && (
          <Row label={platform === 'modrinth' ? t('kpi.followers') : t('kpi.thumbs')}>
            <span className="num">{info.followers === null ? NO_VALUE : formatCount(info.followers)}</span>
          </Row>
        )}
        {full && (
          <Row label={t('status.published')}>
            <RelativeTime iso={info.publishedAt} />
          </Row>
        )}
        <Row label={t('status.updated')}>
          <RelativeTime iso={info.updatedAt} />
        </Row>
        {full && (
          <Row label={platform === 'modrinth' ? t('status.versions') : t('status.files')}>
            <span className="num">{formatCount(info.files)}</span>
          </Row>
        )}
        <Row label={tc('word.downloads')}>
          <span className="num">{formatCount(info.downloads)}</span> <span className="text-xs text-muted"><DeltaText value={info.delta7d} suffix={` ${t('kpi.week')}`} /></span>
        </Row>
      </dl>
      {info.statusMessage && (
        <blockquote className="mt-3 rounded-md border border-line border-l-2 border-l-review bg-sunk p-3 text-sm text-ink">
          <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">{t('status.message')}</p>
          {info.statusMessage}
        </blockquote>
      )}
    </Card>
  )
}
