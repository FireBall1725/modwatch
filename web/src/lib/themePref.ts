// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useSyncExternalStore } from 'react'
import { DEFAULT_THEME, THEMES } from '../themes/build'

const KEY = 'modwatch.theme'

function known(id: string | null): id is string {
  return id !== null && THEMES.some((t) => t.id === id)
}

function read(): string {
  try {
    const v = localStorage.getItem(KEY)
    return known(v) ? v : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME // private window or blocked storage
  }
}

function apply(id: string): void {
  // The default theme is the base styles, so it is the absence of an override.
  if (id === DEFAULT_THEME) document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', id)
}

let value = read()
const listeners = new Set<() => void>()
apply(value)

/** The id of the colour theme in use. Kept in this browser only, so a screen can have its own look. */
export function getTheme(): string {
  return value
}

export function setTheme(next: string): void {
  if (!known(next) || next === value) return
  value = next
  apply(next)
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // The choice still holds for this tab.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme(): [string, (next: string) => void] {
  return [useSyncExternalStore(subscribe, getTheme, () => DEFAULT_THEME), setTheme]
}
