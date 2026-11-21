// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// The API client reads VITE_MOCK when it loads, so the env is set before any app module is imported.
vi.stubEnv('VITE_MOCK', '1')

class FakeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', FakeObserver)
  vi.stubGlobal('IntersectionObserver', FakeObserver)
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList
  }
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const ROUTES = ['/', '/mods', '/mods/create-turbolifts', '/downloads', '/versions', '/issues', '/releases', '/settings']

describe('every route renders in mock mode', () => {
  it.each(ROUTES)('%s shows a main heading and logs no errors', async (path) => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await import('../i18n')
    const { default: App } = await import('../App')
    window.history.pushState({}, '', path)
    render(<App />)
    const heading = await screen.findByRole('heading', { level: 1 }, { timeout: 4000 })
    expect(heading.textContent?.trim()).not.toBe('')
    expect(errors).not.toHaveBeenCalled()
  })

  it('reaches every nav route from the side nav', async () => {
    await import('../i18n')
    const { default: App } = await import('../App')
    const { navRoutes } = await import('../routes')
    window.history.pushState({}, '', '/')
    render(<App />)
    await screen.findByRole('heading', { level: 1 })
    for (const r of navRoutes) {
      const links = document.querySelectorAll(`a[href="${r.path}"]`)
      expect(links.length, r.path).toBeGreaterThan(0)
    }
  })
})
