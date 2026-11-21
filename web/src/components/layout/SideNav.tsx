// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { navRoutes } from '../../routes'
import Icon from '../ui/Icon'
import { useOverview } from '../../hooks/overviewContext'
import Brand from './Brand'

/** The nav list itself, shared by the sidebar and the phone drawer. Labels hide below xl unless forced. Props: showLabels (always show them, for the drawer), onNavigate. */
export function NavList({ showLabels = false, onNavigate }: { showLabels?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('common')
  const overview = useOverview()
  const totals = overview.data?.totals
  const badge: Record<string, number | undefined> = {
    '/issues': totals?.openIssues,
    '/mods': totals?.needAttention,
  }
  return (
    <ul className="flex flex-col gap-1">
      {navRoutes.map((r) => {
        const count = badge[r.path]
        return (
          <li key={r.path}>
            <NavLink
              to={r.path}
              end={r.path === '/'}
              onClick={onNavigate}
              title={t(`nav.${r.nav}`)}
              className={({ isActive }) =>
                cx(
                  'group relative flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150',
                  isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-raised hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden="true" className="absolute top-2 bottom-2 -left-0.5 w-1 rounded-full bg-accent" />}
                  <Icon name={r.icon} size={20} className={isActive ? 'text-accent' : undefined} />
                  <span className={showLabels ? '' : 'max-xl:sr-only'}>{t(`nav.${r.nav}`)}</span>
                  {count ? (
                    <span className={cx('num ml-auto rounded-full bg-sunk px-1.5 py-0.5 text-2xs text-muted', !showLabels && 'max-xl:absolute max-xl:top-1 max-xl:right-1 max-xl:ml-0 max-xl:px-1')}>
                      <span className="sr-only">{t('nav.countLabel')} </span>
                      {count}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

/** Left navigation for md and up: full width at xl (1280 px), an icon rail below. */
export default function SideNav() {
  const { t } = useTranslation('common')
  return (
    <aside className="fixed inset-y-0 left-0 z-[30] hidden w-[var(--nav-rail)] flex-col border-r border-line bg-surface/90 backdrop-blur md:flex xl:w-[var(--nav-width)]">
      <div className="flex h-[var(--header-height)] items-center px-4 max-xl:justify-center max-xl:px-0">
        <span className="max-xl:hidden">
          <Brand />
        </span>
        <span className="hidden max-xl:block">
          <Brand showName={false} />
        </span>
      </div>
      <nav aria-label={t('nav.label')} className="flex-1 overflow-y-auto px-3 py-3">
        <NavList />
      </nav>
    </aside>
  )
}
