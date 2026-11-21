// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../hooks/useApi'
import { api } from '../../lib/api'
import { formatCompact, formatCount } from '../../lib/format'
import type { ModSummary, ReviewStatus } from '../../lib/types'
import BarList from '../charts/BarList'
import Donut from '../charts/Donut'
import Heatmap from '../charts/Heatmap'
import Sparkline from '../charts/Sparkline'
import TimeSeriesChart from '../charts/TimeSeriesChart'
import Button from '../ui/Button'
import Card from '../ui/Card'
import DataTable from '../ui/DataTable'
import DeltaText from '../ui/DeltaText'
import Dialog from '../ui/Dialog'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import HealthDot from '../ui/HealthDot'
import Icon from '../ui/Icon'
import KpiCard from '../ui/KpiCard'
import ModIcon from '../ui/ModIcon'
import PageHeader from '../ui/PageHeader'
import PlatformBadge from '../ui/PlatformBadge'
import ProgressBar from '../ui/ProgressBar'
import SearchInput from '../ui/SearchInput'
import SegmentedControl from '../ui/SegmentedControl'
import Select from '../ui/Select'
import SeverityBadge from '../ui/SeverityBadge'
import Skeleton from '../ui/Skeleton'
import StatusChip from '../ui/StatusChip'
import TextInput from '../ui/TextInput'
import Toggle from '../ui/Toggle'
import Tooltip from '../ui/Tooltip'

const STATUSES: ReviewStatus[] = ['approved', 'in_review', 'changes_required', 'rejected', 'draft', 'unlisted', 'archived', 'inactive', 'unknown']

