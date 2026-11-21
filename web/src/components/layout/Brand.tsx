// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

/** The Modwatch mark and name. */
export default function Brand({ showName = true }: { showName?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="8" fill="var(--color-accent-soft)" />
        <path d="M6 21.5l6-8 5 5 9-11" fill="none" stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showName && <span className="text-lg font-semibold tracking-tight text-ink">Modwatch</span>}
    </span>
  )
}
