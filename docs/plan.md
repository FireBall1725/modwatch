# Plan

What exists, what's next, and the decisions that shape it.

## Done

- Poll CurseForge hourly for every mod the author is a member of, mark the ones they own, store a snapshot per mod per poll.
- JSON API, Prometheus endpoint and the React dashboard, all in one binary with one SQLite file.
- Chart in homelab-applications with a ServiceMonitor, two alerts (poll failing, polls stale), an internal-only ingress and a Longhorn volume. A debug-namespace run confirmed Prometheus scrapes it and the series are queryable.

## Decisions

**SQLite, not Postgres.** One pod, and 14 mods at one snapshot an hour is about 120,000 rows a year, which SQLite handles without noticing. See house-style, "Single-pod tools may use SQLite".

**History is built here.** The Core API returns lifetime totals and nothing older, so a snapshot per poll is the only way to get daily and weekly movement. It also means history starts the day this is deployed and can't be backfilled.

**Metrics are written by hand.** Seven series don't need a client library, and it matches Upstream.

**Owned and member mods are separate.** Applied Energistics 2 (232 million downloads) would bury the author's own 1.9 million, so the UI hides member mods by default and the metrics carry an `owned` label.

## Next

1. GitHub issues per mod: open bug count and age of the oldest bug, from the repo each CurseForge project links to. The provider sits beside `internal/providers/curseforge/`; the table is one row per repo with a snapshot per poll, like downloads.
2. Per-file download counts, so a release's uptake shows against the one before it.
3. Modrinth as a second download source. The author has 8 projects there (1,160 downloads on 2026-11-21). `GET /v2/user/{id}/projects` returns `downloads` per project; a personal access token is only needed for drafts and private projects.
4. A mod detail page with the full history chart.

## Open

- Whether `modwatch_mod_downloads_total` should also carry a `game_version` label. It would multiply the series count by the number of files; per-file counts (item 2) are the cheaper route.
- Grafana dashboard JSON, once there are a few weeks of data to design against.
