// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { SettingItem, SettingKey, SettingsUpdate } from '../../lib/types'
import { isRepo } from './logic'

export type GroupId = 'curseforge' | 'modrinth' | 'github' | 'prometheus' | 'revenue'

/** The connection settings as the page lists them: one group per service, in the order a new install needs them. */
export const GROUPS: { id: GroupId; keys: SettingKey[] }[] = [
  { id: 'curseforge', keys: ['curseforgeApiKey', 'curseforgeAuthorId'] },
  { id: 'modrinth', keys: ['modrinthToken', 'modrinthUser'] },
  { id: 'github', keys: ['githubToken', 'githubIssuesRepo'] },
  { id: 'prometheus', keys: ['metricsEnabled'] },
  { id: 'revenue', keys: ['revenueEnabled'] },
]

/** Settings shown as an on/off switch instead of a text field. */
export function isSwitch(key: SettingKey): boolean {
  return key === 'metricsEnabled' || key === 'revenueEnabled'
}

/** Whether /metrics is served: on unless the value says false, so "not chosen" is on. */
export function metricsOn(item: SettingItem): boolean {
  return item.value !== 'false'
}

export type DraftError = 'digits' | 'repo' | 'spaces'

/** Whether a typed value is acceptable. Empty is fine here; it just means there is nothing to save. */
export function draftError(key: SettingKey, draft: string): DraftError | null {
  const v = draft.trim()
  if (v === '') return null
  if (key === 'curseforgeAuthorId') return /^[1-9]\d{0,9}$/.test(v) ? null : 'digits'
  if (key === 'githubIssuesRepo') return isRepo(v) ? null : 'repo'
  // Keys and names are one token; a space or line break means something was pasted along with it.
  return /\s/.test(v) ? 'spaces' : null
}

/** Save is allowed for a new, valid value. A plain field must also differ from what it shows now. */
export function canSave(item: SettingItem, draft: string): boolean {
  const v = draft.trim()
  if (v === '' || draftError(item.key, v) !== null) return false
  return item.secret || v !== (item.value ?? '')
}

/** What the second button does: nothing when no value was set here, fall back to the environment variable when there is one, else clear. */
export function clearAction(item: SettingItem): 'env' | 'clear' | null {
  if (item.source !== 'ui') return null
  return item.envSet ? 'env' : 'clear'
}

/** The PUT body for one row. A null draft clears the value set here. */
export function updateFor(key: SettingKey, draft: string | null): SettingsUpdate {
  return { [key]: draft === null ? null : draft.trim() }
}

/** What a plain field starts with. A secret never does, because the server never sends it. */
export function initialDraft(item: SettingItem): string {
  return item.secret ? '' : (item.value ?? '')
}
