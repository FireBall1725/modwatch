// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import type {
  CatalogEntry,
  CatalogUpdate,
  Catalog,
  Platform,
  SourceStatus,
  UnlinkedProject,
} from "../../lib/types";

export type View = "linked" | "unlinked";
export type Show = "all" | "single" | "manual" | "hidden";

export interface Params {
  view: View;
  show: Show;
  q: string;
  edit: string | null;
}

export const SHOWS: Show[] = ["all", "single", "manual", "hidden"];

/** Reads the page's query string; anything unknown falls back to the default. */
export function readParams(sp: URLSearchParams): Params {
  const view = sp.get("view") === "unlinked" ? "unlinked" : "linked";
  const s = sp.get("show") as Show | null;
  return {
    view,
    show: s && SHOWS.includes(s) ? s : "all",
    q: sp.get("q") ?? "",
    edit: sp.get("edit") || null,
  };
}

/** Writes params back, leaving defaults out so a clean URL means the default view. */
export function writeParams(
  p: Partial<Params>,
  base: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(base);
  const set = (key: string, value: string | null, dflt: string | null) => {
    if (value === null || value === dflt || value === "") next.delete(key);
    else next.set(key, value);
  };
  if ("view" in p) set("view", p.view ?? null, "linked");
  if ("show" in p) set("show", p.show ?? null, "all");
  if ("q" in p) set("q", p.q ?? null, "");
  if ("edit" in p) set("edit", p.edit ?? null, null);
  return next;
}

/** Lower case letters and digits only, so "AE2 Tech Add-On" and "ae2-tech-addon" compare equal. */
export function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** 0 to 1: how likely a name or slug and an entry are the same thing. */
export function similarity(
  a: { name: string; slug: string },
  b: { name: string; slug: string },
): number {
  if (a.slug.toLowerCase() === b.slug.toLowerCase()) return 1;
  const na = normalise(a.name);
  const nb = normalise(b.name);
  if (na && na === nb) return 0.95;
  if (normalise(a.slug) === normalise(b.slug)) return 0.95;
  const ta = new Set([...tokens(a.name), ...tokens(a.slug)]);
  const tb = new Set([...tokens(b.name), ...tokens(b.slug)]);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const x of ta) if (tb.has(x)) shared++;
  const jaccard = shared / (ta.size + tb.size - shared);
  const contained = shared / Math.min(ta.size, tb.size);
  return Math.max(jaccard, contained === 1 && shared >= 2 ? 0.7 : 0);
}

export const SUGGEST_THRESHOLD = 0.6;

export interface Suggestion {
  entry: CatalogEntry;
  score: number;
}

/** Does the entry already point at a project on this platform? */
export function hasPlatform(e: CatalogEntry, platform: Platform): boolean {
  return (platform === "curseforge" ? e.curseforgeId : e.modrinthId) !== null;
}

/** Entries that lack a link on the project's platform, best match first; empty when nothing is close. */
export function suggestEntries(
  project: Pick<UnlinkedProject, "platform" | "name" | "slug">,
  entries: CatalogEntry[],
): Suggestion[] {
  return entries
    .filter((e) => !hasPlatform(e, project.platform))
    .map((entry) => ({ entry, score: similarity(project, entry) }))
    .filter((s) => s.score >= SUGGEST_THRESHOLD)
    .sort(
      (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name),
    );
}

/** The entry an unclaimed issue label most likely belongs to, among entries with no label of their own. */
export function suggestForLabel(
  label: string,
  entries: CatalogEntry[],
): Suggestion[] {
  const lt = tokens(label);
  if (lt.length === 0) return [];
  return entries
    .filter((e) => !e.githubLabel)
    .map((entry) => {
      const et = new Set([...tokens(entry.slug), ...tokens(entry.name)]);
      const shared = lt.filter((x) => et.has(x)).length;
      const score = shared / lt.length;
      return {
        entry,
        score:
          lt.length >= 2 || normalise(label) === normalise(entry.slug)
            ? score
            : score * 0.5,
      };
    })
    .filter((s) => s.score >= SUGGEST_THRESHOLD)
    .sort(
      (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name),
    );
}

/** Projects no entry holds. The server drops a project from its unlinked list once linked; this keeps a stale response honest. */
export function stillUnlinked(catalog: Catalog): UnlinkedProject[] {
  const cf = new Set(
    catalog.entries
      .map((e) => e.curseforgeId)
      .filter((x): x is number => x !== null),
  );
  const mr = new Set(
    catalog.entries
      .map((e) => e.modrinthId)
      .filter((x): x is string => x !== null),
  );
  return catalog.unlinked.projects.filter((p) =>
    p.platform === "curseforge" ? !cf.has(Number(p.id)) : !mr.has(p.id),
  );
}

