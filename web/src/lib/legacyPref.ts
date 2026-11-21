// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useSyncExternalStore } from 'react'

const KEY = 'modwatch.showLegacy'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false // private window or blocked storage: the default is to hide
  }
}

let value = read()
const listeners = new Set<() => void>()

/** Whether mods marked legacy are in the lists and charts. Off by default: one 1.7.10 mod flattens every chart it shares. */
export function getShowLegacy(): boolean {
  return value
}

export function setShowLegacy(next: boolean): void {
  if (next === value) return
  value = next
  try {
    localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    // The choice still holds for this tab.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useShowLegacy(): [boolean, (next: boolean) => void] {
  return [useSyncExternalStore(subscribe, getShowLegacy, () => false), setShowLegacy]
}

/** Appends ?legacy=1 (or &legacy=1) to a list endpoint's path when legacy mods are switched on. */
export function withLegacy(path: string): string {
  if (!value) return path
  return path + (path.includes('?') ? '&' : '?') + 'legacy=1'
}
