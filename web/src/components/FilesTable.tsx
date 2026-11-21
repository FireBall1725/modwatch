// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileStat } from '../lib/api'
import { formatCount, formatDelta } from '../lib/format'

const TOP = 20

function Delta({ n }: { n: number | null }) {
  const colour = n === null || n === 0 ? 'text-muted' : n > 0 ? 'text-up' : 'text-down'
  return <span className={`num ${colour}`}>{formatDelta(n)}</span>
}

export default function FilesTable({ files }: { files: FileStat[] }) {
  const { t } = useTranslation()
  const [all, setAll] = useState(false)
  if (files.length === 0) return null
  const shown = all ? files : files.slice(0, TOP)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{t('files.title')}</h2>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2 font-medium">{t('files.file')}</th>
              <th className="px-4 py-2 font-medium">{t('files.minecraft')}</th>
              <th className="px-4 py-2 font-medium">{t('files.loader')}</th>
              <th className="px-4 py-2 font-medium">{t('files.type')}</th>
              <th className="px-4 py-2 font-medium">{t('files.source')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('table.downloads')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('table.day')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('table.week')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={`${f.source}:${f.id}`} className="border-b border-line last:border-0 hover:bg-sunk">
                <td className="px-4 py-2">
                  <span className="font-medium">{f.projectName}</span>
                  <span className="num ml-2 text-muted">{f.version}</span>
                </td>
                <td className="num px-4 py-2">{f.gameVersions.join(', ') || '–'}</td>
                <td className="px-4 py-2">{f.loaders.join(', ') || '–'}</td>
                <td className="px-4 py-2 text-muted">{f.releaseType}</td>
                <td className="px-4 py-2 text-muted">{t(`sources.${f.source}`, { defaultValue: f.source })}</td>
                <td className="num px-4 py-2 text-right">{formatCount(f.downloads)}</td>
                <td className="px-4 py-2 text-right"><Delta n={f.delta24h} /></td>
                <td className="px-4 py-2 text-right"><Delta n={f.delta7d} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>{t('files.hint')}</span>
        {files.length > TOP && (
          <button type="button" onClick={() => setAll(!all)} className="text-accent hover:underline">
            {all ? t('versions.showLess') : t('versions.showAll', { count: files.length })}
          </button>
        )}
      </div>
    </section>
  )
}
