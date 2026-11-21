# Modwatch

A dashboard for the mods I publish. It polls CurseForge and Modrinth once an hour, keeps every download count it sees, and shows totals, 24 hour and 7 day movement, a 30 day trend per mod, and which Minecraft versions and loaders people download for. It also serves the same numbers to Prometheus.

CurseForge's API returns lifetime totals only. Modwatch builds the history itself, so the day and week figures read "needs a day of history" until it has a snapshot that old.

## Run it

You need a Core API key from [console.curseforge.com](https://console.curseforge.com), your numeric author ID, and a Postgres database. Modwatch creates its own tables on start.

```sh
export CURSEFORGE_API_KEY=...
export CURSEFORGE_AUTHOR_ID=...
export DATABASE_URL='postgres://user:password@localhost:5432/modwatch?sslmode=disable'
go run ./cmd/modwatch
```

The database tests need a Postgres they can create schemas in. Set `MODWATCH_TEST_DATABASE_URL` to its URL and run `go test ./...`; each test gets a schema of its own and drops it. Without the variable those tests skip.

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
| `DATABASE_URL` | | Postgres connection URL. Required. On Kubernetes it is the `uri` key of the CloudNativePG `<cluster>-app` secret |
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
