// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ErrorState from '../../components/ui/ErrorState'
import Pill, { type Tone } from '../../components/ui/Pill'
import Skeleton from '../../components/ui/Skeleton'
import TextInput from '../../components/ui/TextInput'
import AuthorFinder from './AuthorFinder'
import Toggle from '../../components/ui/Toggle'
import { useApi } from '../../hooks/useApi'
import { useOverview } from '../../hooks/overviewContext'
import { api } from '../../lib/api'
import type { SettingItem, SettingKey, SettingSource } from '../../lib/types'
import { GROUPS, canSave, clearAction, draftError, initialDraft, isSwitch, metricsOn, updateFor } from './connections'

const SOURCE_TONE: Record<SettingSource, Tone> = { ui: 'accent', env: 'neutral', none: 'inactive' }

interface RowProps {
  item: SettingItem
  /** Called after the server accepted a change, with the sentence to show. */
  onDone: (key: SettingKey, text: string) => Promise<void>
}

/** One setting: its label and where the value comes from, a field, Save, and a way back to the environment variable. */
function Row({ item, onDone }: RowProps) {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState(() => initialDraft(item))
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const label = t(`connections.keys.${item.key}.label`)
  const typed = draftError(item.key, draft)
  const clear = clearAction(item)

  const send = async (value: string | null, done: string, kind: 'save' | 'clear') => {
    setBusy(kind)
    setFailure(null)
    try {
      await api.settingsPut(updateFor(item.key, value))
      await onDone(item.key, done)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e))
      setBusy(null)
    }
  }

  return (
    <form
      className="py-4 first:pt-0 last:pb-0"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSave(item, draft)) void send(draft, t('connections.saved', { label }), 'save')
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h4 className="text-sm font-medium text-ink">{label}</h4>
        <Pill tone={SOURCE_TONE[item.source]} size="sm">
          {t(`connections.source.${item.source}`)}
        </Pill>
        {item.source === 'ui' && item.envSet && <span className="text-xs text-faint">{t('connections.envToo')}</span>}
      </div>
      <p className="mt-0.5 text-xs text-muted">{t(`connections.keys.${item.key}.help`)}</p>
      <div className="mt-2 flex flex-wrap items-start gap-2">
        <TextInput
          className="min-w-[14rem] flex-1 basis-64"
          mono
          label={label}
          value={draft}
          onChange={setDraft}
          type={item.secret ? 'password' : 'text'}
          name={`modwatch-${item.key}`}
          placeholder={item.secret ? (item.set ? t('connections.placeholderSet') : t('connections.placeholderNone')) : undefined}
          autoComplete={item.secret ? 'new-password' : 'off'}
          spellCheck={false}
          error={typed ? t(`connections.bad.${typed}`) : null}
        />
        <div className="flex flex-wrap gap-2 pt-5">
          <Button type="submit" variant="primary" loading={busy === 'save'} disabled={busy !== null || !canSave(item, draft)}>
            {t('connections.save')}
            <span className="sr-only">{`: ${label}`}</span>
          </Button>
          {clear && (
            <Button
              variant="secondary"
              loading={busy === 'clear'}
              disabled={busy !== null}
              onClick={() => void send(null, t(clear === 'env' ? 'connections.backToEnv' : 'connections.cleared', { label }), 'clear')}
            >
              {t(clear === 'env' ? 'connections.useEnv' : 'connections.clear')}
              <span className="sr-only">{`: ${label}`}</span>
            </Button>
          )}
        </div>
      </div>
      {failure && (
        <p role="alert" className="mt-2 text-sm break-words text-bad">
          {t('registry.failed', { message: failure })}
        </p>
      )}
    </form>
  )
}

