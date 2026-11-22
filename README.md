# Modwatch

A self-hosted dashboard for the Minecraft mods you publish. It polls CurseForge and Modrinth once an hour, keeps every download count it sees, and shows totals, 24 hour and 7 day movement, a trend per mod, review status on both platforms, open GitHub issues, and which Minecraft versions and loaders people download for. It serves the same numbers to Prometheus.

![The Overview page](docs/screenshots/01-overview.png)

CurseForge's API returns lifetime totals only. Modwatch builds the history itself, so the day and week figures read "needs a day of history" until it has a snapshot that old.

## Run it

You need a Core API key from [console.curseforge.com](https://console.curseforge.com), your numeric CurseForge author ID, and a database. Modwatch runs on SQLite with nothing to set up, or on Postgres. It creates its own tables on start.

```sh
docker run -d --name modwatch -p 8080:8080 -v modwatch:/data \
  -e CURSEFORGE_API_KEY=... -e CURSEFORGE_AUTHOR_ID=... \
  ghcr.io/fireball1725/modwatch:latest
```

The UI is at `http://localhost:8080`. [`examples/`](examples) has Compose files for SQLite and for Postgres, and Kubernetes manifests that use a CloudNativePG cluster.

To run from source instead, build the web client into the binary first with `npm ci && npm run build` in `web/`, then:

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

There is no login. Keep Modwatch on an internal network or behind a proxy that authenticates, and read [SECURITY.md](SECURITY.md) first.

## Configuration

| Variable | Default | |
|---|---|---|
| `CURSEFORGE_API_KEY` | | Core API key, sent as `x-api-key` |
| `CURSEFORGE_AUTHOR_ID` | | Numeric author ID |
| `CURSEFORGE_GAME_ID` | `432` | Minecraft |
| `MODRINTH_USER` | | Modrinth username or id. Empty turns Modrinth off |
| `MODRINTH_TOKEN` | | Optional. Public projects need none; it matters for drafts, projects in review and the payout balance |
| `GITHUB_ISSUES_REPO` | | `owner/name` of one repository that holds the issues for every mod, linked by `mod: <label>` labels. A mod can have its own repository instead, set in Settings. Empty turns shared issues off |
| `GITHUB_TOKEN` | | Optional. Raises GitHub's 60 requests an hour, and reads private repositories |
| `MODWATCH_METRICS_ENABLED` | on | `false` turns `/metrics` off (it answers 404) |
| `MODWATCH_REVENUE_ENABLED` | on | `false` stops Modwatch reading your Modrinth balance |
| `MODWATCH_SCHEDULE` | `0 * * * *` | Cron, in the `TZ` time zone |
| `MODWATCH_ADDR` | `:8080` | |
| `DATABASE_URL` | `sqlite:modwatch.db` | `postgres://...` for Postgres, or `sqlite:` and a file for SQLite (`sqlite:///data/modwatch.db` is absolute). The container image sets `sqlite:///data/modwatch.db` and a `/data` volume. On Kubernetes with CloudNativePG it is the `uri` key of the `<cluster>-app` secret |
| `LOG_LEVEL` | `info` | |

`CURSEFORGE_BASE_URL`, `MODRINTH_BASE_URL` and `GITHUB_BASE_URL` point a client at another server, which the tests use.

The keys, the author ID, the Modrinth user, the issues repository and the two on/off switches can also be set on the Settings page. A value set there wins over the environment variable and takes effect on the next poll. Values set there are stored in the database in plain text.

The older "API Tokens" page on CurseForge issues upload tokens. Those get a 403 from this API.

## Screenshots

[`docs/screenshots`](docs/screenshots) has every page. A mod page, and the Minecraft versions page:

![A mod page](docs/screenshots/07-mod-detail.png)

![Minecraft versions](docs/screenshots/16-versions.png)

## Endpoints

The UI calls a JSON API under `/api/v1/`, described in [docs/api.md](docs/api.md). Two routes sit outside it:

| | |
|---|---|
| `GET /metrics` | Prometheus text format |
| `GET /healthz` | Liveness |

## Metrics

| Series | Type | |
|---|---|---|
| `modwatch_mod_downloads_total{id,slug,name,owned}` | counter | Lifetime downloads CurseForge reports for a mod |
| `modwatch_project_downloads_total{platform,slug,name}` | counter | Lifetime downloads a platform reports for a project |
| `modwatch_file_downloads_total{source,slug,name,id,version,release_type,game_versions,loaders}` | counter | Downloads of one file or version |
| `modwatch_game_version_downloads_total{source,slug,name,game_version}` | counter | File downloads per mod and Minecraft version |
| `modwatch_loader_downloads_total{source,slug,name,loader}` | counter | File downloads per mod and loader |
| `modwatch_project_review_status{platform,slug,status}` | gauge | 1 for the project's current review status |
| `modwatch_project_review_queue_seconds{platform,slug}` | gauge | How long a project has been in review, while it is |
| `modwatch_mod_health{slug,health}` | gauge | 1 for the mod's current health: `ok`, `attention` or `problem` |
| `modwatch_issues_open{mod,kind}` | gauge | Open GitHub issues |
| `modwatch_oldest_open_bug_age_seconds{mod}` | gauge | Age of the oldest open bug or crash |
| `modwatch_revenue_available`, `_pending`, `_withdrawn_lifetime`, `_withdrawn_ytd` `{platform,currency}` | gauge | Modrinth balance, while Revenue is on |
| `modwatch_source_up{source}` | gauge | 1 if the source was read without error |
| `modwatch_source_last_success_timestamp_seconds{source}` | gauge | When the source was last read without error |
| `modwatch_mods{owned}` | gauge | Mods on the dashboard |
| `modwatch_last_poll_success` | gauge | 1 if the last poll worked |
| `modwatch_last_success_timestamp_seconds` | gauge | Alert when this goes stale |
| `modwatch_last_poll_timestamp_seconds`, `modwatch_last_poll_duration_seconds` | gauge | |
| `modwatch_build_info{version}` | gauge | Always 1 |

`increase(modwatch_mod_downloads_total{owned="true"}[1d])` gives downloads per day. CurseForge sometimes recounts downward; Prometheus reads that as a counter reset.

A file that targets several Minecraft versions counts toward each in the version and loader series, so don't sum those across versions. CurseForge's per-file counts also don't add up to a mod's total, because the API leaves out older and removed files. Modrinth's do add up.

## Develop

See [AGENTS.md](AGENTS.md) for the layout, the rules and the checks to run, [docs/design.md](docs/design.md) for how the pages and the registry fit together, and [docs/plan.md](docs/plan.md) for the decisions behind it. Run `npm run dev` in `web/` for hot reload; it proxies `/api` to `localhost:8080`. `npm run dev:mock` serves fixtures instead, so the UI runs without a backend.

`go test ./...` runs the database tests on SQLite, each in a file of its own. To run them on Postgres, set `MODWATCH_TEST_DATABASE_URL` to a database they can create schemas in; each test gets a schema and drops it. CI runs both.

Contributions need a DCO sign-off; see [CONTRIBUTING.md](CONTRIBUTING.md). Questions and chat: [FireBall Codes on Discord](https://discord.gg/QpV82CFfVD).

## Licence

[AGPL-3.0-only](LICENSE). Third-party notices are in [NOTICE.md](NOTICE.md).
