# Plan

What exists, what's next, and the decisions that shape it.

## Done

- Poll CurseForge hourly for every mod the author is a member of, mark the ones they own, store a snapshot per mod per poll.
- JSON API, Prometheus endpoint and the React dashboard, all in one binary with one SQLite file.
- Per-file downloads from CurseForge (owned mods) and Modrinth, with the Minecraft versions and loaders each file targets, and roll-ups by version and loader. CurseForge's per-file counts don't sum to the mod total.
- Chart in homelab-applications with a ServiceMonitor, two alerts (poll failing, polls stale), an internal-only ingress and a Longhorn volume. A debug-namespace run confirmed Prometheus scrapes it and the series are queryable.

## Decisions

**SQLite, not Postgres.** One pod, and 14 mods at one snapshot an hour is about 120,000 rows a year, which SQLite handles without noticing. See house-style, "Single-pod tools may use SQLite".

**History is built here.** The Core API returns lifetime totals and nothing older, so a snapshot per poll is the only way to get daily and weekly movement. It also means history starts the day this is deployed and can't be backfilled.

**Metrics are written by hand.** Seven series don't need a client library, and it matches Upstream.

**Owned and member mods are separate.** Applied Energistics 2 (232 million downloads) would bury the author's own 1.9 million, so the UI hides member mods by default and the metrics carry an `owned` label.

## Next

1. GitHub issues from `FireBall1725/mod-issues`, the one repo that holds issues for every mod: open bug count and age of the oldest bug per mod. The open question is how an issue maps to a mod (a label per mod, most likely). The provider sits beside `internal/providers/curseforge/`; the table is one row per issue with a snapshot per poll, like downloads.
2. Modrinth projects as first-class mods next to the CurseForge ones, matched by name or slug. Today Modrinth is tracked per version only. The author has 8 projects there (1,160 downloads on 2026-11-21). `GET /v2/user/{id}/projects` returns `downloads` per project; a personal access token is only needed for drafts and private projects.
3. A mod detail page with the full history chart.

## Open

- Whether `modwatch_mod_downloads_total` should also carry a `game_version` label. It would multiply the series count by the number of files; per-file counts (done) are the cheaper route.
- Grafana dashboard JSON, once there are a few weeks of data to design against.
