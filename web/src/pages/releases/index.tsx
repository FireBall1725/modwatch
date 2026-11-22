// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/ui/PageHeader'
import { api } from '../../lib/api'
import { useApi } from '../../hooks/useApi'
import Board from './Board'
import Since from './Since'
import Timeline from './Timeline'
import Verdict from './Verdict'
import { buildBoard, countGroups, filterBoard, parseState, serializeState, sinceLastRelease, type PageState } from './logic'

export default function ReleasesPage() {
  const { t } = useTranslation('releases')
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseState(params), [params])
  const onChange = useCallback(
    (patch: Partial<PageState>) => setParams((prev) => serializeState({ ...parseState(prev), ...patch }), { replace: true }),
    [setParams],
  )

  const mods = useApi(() => api.mods(), [])
  const releases = useApi(() => api.releases(100), [])

  const all = mods.data
  const board = useMemo(() => (all ? buildBoard(all) : null), [all])
  const owned = useMemo(() => (board ? board.filter((r) => r.owned) : null), [board])
  const counts = useMemo(() => (owned ? countGroups(owned) : null), [owned])
  const slow = useMemo(() => (owned ? owned.filter((r) => r.slow).length : 0), [owned])
  const visible = useMemo(
    () => (board ? filterBoard(board, { platform: state.platform, q: state.q, showApproved: state.approved, showMembers: state.members }) : null),
    [board, state.platform, state.q, state.approved, state.members],
  )
  const hiddenApproved = useMemo(
    () => (board && visible && !state.approved ? filterBoard(board, { platform: state.platform, q: state.q, showApproved: true, showMembers: state.members }).length - visible.length : 0),
    [board, visible, state.platform, state.q, state.approved, state.members],
  )
  const since = useMemo(() => (all && releases.data ? sinceLastRelease(all, releases.data) : null), [all, releases.data])
  const ownedSlugs = useMemo(() => (all ? new Set(all.filter((m) => m.owned).map((m) => m.slug)) : null), [all])
  const modOptions = useMemo(() => (all ?? []).filter((m) => state.members || m.owned).map((m) => ({ slug: m.slug, name: m.name })), [all, state.members])

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      {mods.error && !all ? null : <Verdict counts={counts} slow={slow} />}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Board rows={visible} total={board?.length ?? 0} hiddenApproved={hiddenApproved} error={mods.error} state={state} onChange={onChange} onRetry={() => void mods.reload()} />
        </div>
        <Since rows={since} error={mods.error ?? releases.error} onRetry={() => void Promise.all([mods.reload(), releases.reload()])} />
      </div>
      <Timeline
        items={releases.data}
        ownedSlugs={ownedSlugs}
        mods={modOptions}
        error={releases.error}
        state={state}
        onChange={onChange}
        onRetry={() => void releases.reload()}
      />
    </>
  )
}