export function stillUnclaimedLabels(
  catalog: Catalog,
): Catalog["unlinked"]["githubLabels"] {
  const claimed = new Set(
    catalog.entries.map((e) => e.githubLabel).filter(Boolean),
  );
  return catalog.unlinked.githubLabels.filter((l) => !claimed.has(l.label));
}

export function linkCount(e: CatalogEntry): number {
  return (e.curseforgeId !== null ? 1 : 0) + (e.modrinthId !== null ? 1 : 0);
}

/** On one platform only: usually a mismatch worth merging. */
export function isSingle(e: CatalogEntry): boolean {
  return linkCount(e) === 1;
}

export function filterEntries(
  entries: CatalogEntry[],
  p: Pick<Params, "q" | "show">,
): CatalogEntry[] {
  const q = p.q.trim().toLowerCase();
  return entries.filter((e) => {
    if (p.show === "single" && !isSingle(e)) return false;
    if (p.show === "manual" && e.auto) return false;
    if (p.show === "hidden" && !e.hidden) return false;
    if (!q) return true;
    return [
      e.name,
      e.slug,
      e.githubLabel ?? "",
      e.githubRepo ?? "",
      String(e.curseforgeId ?? ""),
      e.modrinthId ?? "",
    ].some((v) => v.toLowerCase().includes(q));
  });
}

export function counts(entries: CatalogEntry[]): Record<Show, number> {
  return {
    all: entries.length,
    single: entries.filter(isSingle).length,
    manual: entries.filter((e) => !e.auto).length,
    hidden: entries.filter((e) => e.hidden).length,
  };
}

export interface Summary {
  failing: SourceStatus[];
  sources: number;
  unlinkedProjects: number;
  unlinkedOwned: number;
  unclaimedLabels: number;
  toLink: number;
}

export function summarise(
  sources: SourceStatus[],
  projects: UnlinkedProject[],
  labels: { issues: number }[],
): Summary {
  return {
    failing: sources.filter((s) => !s.ok),
    sources: sources.length,
    unlinkedProjects: projects.length,
    unlinkedOwned: projects.filter((p) => p.owned).length,
    unclaimedLabels: labels.length,
    toLink: projects.filter((p) => p.owned).length + labels.length,
  };
}

// ---- Editing ----------------------------------------------------------------------------------

export interface Form {
  name: string;
  curseforgeId: string;
  modrinthId: string;
  githubLabel: string;
  /** This mod's own issues repository, owner/name. */
  githubRepo: string;
  /** This mod's own pattern for reading its file versions. Empty means the default reading. */
  versionRegex: string;
  hidden: boolean;
}

/** A version pattern as the server takes it: a valid expression with a group named version. Go's (?P<name>) is accepted. */
export function isVersionPattern(s: string): boolean {
  const p = s.trim();
  if (!p.includes("(?P<version>") && !p.includes("(?<version>")) return false;
  try {
    new RegExp(p.replace(/\(\?P</g, "(?<"));
    return true;
  } catch {
    return false;
  }
}

/** owner/name as GitHub allows it: letters, digits, dots, dashes and underscores on both sides. */
export function isRepo(s: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s.trim());
}

export function formFrom(e: CatalogEntry): Form {
  return {
    name: e.name,
    curseforgeId: e.curseforgeId === null ? "" : String(e.curseforgeId),
    modrinthId: e.modrinthId ?? "",
    githubLabel: e.githubLabel ?? "",
    githubRepo: e.githubRepo ?? "",
    versionRegex: e.versionRegex ?? "",
    hidden: e.hidden,
  };
}

export type FormErrors = Partial<
  Record<
    "name" | "curseforgeId" | "modrinthId" | "githubLabel" | "githubRepo" | "versionRegex",
    "required" | "digits" | "chars" | "label" | "repo" | "pattern"
  >
>;

export function validate(f: Form): FormErrors {
  const errors: FormErrors = {};
  if (f.name.trim() === "") errors.name = "required";
  if (
    f.curseforgeId.trim() !== "" &&
    !/^[1-9]\d{0,9}$/.test(f.curseforgeId.trim())
  )
    errors.curseforgeId = "digits";
  if (
    f.modrinthId.trim() !== "" &&
    !/^[A-Za-z0-9]{1,32}$/.test(f.modrinthId.trim())
  )
    errors.modrinthId = "chars";
  if (
    f.githubLabel.trim() !== "" &&
    !/^[a-z0-9][a-z0-9-]*$/.test(f.githubLabel.trim())
  )
    errors.githubLabel = "label";
  if (f.githubRepo.trim() !== "" && !isRepo(f.githubRepo))
    errors.githubRepo = "repo";
  if (f.versionRegex.trim() !== "" && !isVersionPattern(f.versionRegex))
    errors.versionRegex = "pattern";
  return errors;
}

