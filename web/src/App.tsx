// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { Fragment, lazy, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import NotFound from './components/layout/NotFound'
import OverviewProvider from './components/layout/OverviewProvider'
import { useShowLegacy } from './lib/legacyPref'
import { routes } from './routes'

// Dev-only style guide; the production build drops it.
const KitGallery = import.meta.env.DEV ? lazy(() => import('./components/layout/KitGallery')) : null

/** Remounts the pages when the legacy switch flips, so every one fetches again with the new setting. */
function LegacyBoundary({ children }: { children: ReactNode }) {
  const [show] = useShowLegacy()
  return <Fragment key={show ? 'legacy' : 'current'}>{children}</Fragment>
}

export default function App() {
  return (
    <BrowserRouter>
      <LegacyBoundary>
        <OverviewProvider>
          <Routes>
            <Route element={<AppShell />}>
              {routes.map(({ path, Page }) => (
                <Route key={path} path={path} element={<Page />} />
              ))}
              {KitGallery && <Route path="/_kit" element={<KitGallery />} />}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </OverviewProvider>
      </LegacyBoundary>
    </BrowserRouter>
  )
}
