# Working on Modwatch

Read this before changing code. It's short on purpose.

## What this is

A self-hosted dashboard for the mods an author publishes. One Go binary (stdlib `net/http`, SQLite or Postgres through `database/sql`, raw SQL) polls CurseForge, Modrinth and GitHub on a schedule, keeps a snapshot of every download count, serves a JSON API under `/api/v1/`, exposes Prometheus metrics at `/metrics`, and serves the React UI that Vite builds into `internal/ui/dist`. `docs/plan.md` has the decisions, `docs/design.md` the pages and the registry, and `docs/api.md` the routes.

## Layout

- `cmd/modwatch/main.go` wires config, the poll service, the cron schedule and the HTTP server, nothing else.
- `internal/config/` reads env vars. Nothing defaults to a particular author.
- `internal/settings/` merges those with the values set on the Settings page, which win.
- `internal/providers/` holds one client per source: `curseforge/` (the Core API), `modrinth/` and `github/` (issues). A provider lists an author's mods or issues.
- `internal/poll/` runs one poll at a time. It asks for the author's mods twice (member of, then owner of) so each mod gets an `owned` flag, then stores the result in one transaction.
- `internal/release/` reads version text from a file name, `internal/mcver/` orders Minecraft versions, and `internal/version/` holds the build version.
- `internal/db/` opens SQLite or Postgres from `DATABASE_URL` and runs the migrations in `internal/db/migrations/postgres` or `.../sqlite` (`internal/db/dbtest` gives a test its own database); `internal/repository/` holds all the SQL; `internal/models/` the shared types.
- `internal/api/router.go` lists every route, one line each. `metrics.go` writes the Prometheus text format by hand.
- `internal/ui/` embeds `dist/`. The `.gitkeep` there lets a Go-only build compile; the Vite config writes it back after every build.
- `web/` is the React 19, TypeScript, Vite and Tailwind v4 client. Its `go.mod` exists only to keep `go build ./...` out of `node_modules`.

## Rules

- Every file that can hold a comment starts with the SPDX header and `Copyright (C) <year> FireBall1725`. The rest (JSON, Markdown, lockfiles, images, and the configs copied in from the shared scaffold) are covered by `REUSE.toml`; add new ones there.
- Comments are one sentence by default and three at most, for a real trap. Keep the fact, drop the story of how it was found. Longer rationale goes in `docs/`.
- No ORM, no router library, no web framework. SQL lives in `internal/repository/`.
- Return an empty slice, never `nil`, from anything that serialises a list. `null` crashes the client on `.length`.
- Times are `TIMESTAMPTZ`, NULL when the source gave none. Pass them through `tz()` and read nullable ones with `fromNull()` in `internal/repository`; they are UTC and trimmed to the millisecond.
- Database tests call `dbtest.Open(t)`. Without `MODWATCH_TEST_DATABASE_URL` each test gets a SQLite file; with it, a Postgres schema. Run the suite both ways before pushing, and CI does.
- Two databases: SQL goes through `internal/repository` once, written so both read it. Where they differ, ask the dialect (`internal/db/dialect.go`). Times are stored as `tz()` text. A schema change needs a migration in both `internal/db/migrations/postgres` and `.../sqlite` with the same number; a test fails if they end at different versions.
- A failed poll never blanks the dashboard. The latest successful poll is what the API and `/metrics` show.
- User-facing strings in the UI go through i18next. The English strings live in `web/src/i18n/locales/`, one file per page plus `common.json`.
- The CurseForge key is a Core API key from console.curseforge.com, sent as `x-api-key`. The tokens on the older "API Tokens" page are upload tokens and get a 403 here.
- Commits carry a DCO sign-off (`git commit -s`) and no AI attribution.

## Before opening a PR

```sh
go build ./... && go vet ./... && go test ./... && golangci-lint run
cd web && npx tsc -b && npm run lint && npm test && npm run build
```
