// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

/**
 * Shared cell shade for the heat grids, square-root scaled. The accent mix tops out at 55% so the light ink text stays
 * above 4.5:1 on every cell.
 */
export function heatShade(v: number, max: number): string {
  const k = max > 0 ? Math.sqrt(Math.max(0, v) / max) : 0
  return `color-mix(in srgb, var(--color-accent) ${Math.round(8 + k * 47)}%, var(--color-surface))`
}
