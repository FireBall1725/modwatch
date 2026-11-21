# Modwatch

A dashboard for the mods I publish. It polls CurseForge once an hour, keeps every download count it sees, and shows totals, 24 hour and 7 day movement, and a 30 day trend per mod. It also serves the same numbers to Prometheus.

CurseForge's API returns lifetime totals only. Modwatch builds the history itself, so the day and week figures read "needs a day of history" until it has a snapshot that old.

## Run it

You need a Core API key from [console.curseforge.com](https://console.curseforge.com) and your numeric author ID.

```sh
export CURSEFORGE_API_KEY=...
export CURSEFORGE_AUTHOR_ID=...
go run ./cmd/modwatch
```

The UI is at `http://localhost:8080`. To build the web client into the binary first, run `npm ci && npm run build` in `web/`.

| Variable | Default | |
|---|---|---|
| `CURSEFORGE_API_KEY` | | Core API key, sent as `x-api-key` |
| `CURSEFORGE_AUTHOR_ID` | | Numeric author ID |
| `CURSEFORGE_GAME_ID` | `432` | Minecraft |
| `MODWATCH_SCHEDULE` | `0 * * * *` | Cron, in the `TZ` time zone |
| `MODWATCH_ADDR` | `:8080` | |
| `MODWATCH_DATA_DIR` | `./data` | SQLite database |
| `LOG_LEVEL` | `info` | |

The older "API Tokens" page on CurseForge issues upload tokens. Those get a 403 from this API.

## Endpoints

| | |
|---|---|
| `GET /metrics` | Prometheus text format |
| `GET /healthz` | Liveness |
| `GET /api/v1/summary` | Totals, deltas, last poll, config problems |
| `GET /api/v1/mods` | Every mod with downloads and deltas |
| `GET /api/v1/history?days=30` | One snapshot per day per mod |
| `POST /api/v1/poll` | Start a poll now |

## Metrics

| Series | Type | |
|---|---|---|
| `modwatch_mod_downloads_total{id,slug,name,owned}` | counter | Lifetime downloads per mod |
| `modwatch_mods{owned}` | gauge | Mods found |
| `modwatch_last_poll_success` | gauge | 1 if the last poll worked |
| `modwatch_last_success_timestamp_seconds` | gauge | Alert when this goes stale |
| `modwatch_last_poll_timestamp_seconds`, `modwatch_last_poll_duration_seconds` | gauge | |
| `modwatch_build_info{version}` | gauge | Always 1 |

`increase(modwatch_mod_downloads_total{owned="true"}[1d])` gives downloads per day. CurseForge sometimes recounts downward; Prometheus reads that as a counter reset.

## Develop

See [AGENTS.md](./AGENTS.md) for the layout and the checks to run, and [docs/plan.md](./docs/plan.md) for what's next. Run `npm run dev` in `web/` for hot reload; it proxies `/api` to `localhost:8080`.

Questions and chat: [FireBall Codes on Discord](https://discord.gg/QpV82CFfVD).

## Licence

AGPL-3.0-only.
