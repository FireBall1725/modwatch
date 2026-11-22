// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { describe, expect, it } from "vitest";
import type { Catalog, CatalogEntry, SourceStatus } from "../../lib/types";
import {
  counts,
  describeCron,
  diff,
  filterEntries,
  formFrom,
  holderOf,
  nextRun,
  readParams,
  similarity,
  stillUnlinked,
  suggestEntries,
  suggestForLabel,
  summarise,
  validate,
  wouldDelete,
  writeParams,
} from "./logic";

const entry = (o: Partial<CatalogEntry>): CatalogEntry => ({
  slug: "x",
  name: "X",
  curseforgeId: null,
  modrinthId: null,
  githubLabel: null,
  githubRepo: null,
  versionRegex: null,
  hidden: false,
  legacy: false,
  auto: true,
  ...o,
});

const entries: CatalogEntry[] = [
  entry({
    slug: "ae2-tech-addon",
    name: "AE2 Tech Add-On",
    curseforgeId: 905512,
  }),
  entry({
    slug: "ae2-ee3-emc-addon",
    name: "AE2 EE3 EMC Add-On",
    curseforgeId: 1251007,
  }),
  entry({
    slug: "firecore",
    name: "FireCore",
    curseforgeId: 1,
    modrinthId: "rF4dN6pS",
    githubLabel: "firecore",
    auto: false,
  }),
  entry({ slug: "old", name: "Old", modrinthId: "abc", hidden: true }),
];

describe("query params", () => {
  it("defaults and drops unknown values", () => {
    expect(readParams(new URLSearchParams("show=nope&view=x"))).toEqual({
      view: "linked",
      show: "all",
      q: "",
      edit: null,
    });
  });
  it("round trips and omits defaults", () => {
    const next = writeParams(
      { view: "unlinked", show: "all", q: "ae2" },
      new URLSearchParams("edit=firecore"),
    );
    expect(next.toString()).toBe("edit=firecore&view=unlinked&q=ae2");
    expect(writeParams({ view: "linked", edit: null }, next).toString()).toBe(
      "q=ae2",
    );
  });
});

describe("matching", () => {
  it("treats punctuation as noise", () => {
    expect(
      similarity(
        { name: "AE2 Tech Addon", slug: "ae2-tech-addon" },
        entries[0],
      ),
    ).toBeGreaterThanOrEqual(0.95);
  });
  it("suggests only entries missing that platform", () => {
    const s = suggestEntries(
      { platform: "modrinth", name: "AE2 Tech Addon", slug: "ae2-tech-addon" },
      entries,
    );
    expect(s.map((x) => x.entry.slug)).toEqual(["ae2-tech-addon"]);
    const none = suggestEntries(
      {
        platform: "curseforge",
        name: "AE2 Tech Addon",
        slug: "ae2-tech-addon",
      },
      entries,
    );
    expect(none).toEqual([]);
  });
  it("does not suggest unrelated names", () => {
    expect(
      suggestEntries(
        { platform: "modrinth", name: "Graves", slug: "graves" },
        entries,
      ),
    ).toEqual([]);
  });
  it("matches an issue label by its words", () => {
    expect(suggestForLabel("ae2-emc", entries)[0]?.entry.slug).toBe(
      "ae2-ee3-emc-addon",
    );
    expect(suggestForLabel("firecore", entries)).toEqual([]);
    expect(suggestForLabel("zzz", entries)).toEqual([]);
  });
});

describe("filtering", () => {
  it("searches names, ids and labels", () => {
    expect(
      filterEntries(entries, { q: "rF4d", show: "all" }).map((e) => e.slug),
    ).toEqual(["firecore"]);
    expect(filterEntries(entries, { q: "905512", show: "all" })).toHaveLength(
      1,
    );
  });
  it("applies the show filter", () => {
    expect(
      filterEntries(entries, { q: "", show: "single" }).map((e) => e.slug),
    ).toEqual(["ae2-tech-addon", "ae2-ee3-emc-addon", "old"]);
    expect(
      filterEntries(entries, { q: "", show: "manual" }).map((e) => e.slug),
    ).toEqual(["firecore"]);
    expect(
      filterEntries(entries, { q: "", show: "hidden" }).map((e) => e.slug),
    ).toEqual(["old"]);
  });
  it("counts each filter", () => {
    expect(counts(entries)).toEqual({
      all: 4,
      single: 3,
      manual: 1,
      hidden: 1,
    });
  });
});

