// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import NotFound from './components/layout/NotFound'
import OverviewProvider from './components/layout/OverviewProvider'
import { routes } from './routes'

// Dev-only style guide; the production build drops it.
const KitGallery = import.meta.env.DEV ? lazy(() => import('./components/layout/KitGallery')) : null

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
