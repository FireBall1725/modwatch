// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { IconName } from './components/ui/Icon'

export interface AppRoute {
  path: string
  /** Key under common:nav for the label and the default tab title. */
  nav: 'overview' | 'mods' | 'downloads' | 'versions' | 'issues' | 'releases' | 'settings'
  icon: IconName
  /** Listed in the side nav. The mod page is reached from the mods list instead. */
  inNav: boolean
  /** The page renders its own sub routes, so the router matches the path and everything under it. */
  nested?: boolean
  Page: LazyExoticComponent<ComponentType>
}

/** Every route, one lazy page each. Page folders live in pages/<dir>/index.tsx with a default export. */
export const routes: AppRoute[] = [
  { path: '/', nav: 'overview', icon: 'overview', inNav: true, Page: lazy(() => import('./pages/overview')) },
  { path: '/mods', nav: 'mods', icon: 'mods', inNav: true, Page: lazy(() => import('./pages/mods')) },
  { path: '/mods/:slug', nav: 'mods', icon: 'mods', inNav: false, Page: lazy(() => import('./pages/mod-detail')) },
  { path: '/downloads', nav: 'downloads', icon: 'downloads', inNav: true, Page: lazy(() => import('./pages/downloads')) },
  { path: '/versions', nav: 'versions', icon: 'versions', inNav: true, Page: lazy(() => import('./pages/versions')) },
  { path: '/issues', nav: 'issues', icon: 'issues', inNav: true, Page: lazy(() => import('./pages/issues')) },
  { path: '/releases', nav: 'releases', icon: 'releases', inNav: true, Page: lazy(() => import('./pages/releases')) },
  { path: '/settings', nav: 'settings', icon: 'settings', inNav: true, nested: true, Page: lazy(() => import('./pages/settings')) },
]

export const navRoutes = routes.filter((r) => r.inNav)
