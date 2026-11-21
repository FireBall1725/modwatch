// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import Button from '../../components/ui/Button'
import SearchInput from '../../components/ui/SearchInput'
import Select from '../../components/ui/Select'
import Toggle from '../../components/ui/Toggle'
import { activeFilterCount, type ModsQuery } from './logic'

interface Props {
  query: ModsQuery
  minecraft: string[]
  onChange: (patch: Partial<ModsQuery>) => void
  onClear: () => void
}

/** Search, selects and switches. Press / anywhere on the page to jump to search. */
export default function Toolbar({ query, minecraft, onChange, onClear }: Props) {
  const { t } = useTranslation('mods')
  const box = useRef<HTMLDivElement>(null)
  const count = activeFilterCount(query)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest('input,textarea,select,[contenteditable]')) return
      e.preventDefault()
      box.current?.querySelector('input')?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="grid grid-cols-2 gap-2.5 xl:flex-1 lg:grid-cols-[minmax(14rem,1.6fr)_repeat(3,minmax(10rem,1fr))]">
        <div ref={box} className="relative col-span-2 lg:col-span-1">
          <SearchInput value={query.q} onChange={(q) => onChange({ q })} placeholder={t('filters.search')} />
          {query.q === '' && (
            <kbd aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-sm border border-line bg-sunk px-1.5 text-xs text-muted lg:block">/</kbd>
          )}
        </div>
        <Select
          label={t('filters.platform')}
          hideLabel
          value={query.platform}
          onChange={(v) => onChange({ platform: v as ModsQuery['platform'] })}
          options={[
            { value: 'any', label: t('filters.platformAny') },
            { value: 'curseforge', label: t('filters.platformOnCf') },
            { value: 'modrinth', label: t('filters.platformOnMr') },
            { value: 'both', label: t('filters.platformBoth') },
            { value: 'one', label: t('filters.platformOne') },
          ]}
        />
        <Select
          label={t('filters.review')}
          hideLabel
          value={query.review}
          onChange={(v) => onChange({ review: v as ModsQuery['review'] })}
          options={[
            { value: 'any', label: t('filters.reviewAny') },
            { value: 'approved', label: t('filters.reviewApproved') },
            { value: 'in_review', label: t('filters.reviewInReview') },
            { value: 'not_approved', label: t('filters.reviewNotApproved') },
          ]}
        />
        <Select
          label={t('filters.minecraft')}
          hideLabel
          value={query.mc}
          className="col-span-2 lg:col-span-1"
          onChange={(mc) => onChange({ mc })}
          options={[{ value: '', label: t('filters.minecraftAny') }, ...minecraft.map((v) => ({ value: v, label: v }))]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Toggle checked={query.issues} onChange={(issues) => onChange({ issues })} label={t('filters.issues')} />
        <Toggle checked={query.members} onChange={(members) => onChange({ members })} label={t('filters.members')} />
        {count > 0 && (
          <Button variant="ghost" size="sm" icon="close" onClick={onClear} className="ml-auto">
            {t('filters.clear')} ({count})
          </Button>
        )}
      </div>
    </div>
  )
}
