// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import TimeSeriesChart from '../../components/charts/TimeSeriesChart'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import SegmentedControl from '../../components/ui/SegmentedControl'
import { formatCount } from '../../lib/format'
import type { DownloadPoint } from '../../lib/types'
import { chartData, gained, RANGES, sliceHistory, type ChartView, type RangeKey } from './logic'

interface Props {
  history: DownloadPoint[]
  range: RangeKey
  view: ChartView
  onRange: (r: RangeKey) => void
  onView: (v: ChartView) => void
}

/** Stacked platform downloads over time, as running totals or per day. */
export default function DownloadsCard({ history, range, view, onRange, onView }: Props) {
  const { t } = useTranslation('modDetail')
  const sliced = useMemo(() => sliceHistory(history, range), [history, range])
  const data = useMemo(() => chartData(sliced, view), [sliced, view])
  const gain = useMemo(() => gained(sliced), [sliced])
  const rangeLabel = t(`chart.range_${range}`)

  return (
    <Card
      title={t('chart.title')}
      description={gain ? t('chart.gained', { n: formatCount(gain.total) }) : undefined}
      actions={
        <>
          <SegmentedControl
            size="sm"
            label={t('chart.view')}
            value={view}
            onChange={onView}
            options={[
              { value: 'total', label: t('chart.total') },
              { value: 'daily', label: t('chart.daily') },
            ]}
          />
          <SegmentedControl size="sm" label={t('range.label', { ns: 'common' })} value={range} onChange={onRange} options={RANGES.map((r) => ({ value: r, label: t(`chart.range_${r}`) }))} />
        </>
      }
    >
      {data.x.length < 2 || [...data.curseforge, ...data.modrinth].every((v) => !v) ? (
        <EmptyState compact icon="trend_up" title={t('chart.empty')} description={t('chart.emptyDetail')} />
      ) : (
        <TimeSeriesChart
          x={data.x}
          kind={view === 'daily' ? 'bar' : 'area'}
          stacked
          height={280}
          caption={t(view === 'daily' ? 'chart.captionDaily' : 'chart.captionTotal', { range: rangeLabel })}
          series={[
            { key: 'curseforge', label: t('platform.curseforge', { ns: 'common' }), color: 'var(--color-cf)', values: data.curseforge },
            { key: 'modrinth', label: t('platform.modrinth', { ns: 'common' }), color: 'var(--color-mr)', values: data.modrinth },
          ]}
        />
      )}
    </Card>
  )
}
