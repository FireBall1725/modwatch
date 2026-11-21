// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useEffect } from 'react'

/** Sets the tab title to "<title> · Modwatch" while the page is mounted. Pages call it with their own heading; the shell sets a default per route. */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (title) document.title = `${title} · Modwatch`
  }, [title])
}
