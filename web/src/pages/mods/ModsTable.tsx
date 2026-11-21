// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DeltaText from '../../components/ui/DeltaText'
import Icon from '../../components/ui/Icon'
import { cx } from '../../lib/cx'
import { STRIPE } from './stripe'
import type { ModSummary } from '../../lib/types'
import { DownloadsCell, IssuesCell, InlineMeta, ModCell, ReleaseCell, StatusCell, VersionChips } from './cells'
import { defaultDir, type SortDir, type SortKey } from './logic'

interface Col {
  key: string
  sort?: SortKey
  align?: 'left' | 'right'
  /** Hide below this width; the info is still on the mod page. */
  show?: string
  width?: string
  /** A second header line saying what the figure covers. */
  note?: boolean
}

const COLS: Col[] = [
  { key: 'mod', sort: 'name' },
  { key: 'curseforge', sort: 'curseforge', width: '11.5rem' },
  { key: 'modrinth', sort: 'modrinth', width: '11.5rem' },
  { key: 'issues', sort: 'issues', width: '8rem' },
  { key: 'downloads', sort: 'downloads', align: 'right', width: '9rem', note: true },
  { key: 'delta7d', sort: 'delta7d', align: 'right', width: '8rem', note: true },
  { key: 'release', sort: 'release', show: 'hidden xl:table-cell', width: '10rem' },
  { key: 'minecraft', sort: 'minecraft', show: 'hidden xl:table-cell', width: '9.5rem' },
]

interface Props {
  mods: ModSummary[]
  sort: SortKey
  dir: SortDir
  onSort: (key: SortKey, dir: SortDir) => void
}

/** The wide layout: one dense row per mod, controlled sort, rows link to the mod page. */
export default function ModsTable({ mods, sort, dir, onSort }: Props) {
  const { t } = useTranslation('mods')
  const navigate = useNavigate()
  const toggle = (key: SortKey) => onSort(key, key === sort ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir(key))

  const wrap = useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mods])

  return (
    <div ref={wrap} className="overflow-x-auto" tabIndex={scrolls ? 0 : undefined} role="region" aria-label={t('table.label')}>
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{t('title')}</caption>
        <thead>
          <tr>
            {COLS.map((c) => {
              const active = c.sort === sort
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  style={c.width ? { width: c.width } : undefined}
                  className={cx(
                    'border-b border-line px-3 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-muted uppercase',
                    c.align === 'right' ? 'text-right' : 'text-left',
                    c.show,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => c.sort && toggle(c.sort)}
                    className={cx('inline-flex min-h-8 cursor-pointer items-center gap-1 py-1.5 uppercase hover:text-ink', active && 'text-ink')}
                  >
                    <span className={cx('flex flex-col leading-tight', c.align === 'right' ? 'items-end' : 'items-start')}>
                      {t(`columns.${c.key}`)}
                      {c.note && <span className="text-2xs font-normal tracking-normal text-faint normal-case">{t(`columns.${c.key}Note`)}</span>}
                    </span>
                    <Icon name={active ? (dir === 'asc' ? 'arrow_up' : 'arrow_down') : 'sort'} size={12} className={active ? 'text-accent' : 'opacity-50'} />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {mods.map((m) => {
            const href = `/mods/${encodeURIComponent(m.slug)}`
            return (
              <tr
                key={m.slug}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a,button')) return
                  void navigate(href)
                }}
                className="group/row cursor-pointer transition-colors hover:bg-sunk/70 focus-within:bg-sunk/70"
              >
                <td className={cx('border-b border-l-[3px] border-b-line/60 px-3 py-3 group-last/row:border-b-0', STRIPE[m.health])}>
                  <Link to={href} className="block rounded-sm text-inherit no-underline">
                    <ModCell mod={m} />
                    <InlineMeta mod={m} />
                  </Link>
                </td>
                <Td>
                  <StatusCell info={m.curseforge} platform="curseforge" />
                </Td>
                <Td>
                  <StatusCell info={m.modrinth} platform="modrinth" />
                </Td>
                <Td>
                  <IssuesCell mod={m} />
                </Td>
                <Td align="right">
                  <DownloadsCell mod={m} />
                </Td>
                <Td align="right">
                  <DeltaText value={m.downloads.delta7d} />
                </Td>
                <Td show="hidden xl:table-cell">
                  <ReleaseCell mod={m} />
                </Td>
                <Td show="hidden xl:table-cell">
                  <VersionChips versions={m.minecraftVersions} max={2} />
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Td({ children, align, show }: { children: React.ReactNode; align?: 'right'; show?: string }) {
  return <td className={cx('border-b border-line/60 px-3 py-3 align-middle group-last/row:border-b-0', align === 'right' ? 'text-right' : 'text-left', show)}>{children}</td>
}