/** Dev-only style guide at /_kit: every shared component against the mock data. Not part of the production routes. */
export default function KitGallery() {
  const { t } = useTranslation('common')
  const mods = useApi(api.mods, [])
  const [days, setDays] = useState<7 | 30 | 90 | 365>(90)
  const hist = useApi(() => api.downloadsHistory(days), [days])
  const vers = useApi(api.versions, [])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState('a')
  const [on, setOn] = useState(true)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('ae2-lights')

  const owned: ModSummary[] = useMemo(() => (mods.data ?? []).filter((m) => m.owned), [mods.data])
  const x = hist.data?.total.map((p) => p.at) ?? []
  const cf = hist.data?.total.map((p) => p.curseforge) ?? []
  const mr = hist.data?.total.map((p) => p.modrinth) ?? []
  const daily = (a: number[]) => a.map((v, i) => (i === 0 ? null : v - a[i - 1]))
  const top = owned[0]
  const total = owned.reduce((a, m) => a + m.downloads.total, 0)

  return (
    <>
      <PageHeader title="Component kit" description="Every shared component on the mock data." actions={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Open dialog</Button>} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Downloads" icon="downloads" value={formatCount(total)} footer={<span className="flex gap-3"><DeltaText value={487} suffix="24h" /><DeltaText value={3870} suffix="7d" /></span>} />
        <KpiCard label="Open issues" icon="issues" tone="bad" value="9" footer="2 bugs, 1 crash" href="/issues" />
        <KpiCard label="Need attention" icon="warning" tone="review" value="9" unit="of 14 mods" />
        <KpiCard label="Loading" icon="clock" value="0" loading />
      </section>

      <Card title="Badges and chips" description="Word, icon and colour together.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">{STATUSES.map((s) => <StatusChip key={s} status={s} />)}</div>
          <div className="flex flex-wrap gap-2">{STATUSES.map((s) => <StatusChip key={s} status={s} size="sm" />)}</div>
          <div className="flex flex-wrap items-center gap-3">
            <PlatformBadge platform="curseforge" /><PlatformBadge platform="modrinth" />
            <PlatformBadge platform="curseforge" size="sm" /><PlatformBadge platform="modrinth" size="sm" iconOnly />
            <SeverityBadge severity="problem" /><SeverityBadge severity="warning" /><SeverityBadge severity="info" />
            <HealthDot health="ok" showLabel /><HealthDot health="attention" showLabel /><HealthDot health="problem" showLabel />
            <DeltaText value={120} /><DeltaText value={-14} /><DeltaText value={0} /><DeltaText value={null} />
            <Tooltip content="Moderators asked for a licence statement."><button type="button" className="rounded-sm border border-line-strong px-2 py-1 text-xs text-muted">Tooltip</button></Tooltip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['overview','mods','downloads','versions','issues','releases','settings','bug','crash','enhancement','compatibility','question','external','github','link','unlink','trend_up','trend_down','calendar','package','filter','edit','trash','wand'] as const).map((n) => <span key={n} title={n} className="flex size-9 items-center justify-center rounded-md border border-line text-muted"><Icon name={n} /></span>)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {owned.slice(0, 6).map((m) => <ModIcon key={m.slug} src={m.iconUrl} name={m.name} />)}
            <ModIcon src="" name="Twitch Notifier" size={32} />
            <ModIcon src="https://example.invalid/missing.png" name="Broken Url" size={24} />
          </div>
        </div>
      </Card>

      <Card title="Controls">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SegmentedControl label={t('range.label')} value={days} onChange={setDays} options={[{ value: 7, label: t('range.days_7') }, { value: 30, label: t('range.days_30') }, { value: 90, label: t('range.days_90') }, { value: 365, label: t('range.days_365') }]} />
          <SearchInput value={q} onChange={setQ} placeholder="Search mods" />
          <Select label="Platform" value={sel} onChange={setSel} options={[{ value: 'a', label: 'All platforms' }, { value: 'b', label: 'CurseForge' }]} />
          <Toggle checked={on} onChange={setOn} label="Include member mods" description="Mods you are a member of" />
          <TextInput label="Modrinth id" value={text} onChange={setText} mono helper="From the project URL" />
          <TextInput label="Name" value="" onChange={() => {}} error="Name must not be empty" />
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="primary">Primary</Button><Button>Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger" icon="trash">Unlink</Button><Button loading>Saving</Button><Button disabled>Disabled</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-[var(--section-gap)] xl:grid-cols-3">
        <Card title="Downloads over time" description="Cumulative, both platforms" className="xl:col-span-2" actions={<span className="text-xs text-muted">{days} days</span>}>
          {hist.data && <TimeSeriesChart x={x} caption="Cumulative downloads by platform" format={formatCompact} series={[{ key: 'cf', label: 'CurseForge', color: 'var(--color-cf)', values: cf }, { key: 'mr', label: 'Modrinth', color: 'var(--color-mr)', values: mr }]} kind="area" stacked />}
          {!hist.data && <Skeleton className="h-64 w-full" />}
        </Card>
        <Card title="Split">
          <Donut ariaLabel="Downloads by platform" segments={[{ key: 'cf', label: 'CurseForge', value: owned.reduce((a, m) => a + m.downloads.curseforge, 0), color: 'var(--color-cf)' }, { key: 'mr', label: 'Modrinth', value: owned.reduce((a, m) => a + m.downloads.modrinth, 0), color: 'var(--color-mr)' }]} center={<><span className="num text-xl text-ink">{formatCompact(total)}</span><span className="text-xs text-muted">downloads</span></>} />
          <div className="mt-5"><ProgressBar legend segments={[{ key: 'cf', label: 'CurseForge', value: top?.downloads.curseforge ?? 0, color: 'var(--color-cf)' }, { key: 'mr', label: 'Modrinth', value: top?.downloads.modrinth ?? 0, color: 'var(--color-mr)' }]} format={formatCount} /></div>
        </Card>
        <Card title="Downloads per day" description="Lines, grouped bars">
          {hist.data && <TimeSeriesChart kind="bar" height={200} x={x.slice(-30)} caption="Downloads per day, last 30 days" series={[{ key: 'cf', label: 'CurseForge', color: 'var(--color-cf)', values: daily(cf).slice(-30) }, { key: 'mr', label: 'Modrinth', color: 'var(--color-mr)', values: daily(mr).slice(-30) }]} stacked />}
        </Card>
        <Card title="Per day, lines">
          {hist.data && <TimeSeriesChart height={200} x={x} caption="Downloads per day" series={[{ key: 'cf', label: 'CurseForge', color: 'var(--color-cf)', values: daily(cf) }, { key: 'mr', label: 'Modrinth', color: 'var(--color-mr)', values: daily(mr) }]} />}
        </Card>
        <Card title="Top mods">
          <BarList ariaLabel="Downloads by mod" topN={6} items={owned.map((m) => ({ key: m.slug, label: m.name, value: m.downloads.total, href: '/mods/' + m.slug, leading: <ModIcon src={m.iconUrl} name={m.name} size={20} />, parts: [{ key: 'cf', label: 'CurseForge', value: m.downloads.curseforge, color: 'var(--color-cf)' }, { key: 'mr', label: 'Modrinth', value: m.downloads.modrinth, color: 'var(--color-mr)' }] }))} />
        </Card>
      </div>

      <Card title="Mod by version" description="Heatmap with the number in every cell">
        {vers.data && (
          <Heatmap
            caption="Downloads per mod and Minecraft version"
            emptyLabel="No file"
            highlightColumn={vers.data.latestMinecraft ?? undefined}
            rows={vers.data.matrix.rows.map((r) => ({ key: r.slug, label: r.name, name: r.name }))}
            columns={vers.data.matrix.versions.map((v) => ({ key: v, label: v }))}
            value={(r, c) => vers.data?.matrix.rows.find((x) => x.slug === r)?.cells[c]?.downloads}
          />
        )}
      </Card>

      <Card title="Table" padded={false}>
        <DataTable
          caption="Mods"
          rowKey={(m) => m.slug}
          rowHref={(m) => '/mods/' + m.slug}
          defaultSort={{ key: 'downloads', dir: 'desc' }}
          rows={owned.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))}
          maxHeight="22rem"
          columns={[
            { key: 'name', header: 'Mod', sortValue: (m) => m.name, cell: (m) => <span className="flex items-center gap-3"><ModIcon src={m.iconUrl} name={m.name} size={28} /><span className="font-medium">{m.name}</span></span> },
            { key: 'cf', header: 'CurseForge', hideBelow: 'md', sortValue: (m) => m.curseforge?.status ?? null, cell: (m) => (m.curseforge ? <StatusChip status={m.curseforge.status} size="sm" /> : <span className="text-faint">–</span>) },
            { key: 'mr', header: 'Modrinth', hideBelow: 'md', sortValue: (m) => m.modrinth?.status ?? null, cell: (m) => (m.modrinth ? <StatusChip status={m.modrinth.status} size="sm" /> : <span className="text-faint">–</span>) },
            { key: 'downloads', header: 'Downloads', align: 'right', className: 'num', sortValue: (m) => m.downloads.total, cell: (m) => formatCount(m.downloads.total) },
            { key: 'd7', header: '7d', align: 'right', hideBelow: 'sm', sortValue: (m) => m.downloads.delta7d, cell: (m) => <DeltaText value={m.downloads.delta7d} /> },
            { key: 'health', header: 'Health', hideBelow: 'lg', sortValue: (m) => m.health, cell: (m) => <HealthDot health={m.health} showLabel /> },
            { key: 'trend', header: 'Trend', hideBelow: 'xl', cell: (m) => <Sparkline values={[1, 2, 2, 4, 3, 6, 7, m.downloads.total % 9]} area /> },
          ]}
        />
      </Card>

      <div className="grid gap-[var(--section-gap)] md:grid-cols-2">
        <Card><EmptyState compact icon="issues" title="No open issues" description="Everything in the issues repo is closed." action={<Button size="sm" href="/issues">View closed</Button>} /></Card>
        <ErrorState compact error="GitHub returned 403: rate limit exceeded" onRetry={() => {}} />
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Link a project" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setOpen(false)}>Save</Button></>}>
        <TextInput label="Modrinth id" value={text} onChange={setText} mono />
      </Dialog>
    </>
  )
}
