// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, matchPath, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { routes } from '../../routes'
import ErrorBoundary from './ErrorBoundary'
import Footer from './Footer'
import Header from './Header'
import NavDrawer from './NavDrawer'
import PageSkeleton from './PageSkeleton'
import SideNav from './SideNav'

/** The frame around every page: skip link, left nav (md and up), sticky header, the page in an error boundary and Suspense, footer. Moves focus to main and sets a default tab title on every route change. */
export default function AppShell() {
  const { t } = useTranslation('common')
  const { pathname } = useLocation()
  const [drawer, setDrawer] = useState(false)
  const main = useRef<HTMLElement>(null)
  const lastPath = useRef(pathname)

  useLayoutEffect(() => {
    const hit = routes.find((r) => matchPath({ path: r.path, end: true }, pathname))
    document.title = `${hit ? t(`nav.${hit.nav}`) : t('notFound.title')} · Modwatch`
  }, [pathname, t])

  useEffect(() => {
    // Only a real navigation moves focus; the first paint (and StrictMode's second effect run) must not.
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    main.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          main.current?.focus()
        }}
        className="sr-only-focusable fixed top-2 left-2 z-[100] rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
      >
        {t('app.skipToContent')}
      </a>
      <SideNav />
      <NavDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="flex min-h-dvh flex-col md:pl-[var(--nav-rail)] xl:pl-[var(--nav-width)]">
        <Header onMenu={() => setDrawer(true)} />
        <main id="main" ref={main} tabIndex={-1} className="flex-1 px-[var(--gutter)] py-6 outline-none md:py-8">
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <div key={pathname} className="page-enter mx-auto flex w-full max-w-[120rem] flex-col gap-[var(--section-gap)]">
                <Outlet />
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </div>
  )
}
