// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from "vitest";
import type { ModSummary } from "../../lib/types";
import {
  averagePerDay,
  buildModRows,
  dailyRows,
  filterRows,
  isFlat,
  leader,
  parsePlatformFilter,
  parseRange,
  parseSortKey,
  parseView,
  peakDay,
  rangeGain,
  share,
  sortRows,
  topMovers,
} from "./logic";

const pt = (day: number, curseforge: number, modrinth: number) => ({
  at: `2026-11-${String(day).padStart(2, "0")}T23:59:59.000Z`,
  curseforge,
  modrinth,
});

describe("query parsing", () => {
  it("falls back to defaults", () => {
    expect(parseRange(null)).toBe(30);
    expect(parseRange("12")).toBe(30);
    expect(parseRange("365")).toBe(365);
    expect(parseView("total")).toBe("total");
    expect(parseView("x")).toBe("daily");
    expect(parsePlatformFilter("both")).toBe("both");
    expect(parsePlatformFilter("nope")).toBe("all");
    expect(parseSortKey("gain")).toBe("gain");
    expect(parseSortKey(null)).toBe("total");
  });
});

describe("dailyRows and rangeGain", () => {
  const pts = [pt(1, 100, 10), pt(2, 130, 15), pt(3, 130, 25)];
  it("differences neighbouring points and drops the first", () => {
    const rows = dailyRows(pts);
    expect(rows.map((r) => r.total)).toEqual([35, 10]);
    expect(rows[0]).toMatchObject({ curseforge: 30, modrinth: 5 });
  });
  it("clamps negative steps", () => {
    expect(dailyRows([pt(1, 100, 10), pt(2, 90, 10)])[0].total).toBe(0);
  });
  it("sums the range", () => {
    expect(rangeGain(pts)).toEqual({ curseforge: 30, modrinth: 15, total: 45 });
  });
  it("is null without two points", () => {
    expect(rangeGain([pt(1, 1, 1)])).toBeNull();
    expect(rangeGain(undefined)).toBeNull();
    expect(dailyRows([])).toEqual([]);
  });
  it("finds the peak and the average", () => {
    const rows = dailyRows(pts);
    expect(peakDay(rows)?.total).toBe(35);
    expect(averagePerDay(rows)).toBe(23);
    expect(peakDay([])).toBeNull();
    expect(averagePerDay([])).toBeNull();
  });
  it("flags a flat range", () => {
    expect(isFlat(rangeGain([pt(1, 5, 5), pt(2, 5, 5)]))).toBe(true);
    expect(isFlat(null)).toBe(false);
    expect(isFlat(rangeGain(pts))).toBe(false);
  });
});

describe("share", () => {
  it("handles zero", () => {
    expect(share(1, 4)).toBe(0.25);
    expect(share(0, 0)).toBe(0);
  });
});

const mod = (
  slug: string,
  name: string,
  cf: number | null,
  mr: number | null,
  owned = true,
) =>
  ({
    slug,
    name,
    iconUrl: "",
    owned,
    curseforge: cf === null ? null : { downloads: cf },
    modrinth: mr === null ? null : { downloads: mr },
    downloads: { total: (cf ?? 0) + (mr ?? 0) },
  }) as unknown as ModSummary;

describe("mod rows", () => {
  const mods = [
    mod("a", "Alpha", 100, 50),
    mod("b", "Beta", 500, null),
    mod("c", "Gamma", null, 70),
    mod("m", "Member", 900, null, false),
  ];
  const rows = buildModRows(mods, {
    a: [pt(1, 90, 40), pt(2, 100, 50)],
    b: [pt(1, 500, 0), pt(2, 500, 0)],
    c: [pt(1, 0, 10), pt(2, 0, 70)],
  });
  it("keeps nulls for missing platforms and gains", () => {
    expect(rows[1].modrinth).toBeNull();
    expect(rows[0].gain?.total).toBe(20);
    expect(rows[3].gain).toBeNull();
  });
  it("hides members unless asked", () => {
    expect(
      filterRows(rows, { q: "", platform: "all", members: false }).map(
        (r) => r.slug,
      ),
    ).toEqual(["a", "b", "c"]);
    expect(
      filterRows(rows, { q: "", platform: "all", members: true }),
    ).toHaveLength(4);
  });
  it("filters by platform and search", () => {
    expect(
      filterRows(rows, { q: "", platform: "both", members: false }).map(
        (r) => r.slug,
      ),
    ).toEqual(["a"]);
    expect(
      filterRows(rows, { q: "", platform: "modrinth", members: false }).map(
        (r) => r.slug,
      ),
    ).toEqual(["a", "c"]);
    expect(
      filterRows(rows, { q: " GAM ", platform: "all", members: false }).map(
        (r) => r.slug,
      ),
    ).toEqual(["c"]);
  });
  it("sorts by total, gain and name", () => {
    expect(sortRows(rows, "total").map((r) => r.slug)).toEqual([
      "m",
      "b",
      "a",
      "c",
    ]);
    expect(sortRows(rows, "gain").map((r) => r.slug)).toEqual([
      "c",
      "a",
      "b",
      "m",
    ]);
    expect(sortRows(rows, "name").map((r) => r.slug)).toEqual([
      "a",
      "b",
      "c",
      "m",
    ]);
  });
  it("lists movers that moved", () => {
    expect(topMovers(rows, 5).map((r) => r.slug)).toEqual(["c", "a"]);
    expect(topMovers(rows, 1)).toHaveLength(1);
  });
  it("names the leader", () => {
    expect(leader(rows[0])).toBe("curseforge");
    expect(leader(rows[1])).toBeNull();
  });
});
