// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

/** Joins class names, skipping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
