// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type { DownloadPoint, ModSummary } from "../../lib/types";

export const RANGES = [7, 30, 90, 365] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = 30;

export type View = "daily" | "total";
export type PlatformFilter = "all" | "both" | "curseforge" | "modrinth";
export type SortKey = "total" | "gain" | "name";

export const PLATFORM_FILTERS: PlatformFilter[] = [
  "all",
  "both",
  "curseforge",
  "modrinth",
];
export const SORT_KEYS: SortKey[] = ["total", "gain", "name"];

/** Reads the range from a query value; anything unknown falls back to 30 days. */
export function parseRange(raw: string | null): Range {
  const n = Number(raw);
  return (RANGES as readonly number[]).includes(n)
    ? (n as Range)
    : DEFAULT_RANGE;
}

export function parseView(raw: string | null): View {
  return raw === "total" ? "total" : "daily";
}

export function parsePlatformFilter(raw: string | null): PlatformFilter {
  return PLATFORM_FILTERS.includes(raw as PlatformFilter)
    ? (raw as PlatformFilter)
    : "all";
}

export function parseSortKey(raw: string | null): SortKey {
  return SORT_KEYS.includes(raw as SortKey) ? (raw as SortKey) : "total";
}

export interface Split {
  curseforge: number;
  modrinth: number;
  total: number;
}

export interface DailyRow extends Split {
  at: string;
}

/** Downloads gained on each day: the difference between neighbouring cumulative points. The first point has no predecessor and is dropped. Negative steps (a platform removing a file) clamp to 0. */
export function dailyRows(points: DownloadPoint[]): DailyRow[] {
  const rows: DailyRow[] = [];
  for (let i = 1; i < points.length; i++) {
    const cf = Math.max(0, points[i].curseforge - points[i - 1].curseforge);
    const mr = Math.max(0, points[i].modrinth - points[i - 1].modrinth);
    rows.push({
      at: points[i].at,
      curseforge: cf,
      modrinth: mr,
      total: cf + mr,
    });
  }
  return rows;
}

/** Gain from the first to the last point. Null when there are fewer than two points to compare. */
export function rangeGain(points: DownloadPoint[] | undefined): Split | null {
  if (!points || points.length < 2) return null;
  const a = points[0];
  const b = points[points.length - 1];
  const cf = b.curseforge - a.curseforge;
  const mr = b.modrinth - a.modrinth;
  return { curseforge: cf, modrinth: mr, total: cf + mr };
}

/** The day with the most downloads, or null with no days. */
export function peakDay(rows: DailyRow[]): DailyRow | null {
  let best: DailyRow | null = null;
  for (const r of rows) if (!best || r.total > best.total) best = r;
  return best;
}

/** Mean downloads per day over the rows, rounded; null with no days. */
export function averagePerDay(rows: DailyRow[]): number | null {
  if (rows.length === 0) return null;
  return Math.round(rows.reduce((a, r) => a + r.total, 0) / rows.length);
}

/** Share of a platform in a split, 0 to 1. A zero total gives 0. */
export function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

export interface ModRow {
  slug: string;
  name: string;
  iconUrl: string;
  owned: boolean;
  /** Null when the mod is not on that platform. */
  curseforge: number | null;
  modrinth: number | null;
  total: number;
  /** Null when there is no history to compare in this range. */
  gain: Split | null;
}

/** One comparison row per mod, joining the mod list with its history. */
export function buildModRows(
  mods: ModSummary[],
  perMod: Record<string, DownloadPoint[]>,
): ModRow[] {
  return mods.map((m) => ({
    slug: m.slug,
    name: m.name,
    iconUrl: m.iconUrl,
    owned: m.owned,
    curseforge: m.curseforge ? m.curseforge.downloads : null,
    modrinth: m.modrinth ? m.modrinth.downloads : null,
    total: m.downloads.total,
    gain: rangeGain(perMod[m.slug]),
  }));
}

export interface RowFilter {
  q: string;
  platform: PlatformFilter;
  members: boolean;
}

/** Search by name or slug, narrow by platform presence, and hide member mods unless asked. */
export function filterRows(rows: ModRow[], f: RowFilter): ModRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (!f.members && !r.owned) return false;
    if (
      q &&
      !r.name.toLowerCase().includes(q) &&
      !r.slug.toLowerCase().includes(q)
    )
      return false;
    if (f.platform === "both")
      return r.curseforge !== null && r.modrinth !== null;
    if (f.platform === "curseforge") return r.curseforge !== null;
    if (f.platform === "modrinth") return r.modrinth !== null;
    return true;
  });
}

/** Sorts a copy: biggest first for the numbers, A to Z for the name; mods with no gain figure go last. */
export function sortRows(rows: ModRow[], key: SortKey): ModRow[] {
  const out = [...rows];
  out.sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "gain") {
      const ga = a.gain?.total ?? -Infinity;
      const gb = b.gain?.total ?? -Infinity;
      return gb - ga || b.total - a.total;
    }
    return b.total - a.total || a.name.localeCompare(b.name);
  });
  return out;
}

/** Mods that gained downloads in the range, biggest gain first. */
export function topMovers(rows: ModRow[], n: number): ModRow[] {
  return rows
    .filter((r) => (r.gain?.total ?? 0) > 0)
    .sort((a, b) => (b.gain?.total ?? 0) - (a.gain?.total ?? 0))
    .slice(0, n);
}

/** Which side has more downloads for a mod on both platforms; null when it is on one or tied. */
export function leader(row: ModRow): "curseforge" | "modrinth" | null {
  if (
    row.curseforge === null ||
    row.modrinth === null ||
    row.curseforge === row.modrinth
  )
    return null;
  return row.curseforge > row.modrinth ? "curseforge" : "modrinth";
}

/** True when history spans at least two points and nothing moved: worth a second look at the poller. */
export function isFlat(gain: Split | null): boolean {
  return gain !== null && gain.total === 0;
}