/** An on/off setting. It saves as soon as it is flipped. Not chosen shows as On (default), because that is what the app does. */
function SwitchRow({ item, onDone }: RowProps) {
  const { t } = useTranslation('settings')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const label = t(`connections.keys.${item.key}.label`)
  const on = metricsOn(item)
  const clear = clearAction(item)

  const send = async (value: string | null, done: string) => {
    setBusy(true)
    setFailure(null)
    try {
      await api.settingsPut(updateFor(item.key, value))
      await onDone(item.key, done)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const state = item.source === 'none' ? t('connections.onDefault') : on ? t('connections.on') : t('connections.off')
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h4 className="text-sm font-medium text-ink">{label}</h4>
        <Pill tone={SOURCE_TONE[item.source]} size="sm">
          {t(`connections.source.${item.source}`)}
        </Pill>
        {item.source === 'ui' && item.envSet && <span className="text-xs text-faint">{t('connections.envToo')}</span>}
      </div>
      <p className="mt-0.5 text-xs text-muted">{t(`connections.keys.${item.key}.help`)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Toggle
          checked={on}
          disabled={busy}
          onChange={(next) => void send(String(next), t('connections.saved', { label }))}
          label={<span className="text-sm text-ink">{`${label}: ${state}`}</span>}
        />
        {clear && (
          <Button
            variant="secondary"
            loading={busy}
            disabled={busy}
            onClick={() => void send(null, t(clear === 'env' ? 'connections.backToEnv' : 'connections.cleared', { label }))}
          >
            {t(clear === 'env' ? 'connections.useEnv' : 'connections.clear')}
            <span className="sr-only">{`: ${label}`}</span>
          </Button>
        )}
      </div>
      {failure && (
        <p role="alert" className="mt-2 text-sm break-words text-bad">
          {t('registry.failed', { message: failure })}
        </p>
      )}
    </div>
  )
}

/** API keys, author and user names, and the shared issues repository. Each can come from an environment variable or be set here. */
export default function ConnectionsCard() {
  const { t } = useTranslation('settings')
  const settings = useApi(api.settings, [])
  const overview = useOverview()
  // Bumped after a save so the row starts over from what the server now says; a secret's box empties.
  const [versions, setVersions] = useState<Record<string, number>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const done = async (key: SettingKey, text: string) => {
    await Promise.all([settings.reload(), overview.reload()])
    setVersions((v) => ({ ...v, [key]: (v[key] ?? 0) + 1 }))
    setNotice(text)
  }

  const byKey = new Map((settings.data?.items ?? []).map((i) => [i.key, i]))

  return (
    <Card id="connections" title={t('connections.title')} description={t('connections.description')} className="min-w-0 scroll-mt-20">
      <div aria-live="polite" className={notice ? 'mb-4' : 'sr-only'}>
        {notice && (
          <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-ok/30 bg-ok-soft px-3 py-2 text-sm text-ink">
            <span className="min-w-0 break-words">{notice}</span>
            <span className="flex items-center gap-3">
              <Button size="sm" icon="refresh" loading={overview.polling} disabled={overview.polling} onClick={() => void overview.pollNow()}>
                {t('connections.pollNow')}
              </Button>
              <button type="button" className="cursor-pointer text-xs text-muted underline hover:text-ink" onClick={() => setNotice(null)}>
                {t('connections.dismiss')}
              </button>
            </span>
          </p>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">{t('connections.storage')}</p>
      {settings.loading && !settings.data ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !settings.data ? (
        <ErrorState compact title={t('connections.error')} error={settings.error} onRetry={() => void settings.reload()} />
      ) : (
        <div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <section key={g.id} aria-labelledby={`connections-${g.id}`} className={g.id === 'prometheus' ? 'min-w-0 lg:col-span-3' : 'min-w-0'}>
              <h3 id={`connections-${g.id}`} className="border-b border-line pb-2 text-sm font-semibold text-ink">
                {t(`connections.groups.${g.id}`)}
              </h3>
              <div className="divide-y divide-line pt-4">
                {g.keys.map((k) => {
                  const item = byKey.get(k)
                  if (!item) return null
                  const R = isSwitch(k) ? SwitchRow : Row
                  return <R key={`${k}-${versions[k] ?? 0}`} item={item} onDone={done} />
                })}
              </div>
              {g.id === 'curseforge' && <AuthorFinder onSaved={(text) => done('curseforgeAuthorId', text)} />}
              {g.id === 'github' && <p className="mt-4 rounded-md border border-line bg-sunk px-3 py-2 text-xs text-muted">{t('connections.issueModes')}</p>}
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}
