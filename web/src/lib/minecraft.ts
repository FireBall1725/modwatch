// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Minecraft versions sort by number, not by text: 26.1 is newer than 1.21.11, and 1.9 is older than 1.10.

interface Parsed {
  nums: number[]
  /** A snapshot or release candidate suffix such as "-rc1" sorts below the plain release. */
  pre: string
}

function parse(v: string): Parsed {
  const [core, ...rest] = v.trim().split('-')
  const nums = core.split('.').map((s) => {
    const n = Number.parseInt(s, 10)
    return Number.isNaN(n) ? 0 : n
  })
  return { nums, pre: rest.join('-') }
}

/** Negative when a is older than b, positive when newer, 0 when equal. */
export function compareMinecraft(a: string, b: string): number {
  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.nums.length, pb.nums.length)
  for (let i = 0; i < len; i++) {
    const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0)
    if (d !== 0) return d
  }
  if (pa.pre === pb.pre) return 0
  if (pa.pre === '') return 1
  if (pb.pre === '') return -1
  return pa.pre < pb.pre ? -1 : 1
}

/** A copy sorted newest first. */
export function sortMinecraftDesc(versions: readonly string[]): string[] {
  return [...versions].sort((a, b) => compareMinecraft(b, a))
}

/** A copy sorted oldest first. */
export function sortMinecraftAsc(versions: readonly string[]): string[] {
  return [...versions].sort(compareMinecraft)
}

/** The newest of a list, or null when it is empty. */
export function newestMinecraft(versions: readonly string[]): string | null {
  return versions.length === 0 ? null : sortMinecraftDesc(versions)[0]
}

/** Sorts any records by their Minecraft version name, newest first. */
export function sortByMinecraftDesc<T>(items: readonly T[], name: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareMinecraft(name(b), name(a)))
}
