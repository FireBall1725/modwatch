// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import Icon from './Icon'

export interface Column<T> {
  /** Unique within the table. Also the sort key. */
  key: string
  header: ReactNode
  /** Renders the cell. */
  cell: (row: T) => ReactNode
  /** Makes the column sortable. Return a number or string; null sorts last in either direction. */
  sortValue?: (row: T) => number | string | null
  align?: 'left' | 'right' | 'center'
  /** CSS width, such as "8rem". */
  width?: string
  /** Hide the column below a breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  /** Extra classes on the td, for example "num". */
  className?: string
}

export interface Sort {
  key: string
  dir: 'asc' | 'desc'
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Visually hidden table caption; names the table for screen readers. */
  caption: string
  defaultSort?: Sort
  /** Controlled sort, for pages that keep it in the URL. Pair with onSortChange. */
  sort?: Sort
  onSortChange?: (sort: Sort) => void
  /** Makes each row a link: the first cell gets a real anchor, and clicking anywhere in the row follows it. */
  rowHref?: (row: T) => string | undefined
  /** Shown instead of the body when rows is empty. */
  empty?: ReactNode
  /** Tighter rows. */
  dense?: boolean
  /** Header sticks to the top of the nearest scrolling ancestor, or of maxHeight. */
  stickyHeader?: boolean
  /** Scroll the body inside this height, such as "28rem". */
  maxHeight?: string
  rowClassName?: (row: T) => string | undefined
  className?: string
}

const HIDE = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' }

function compare(a: number | string | null, b: number | string | null, dir: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'en-CA', { numeric: true })
  return dir === 'asc' ? c : -c
}

/**
 * Sortable table. Props: columns (key, header, cell, sortValue, align, width, hideBelow, className), rows, rowKey,
 * caption, defaultSort, rowHref, empty, dense, stickyHeader, maxHeight, rowClassName. Headers with a sortValue are
 * buttons (keyboard sortable, aria-sort set). Wide tables scroll sideways inside their own box, never the page.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  rowHref,
  empty,
  dense = false,
  stickyHeader = true,
  maxHeight,
  rowClassName,
  className,
}: Props<T>) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [localSort, setLocalSort] = useState<Sort | undefined>(defaultSort)
  const sort = controlledSort ?? localSort

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key)
    if (!sort || !col?.sortValue) return rows
    const get = col.sortValue
    return [...rows].sort((a, b) => compare(get(a), get(b), sort.dir))
  }, [rows, columns, sort])

  const toggle = (key: string) => {
    const next: Sort = sort?.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: columns.find((c) => c.key === key)?.align === 'right' ? 'desc' : 'asc' }
    setLocalSort(next)
    onSortChange?.(next)
  }

  const pad = dense ? 'px-3 py-1.5' : 'px-4 py-3'

  return (
    <div
      className={cx('relative overflow-auto rounded-lg', className)}
      style={maxHeight ? { maxHeight } : undefined}
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className={cx('w-full border-separate border-spacing-0 text-sm', stickyHeader && 'table-head-sticky')}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              const ariaSort = !c.sortValue ? undefined : active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  style={c.width ? { width: c.width } : undefined}
                  className={cx(
                    'border-b border-line text-xs font-medium tracking-wide text-muted uppercase whitespace-nowrap',
                    dense ? 'px-3 py-2' : 'px-4 py-2.5',
                    ALIGN[c.align ?? 'left'],
                    c.hideBelow && HIDE[c.hideBelow],
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cx(
                        'inline-flex cursor-pointer items-center gap-1 uppercase hover:text-ink',
                        active && 'text-ink',
                      )}
                    >
                      {c.header}
                      <span className="sr-only">{t('table.sortBy')}</span>
                      <Icon name={active ? (sort.dir === 'asc' ? 'arrow_up' : 'arrow_down') : 'sort'} size={12} className={active ? 'text-accent' : 'opacity-50'} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const href = rowHref?.(row)
            return (
              <tr
                key={rowKey(row)}
                onClick={
                  href
                    ? (e) => {
                        if ((e.target as HTMLElement).closest('a,button,input,select,label')) return
                        void navigate(href)
                      }
                    : undefined
                }
                className={cx('group/row transition-colors hover:bg-sunk/70', href && 'cursor-pointer', rowClassName?.(row))}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cx(
                      'border-b border-line/60 align-middle group-last/row:border-b-0',
                      pad,
                      ALIGN[c.align ?? 'left'],
                      c.hideBelow && HIDE[c.hideBelow],
                      c.className,
                    )}
                  >
                    {href && i === 0 ? (
                      <Link to={href} className="block rounded-sm text-inherit no-underline">
                        {c.cell(row)}
                      </Link>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && (empty ?? <p className="px-4 py-10 text-center text-sm text-muted">{t('table.empty')}</p>)}
    </div>
  )
}
