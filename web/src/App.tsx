// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FilesTable from './components/FilesTable'
import ModsTable from './components/ModsTable'
import Summary from './components/Summary'
import TopBar from './components/TopBar'
import VersionsPanel from './components/VersionsPanel'
import { useDashboard } from './hooks/useDashboard'

export default function App() {
  const { t } = useTranslation()
  const { summary, mods, history, files, versions, error, loading, poll } = useDashboard()
  // Mods the author is only a member of (Applied Energistics 2 and the like) would drown their own numbers.
  const [includeMember, setIncludeMember] = useState(false)
  const shown = useMemo(() => (includeMember ? mods : mods.filter((m) => m.owned)), [mods, includeMember])

  return (
    <div className="min-h-screen">
      <TopBar summary={summary} onPoll={() => void poll()} />
      <main className="flex flex-col gap-5 px-4 py-5 sm:px-6">
        {error && (
          <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn" role="alert">
            {t('error.load', { error })}
          </p>
        )}
        {summary && summary.problems.length > 0 && (
          <section className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn" role="alert">
            <p className="font-medium">{t('problems.title')}</p>
            <ul className="mt-1 list-disc pl-5">
              {summary.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        )}
        {summary?.sources
          .filter((src) => !src.ok)
          .map((src) => (
            <p key={src.source} className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn" role="alert">
              {t('sources.failed', { source: t(`sources.${src.source}`, { defaultValue: src.source }), error: src.error })}
            </p>
          ))}
        {summary && <Summary totals={includeMember ? summary.all : summary.owned} />}
        <label className="flex w-fit items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={includeMember}
            onChange={(e) => setIncludeMember(e.target.checked)}
            className="accent-accent"
          />
          {t('table.includeMember')}
        </label>
        {!loading && <ModsTable mods={shown} history={history} />}
        {!loading && <VersionsPanel gameVersions={versions.gameVersions} loaders={versions.loaders} />}
        {!loading && <FilesTable files={files} />}
      </main>
    </div>
  )
}
