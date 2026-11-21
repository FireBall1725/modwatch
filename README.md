# Modwatch

A dashboard for the mods I publish. It polls CurseForge and Modrinth once an hour, keeps every download count it sees, and shows totals, 24 hour and 7 day movement, a 30 day trend per mod, and which Minecraft versions and loaders people download for. It also serves the same numbers to Prometheus.

CurseForge's API returns lifetime totals only. Modwatch builds the history itself, so the day and week figures read "needs a day of history" until it has a snapshot that old.

## Run it

You need a Core API key from [console.curseforge.com](https://console.curseforge.com), your numeric author ID, and a database. Modwatch runs on SQLite with nothing to set up, or on Postgres. It creates its own tables on start.

```sh
export CURSEFORGE_API_KEY=...
export CURSEFORGE_AUTHOR_ID=...
go run ./cmd/modwatch
```

That keeps its data in a SQLite file, `modwatch.db`, in the working directory. To use Postgres, or to put the file somewhere else, set `DATABASE_URL`:

```sh
export DATABASE_URL='postgres://user:password@localhost:5432/modwatch?sslmode=disable'   # Postgres
export DATABASE_URL='sqlite:///var/lib/modwatch/modwatch.db'                            # SQLite, absolute path
```

SQLite is plenty for one author's mods: a poll an hour adds a few hundred rows. Use Postgres when you already run it and want its backups and monitoring, as on Kubernetes with CloudNativePG. The two are not converted into each other, so pick one before the history builds up.

`go test ./...` runs the database tests on SQLite, each in a file of its own. To run them on Postgres, set `MODWATCH_TEST_DATABASE_URL` to a database they can create schemas in; each test gets a schema and drops it. CI runs both.

The UI is at `http://localhost:8080`. To build the web client into the binary first, run `npm ci && npm run build` in `web/`.

| Variable | Default | |
|---|---|---|
| `CURSEFORGE_API_KEY` | | Core API key, sent as `x-api-key` |
| `CURSEFORGE_AUTHOR_ID` | | Numeric author ID |
| `CURSEFORGE_GAME_ID` | `432` | Minecraft |
| `MODRINTH_USER` | | Modrinth username or id. Empty turns Modrinth off |
| `MODRINTH_TOKEN` | | Optional. Public projects need none; it matters for drafts and private projects |
| `GITHUB_ISSUES_REPO` | | `owner/name` of one repository that holds the issues for every mod, linked by `mod: <label>` labels. A mod can have its own repository instead, set in Settings. Empty turns shared issues off |
| `GITHUB_TOKEN` | | Optional. Raises GitHub's 60 requests an hour, and reads private repositories |
| `MODWATCH_METRICS_ENABLED` | on | `false` turns `/metrics` off (it answers 404) |
| `MODWATCH_SCHEDULE` | `0 * * * *` | Cron, in the `TZ` time zone |
| `MODWATCH_ADDR` | `:8080` | |
| `DATABASE_URL` | `sqlite:modwatch.db` | `postgres://...` for Postgres, or `sqlite:` and a file for SQLite (`sqlite:///data/modwatch.db` is absolute). The container image sets `sqlite:///data/modwatch.db` and a `/data` volume. On Kubernetes with CloudNativePG it is the `uri` key of the `<cluster>-app` secret |
| `LOG_LEVEL` | `info` | |

Every key and repository above can also be set in the Settings page, which wins over the environment variable and takes effect on the next poll. Values set there are stored in the database in plain text.

The older "API Tokens" page on CurseForge issues upload tokens. Those get a 403 from this API.

## Endpoints

| | |
|---|---|
| `GET /metrics` | Prometheus text format |
| `GET /healthz` | Liveness |
| `GET /api/v1/summary` | Totals, deltas, last poll, config problems |
| `GET /api/v1/mods` | Every mod with downloads and deltas |
| `GET /api/v1/files` | Every file or version with downloads and deltas |
| `GET /api/v1/versions` | Downloads by Minecraft version and by loader |
| `GET /api/v1/history?days=30` | One snapshot per day per mod |
| `POST /api/v1/poll` | Start a poll now |

## Metrics

| Series | Type | |
|---|---|---|
| `modwatch_mod_downloads_total{id,slug,name,owned}` | counter | Lifetime downloads per mod |
| `modwatch_file_downloads_total{source,slug,name,version,release_type,game_versions,loaders}` | counter | Downloads of one file or version |
| `modwatch_game_version_downloads_total{source,slug,name,game_version}` | counter | File downloads per mod and Minecraft version |
| `modwatch_loader_downloads_total{source,slug,name,loader}` | counter | File downloads per mod and loader |
| `modwatch_source_up{source}` | gauge | 1 if CurseForge or Modrinth was read without error |
| `modwatch_mods{owned}` | gauge | Mods found |
| `modwatch_last_poll_success` | gauge | 1 if the last poll worked |
| `modwatch_last_success_timestamp_seconds` | gauge | Alert when this goes stale |
| `modwatch_last_poll_timestamp_seconds`, `modwatch_last_poll_duration_seconds` | gauge | |
| `modwatch_build_info{version}` | gauge | Always 1 |

`increase(modwatch_mod_downloads_total{owned="true"}[1d])` gives downloads per day. CurseForge sometimes recounts downward; Prometheus reads that as a counter reset.

A file that targets several Minecraft versions counts toward each in the version and loader series, so don't sum those across versions. CurseForge's per-file counts also don't add up to a mod's total; Turbolifts' three files sum to 35 against 8,505 on the mod. Modrinth's do add up.

## Develop

See [AGENTS.md](./AGENTS.md) for the layout and the checks to run, and [docs/plan.md](./docs/plan.md) for what's next. Run `npm run dev` in `web/` for hot reload; it proxies `/api` to `localhost:8080`.

Questions and chat: [FireBall Codes on Discord](https://discord.gg/QpV82CFfVD).

## Licence

AGPL-3.0-only.
