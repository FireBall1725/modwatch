# API

All routes are under `/api/v1/` and return JSON. Types are in `web/src/lib/types.ts`. Errors are `{"error": "..."}` with a 4xx or 5xx status. There is no authentication, so read [SECURITY.md](../SECURITY.md) before exposing it.

| Route | Query or body | Returns |
|---|---|---|
| `GET /overview` | `legacy` | `Overview` |
| `GET /mods` | `legacy` | `ModSummary[]`, owned and member mods, biggest combined downloads first |
| `GET /mods/{slug}` | | `ModDetail`, 404 for an unknown slug |
| `GET /downloads/history` | `days` 1 to 3650, default 90; `legacy` | `DownloadsHistory` |
| `GET /versions` | `legacy` | `Versions` |
| `GET /releases` | `limit` 1 to 500, default 50; `legacy` | `ReleaseItem[]`, newest first |
| `GET /issues` | `state` `open` (default), `closed` or `all` | `Issues` |
| `GET /revenue` | | `Revenue`, the Modrinth balance; `enabled` is false and `items` empty when Revenue is off |
| `GET /catalog` | | `Catalog` |
| `PUT /catalog/{slug}` | body `CatalogUpdate` | `Catalog` |
| `POST /catalog/relink` | | `Catalog` |
| `GET /settings` | | `Settings`: each setting with where its value comes from, plus every Minecraft version a tracked file has |
| `PUT /settings` | body `SettingsUpdate`: setting names to text values, or null to clear | `Settings` |
| `POST /attention/dismiss` | body `{kind, modSlug}` | 204. The item stays dismissed until restored |
| `POST /attention/restore` | body `{kind, modSlug}` | 204. Undoes a dismissal |
| `POST /curseforge/author` | body `{link}`, a CurseForge profile link | `{id, name, url}` for the author id. Saves nothing |
| `POST /poll` | | 202 `{"status":"started"}`, 409 when a poll is running or nothing is configured |
| `GET /summary` | | Legacy CurseForge totals and sources |
| `GET /files` | | Legacy per-file stats |
| `GET /history` | `days` 1 to 3650, default 30 | Legacy per-mod CurseForge snapshots |

`GET /healthz` and `GET /metrics` sit outside `/api/v1/`. Any other path under `/api/` returns 404 `{"error":"not found"}`.

A bad query value returns 400, and an empty one such as `?days=` is read as absent. A download history point is the cumulative count at the start of a UTC day, carried forward over days with no poll. `/downloads/history` and `/versions` history start at each series' first stored snapshot.

Mods the author marked legacy stay out of the lists, totals and charts unless the request carries `?legacy=1`. `/mods/{slug}`, `/issues` and `/metrics` always include them, and `totals.legacyMods` in the overview says how many are out.

`PUT /catalog/{slug}` rejects a name over 120 characters or a githubLabel over 100, control characters, and a githubLabel that starts with `mod:` (the label is the text after it). Labels compare without regard to case. A body over 64 KB returns 413. An edit that clears every link deletes the entry, so a relink can reuse its slug.

`PUT /settings` takes a partial update. A secret's value is never returned; each item says only whether it comes from the environment, from Settings, or is unset. A value set in Settings wins over the environment variable and applies from the next poll.

CurseForge per-file counts do not add up to the project's download total (the API leaves older and removed files out), so any per-file or per-version figure for CurseForge is partial. Project totals are the figure to quote.

`/metrics`: every series carries the registry slug of the mod. `modwatch_file_downloads_total` has an `id` label (the platform's file or version id) because Modrinth versions can share a version number. `modwatch_mods` counts the mods on the dashboard across platforms, not CurseForge projects. The series are listed in the [README](../README.md#metrics).
