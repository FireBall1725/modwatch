// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

/** True when the viewer asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Scrolls an element to the top of the viewport, smoothly unless the viewer prefers reduced motion. Returns the element, or null. */
export function scrollToId(id: string): HTMLElement | null {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  return el
}
