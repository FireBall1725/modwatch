// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useSyncExternalStore } from 'react'

const KEY = 'modwatch.hideMoney'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false // private window or blocked storage: amounts show
  }
}

let value = read()
const listeners = new Set<() => void>()

/** Whether money amounts are replaced with dots, for sharing a screen. Kept in this browser only. */
export function getHideMoney(): boolean {
  return value
}

export function setHideMoney(next: boolean): void {
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

export function useHideMoney(): [boolean, (next: boolean) => void] {
  return [useSyncExternalStore(subscribe, getHideMoney, () => false), setHideMoney]
}