describe("stale unlinked lists", () => {
  it("drops projects an entry now holds", () => {
    const c: Catalog = {
      entries,
      unlinked: {
        projects: [
          {
            platform: "curseforge",
            id: "905512",
            slug: "a",
            name: "A",
            iconUrl: "",
            url: "",
            owned: true,
          },
          {
            platform: "curseforge",
            id: "77",
            slug: "b",
            name: "B",
            iconUrl: "",
            url: "",
            owned: false,
          },
        ],
        githubLabels: [],
      },
    };
    expect(stillUnlinked(c).map((p) => p.id)).toEqual(["77"]);
  });
});

describe("summary", () => {
  it("counts failures and what needs linking, owned projects only", () => {
    const src: SourceStatus[] = [
      { source: "a", ok: true, checkedAt: "", lastOkAt: null },
      { source: "b", ok: false, checkedAt: "", lastOkAt: null },
    ];
    const s = summarise(
      src,
      [
        {
          platform: "modrinth",
          id: "1",
          slug: "",
          name: "",
          iconUrl: "",
          url: "",
          owned: true,
        },
        {
          platform: "modrinth",
          id: "2",
          slug: "",
          name: "",
          iconUrl: "",
          url: "",
          owned: false,
        },
      ],
      [{ issues: 1 }],
    );
    expect(s.failing).toHaveLength(1);
    expect(s.toLink).toBe(2);
    expect(s.unlinkedProjects).toBe(2);
  });
});

describe("editing", () => {
  const e = entries[2];
  it("sends only changed fields", () => {
    const f = { ...formFrom(e), modrinthId: "", hidden: true };
    expect(diff(e, f)).toEqual({ modrinthId: null, hidden: true });
    expect(diff(e, formFrom(e))).toEqual({});
  });
  it("validates ids and labels", () => {
    expect(
      validate({
        ...formFrom(e),
        name: " ",
        curseforgeId: "abc",
        modrinthId: "a b",
        githubLabel: "Bad Label",
      }),
    ).toEqual({
      name: "required",
      curseforgeId: "digits",
      modrinthId: "chars",
      githubLabel: "label",
    });
    expect(validate(formFrom(e))).toEqual({});
  });
  it("finds who holds an id and whether they would be deleted", () => {
    const h = holderOf(entries, "ae2-tech-addon", "modrinth", "abc");
    expect(h?.slug).toBe("old");
    expect(wouldDelete(h!, "modrinth")).toBe(true);
    expect(wouldDelete(entries[2], "modrinth")).toBe(false);
    expect(holderOf(entries, "old", "modrinth", "abc")).toBeNull();
  });
});

describe("schedule", () => {
  it("describes simple cron", () => {
    expect(describeCron("*/30 * * * *")).toEqual({
      kind: "everyMinutes",
      n: 30,
    });
    expect(describeCron("15 * * * *")).toEqual({ kind: "hourly", minute: 15 });
    expect(describeCron("5 */6 * * *")).toEqual({
      kind: "everyHours",
      n: 6,
      minute: 5,
    });
    expect(describeCron("0 4 * * *")).toEqual({
      kind: "daily",
      hour: 4,
      minute: 0,
    });
    expect(describeCron("0 4 * * 1")).toEqual({ kind: "raw" });
    expect(describeCron("nonsense")).toEqual({ kind: "raw" });
  });
  it("finds the next run", () => {
    const from = new Date(2026, 10, 21, 13, 31, 20);
    expect(nextRun("*/30 * * * *", from)?.getMinutes()).toBe(0);
    expect(nextRun("*/30 * * * *", from)?.getHours()).toBe(14);
    expect(nextRun("0 4 * * *", from)?.getDate()).toBe(22);
    expect(nextRun("0 4 * * 1", from)).toBeNull();
  });
});
