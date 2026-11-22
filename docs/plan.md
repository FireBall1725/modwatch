# Plan

The decisions that shape Modwatch, and what is still open.

## Decisions

**SQLite or Postgres, the operator's choice.** `DATABASE_URL` picks: `postgres://` or `sqlite:`. Unset, it is a SQLite file named `modwatch.db` in the working directory. A one-author install adds a snapshot per mod per poll, which is only about 120,000 rows a year at 14 mods polled hourly, so SQLite is plenty; Postgres earns its place when you already run it and want its backups and monitoring. The repository's SQL is written to read the same on both, with `internal/db/dialect.go` for the few differences: one window query per daily history instead of Postgres's `DISTINCT ON`, `IN` lists instead of `= ANY`, and times kept in one fixed UTC text form (`tz()`) so they sort as text in SQLite and parse as `timestamptz` in Postgres. Each database has its own migrations folder with matching numbers, and SQLite starts from one baseline file at version 10. A database is not converted from one to the other.

**History is built here.** The CurseForge Core API returns lifetime totals and nothing older, so a snapshot per poll is the only way to get daily and weekly movement. History starts the day Modwatch is first run and can't be backfilled.

**Metrics are written by hand.** The series are few enough that a client library adds more than it saves, and the text format is simple.

**Owned and member mods are separate.** A mod the author is only a member of can have far more downloads than the author's own, and would bury them. The UI hides member mods by default and the metrics carry an `owned` label.

**No login.** Modwatch is meant to sit on an internal network or behind a proxy that authenticates. The write endpoints validate their input, and [SECURITY.md](../SECURITY.md) says what an unauthenticated caller can do.

**One registry entry per mod.** A mod is named differently on CurseForge, Modrinth and in its GitHub label. A registry entry joins them, auto-linking by slug or normalised name and leaving hand-made links alone. [design.md](design.md) has the details.

## Open

- Whether `modwatch_mod_downloads_total` should carry a `game_version` label. It would multiply the series count by the number of files, and `modwatch_game_version_downloads_total` already answers the question per mod and version.
- A Grafana dashboard for these series. None ships in this repository.
- Other providers. A provider lists an author's mods and files, and Modrinth already sits beside `internal/providers/curseforge/` that way.
