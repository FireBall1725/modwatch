# Working on Modwatch

Read this before changing code. It's short on purpose.

## What this is

A self-hosted dashboard for the mods FireBall1725 publishes. One Go binary (stdlib `net/http`, SQLite through `modernc.org/sqlite`, raw SQL) polls CurseForge on a schedule, keeps a snapshot of every download count, serves a JSON API under `/api/v1/`, exposes Prometheus metrics at `/metrics`, and serves the React UI that Vite builds into `internal/ui/dist`. The build order is in `docs/plan.md`.

## Layout

- `cmd/modwatch/main.go` wires config, the poll service, the cron schedule and the HTTP server, nothing else.
- `internal/config/` reads env vars. Nothing defaults to a particular author; our values live in the chart in homelab-applications.
- `internal/providers/curseforge/` is the Core API client. A provider lists an author's mods; GitHub and Modrinth would be siblings.
- `internal/poll/` runs one poll at a time. It asks for the author's mods twice (member of, then owner of) so each mod gets an `owned` flag, then stores the result in one transaction.
- `internal/db/` opens SQLite and runs the migrations in `internal/db/migrations/`; `internal/repository/` holds all the SQL; `internal/models/` the shared types.
- `internal/api/router.go` lists every route, one line each. `metrics.go` writes the Prometheus text format by hand.
- `internal/ui/` embeds `dist/`. The `.gitkeep` there lets a Go-only build compile; the Vite config writes it back after every build.
- `web/` is the React 19, TypeScript, Vite and Tailwind v4 client. Its `go.mod` exists only to keep `go build ./...` out of `node_modules`.

## Rules

- Every source file starts with the SPDX header and `Copyright (C) <year> FireBall1725`.
- No ORM, no router library, no web framework. SQL lives in `internal/repository/`.
- Return an empty slice, never `nil`, from anything that serializes a list. `null` crashes the client on `.length`.
- Stored times are UTC in a fixed-width format (`2006-01-02T15:04:05.000Z`) so SQLite can compare them as text. Don't use `RFC3339Nano`; it trims trailing zeros and breaks the ordering.
- A failed poll never blanks the dashboard. The latest successful poll is what the API and `/metrics` show.
- User-facing strings in the UI go through i18next (`web/src/i18n/locales/en.json`).
- The CurseForge key is a Core API key from console.curseforge.com, sent as `x-api-key`. The tokens on the older "API Tokens" page are upload tokens and get a 403 here.
- Commits carry a DCO sign-off (`git commit -s`) and no AI attribution.

## Before opening a PR

```sh
go build ./... && go vet ./... && go test ./... && golangci-lint run
cd web && npx tsc -b && npm run lint && npm test && npm run build
```
