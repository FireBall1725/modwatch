// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from 'react-i18next'
import Icon from '../ui/Icon'
import Brand from './Brand'
import LegacyToggle from './LegacyToggle'
import PollStatus, { SourceHealth } from './PollStatus'
import { useOverview } from '../../hooks/overviewContext'

/** Sticky top bar. Under md it carries the menu button and brand; from md up the nav is on the left and this shows source health on the left, poll status and Poll now on the right. */
export default function Header({ onMenu }: { onMenu: () => void }) {
  const { t } = useTranslation('common')
  const { data } = useOverview()
  const problems = data?.problems ?? []
  return (
    <header className="sticky top-0 z-[20] flex h-[var(--header-height)] items-center justify-between gap-3 border-b border-line bg-ground/85 px-[var(--gutter)] backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label={t('app.menu')}
          className="-ml-2 flex size-11 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-raised hover:text-ink md:hidden"
        >
          <Icon name="menu" size={22} />
        </button>
        <span className="md:hidden">
          <Brand />
        </span>
        <div className="hidden items-center gap-5 md:flex">
          <SourceHealth />
          <LegacyToggle />
          {problems.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-review">
              <Icon name="warning" size={14} />
              {t('app.setupProblems', { count: problems.length })}
            </span>
          )}
        </div>
      </div>
      <div className="hidden md:block">
        <PollStatus />
      </div>
      <div className="md:hidden">
        <PollStatus compact />
      </div>
    </header>
  )
}