/** Only the fields that changed, so a PUT never overwrites something another tab edited. Null clears a link. */
export function diff(entry: CatalogEntry, f: Form): CatalogUpdate {
  const out: CatalogUpdate = {};
  const cf =
    f.curseforgeId.trim() === "" ? null : Number(f.curseforgeId.trim());
  const mr = f.modrinthId.trim() === "" ? null : f.modrinthId.trim();
  const label = f.githubLabel.trim() === "" ? null : f.githubLabel.trim();
  if (f.name.trim() !== entry.name) out.name = f.name.trim();
  if (cf !== entry.curseforgeId) out.curseforgeId = cf;
  if (mr !== entry.modrinthId) out.modrinthId = mr;
  if (label !== entry.githubLabel) out.githubLabel = label;
  const repo = f.githubRepo.trim() === "" ? null : f.githubRepo.trim();
  if (repo !== entry.githubRepo) out.githubRepo = repo;
  const pattern = f.versionRegex.trim() === "" ? null : f.versionRegex.trim();
  if (pattern !== (entry.versionRegex ?? null)) out.versionRegex = pattern;
  if (f.hidden !== entry.hidden) out.hidden = f.hidden;
  return out;
}

/** Another entry that holds the id typed in the form, which the save would take it from. */
export function holderOf(
  entries: CatalogEntry[],
  self: string,
  platform: Platform,
  raw: string,
): CatalogEntry | null {
  const v = raw.trim();
  if (v === "") return null;
  return (
    entries.find(
      (e) =>
        e.slug !== self &&
        (platform === "curseforge"
          ? String(e.curseforgeId) === v
          : e.modrinthId === v),
    ) ?? null
  );
}

/** Would saving leave the other entry with nothing, so the server deletes it? */
export function wouldDelete(other: CatalogEntry, lost: Platform): boolean {
  return linkCount(other) === 1 && hasPlatform(other, lost);
}

// ---- Schedule ---------------------------------------------------------------------------------

export type CronDescription =
  | { kind: "everyMinutes"; n: number }
  | { kind: "everyHours"; n: number; minute: number }
  | { kind: "hourly"; minute: number }
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "raw" };

const num = (s: string): number | null =>
  /^\d{1,2}$/.test(s) ? Number(s) : null;

/** Reads the simple five-field schedules the chart uses; anything else is shown raw. */
export function describeCron(expr: string): CronDescription {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5 || f.slice(2).some((x) => x !== "*"))
    return { kind: "raw" };
  const [min, hour] = f;
  const step = (s: string) => /^\*\/(\d{1,2})$/.exec(s)?.[1];
  if (hour === "*") {
    if (min === "*") return { kind: "everyMinutes", n: 1 };
    const s = step(min);
    if (s && Number(s) > 0) return { kind: "everyMinutes", n: Number(s) };
    const m = num(min);
    if (m !== null && m < 60) return { kind: "hourly", minute: m };
    return { kind: "raw" };
  }
  const m = num(min);
  if (m === null || m > 59) return { kind: "raw" };
  const hs = step(hour);
  if (hs && Number(hs) > 0)
    return { kind: "everyHours", n: Number(hs), minute: m };
  const h = num(hour);
  if (h !== null && h < 24) return { kind: "daily", hour: h, minute: m };
  return { kind: "raw" };
}

/** The next run after `from` for the schedules describeCron understands, in local time; null for anything else. */
export function nextRun(expr: string, from: Date = new Date()): Date | null {
  const d = describeCron(expr);
  const t = new Date(from);
  t.setSeconds(0, 0);
  const next = (ok: (x: Date) => boolean): Date => {
    const c = new Date(t);
    c.setMinutes(c.getMinutes() + 1);
    for (let i = 0; i < 60 * 24 * 2; i++) {
      if (ok(c)) return c;
      c.setMinutes(c.getMinutes() + 1);
    }
    return c;
  };
  switch (d.kind) {
    case "everyMinutes":
      return next((c) => c.getMinutes() % d.n === 0);
    case "hourly":
      return next((c) => c.getMinutes() === d.minute);
    case "everyHours":
      return next(
        (c) => c.getMinutes() === d.minute && c.getHours() % d.n === 0,
      );
    case "daily":
      return next(
        (c) => c.getMinutes() === d.minute && c.getHours() === d.hour,
      );
    default:
      return null;
  }
}

/** Seconds a finished poll took. */
export function pollSeconds(startedAt: string, finishedAt: string): number {
  return Math.max(
    0,
    Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000),
  );
}
