# API

All routes are under `/api/v1/` and return JSON. Types are in `web/src/lib/types.ts`. Errors are `{"error": "..."}` with a 4xx or 5xx status.

| Route | Query | Returns |
|---|---|---|
| `GET /overview` | | `Overview` |
| `GET /mods` | | `ModSummary[]`, owned and member mods, biggest combined downloads first |
| `GET /mods/{slug}` | | `ModDetail`, 404 for an unknown slug |
| `GET /downloads/history` | `days` 1 to 3650, default 90 | `DownloadsHistory` |
| `GET /versions` | | `Versions` |
| `GET /releases` | `limit` 1 to 500, default 50 | `ReleaseItem[]`, newest first |
| `GET /issues` | `state` `open` (default), `closed` or `all` | `Issues` |
| `GET /catalog` | | `Catalog` |
| `PUT /catalog/{slug}` | | `Catalog`, body is `CatalogUpdate` |
| `POST /catalog/relink` | | `Catalog` |
| `POST /poll` | | 202 `{"status":"started"}`, 409 when a poll is running or nothing is configured |
| `GET /summary` | | Legacy CurseForge totals and sources |
| `GET /files` | | Legacy per-file stats |
| `GET /history` | `days` 1 to 3650, default 30 | Legacy per-mod CurseForge snapshots |

`GET /healthz` and `GET /metrics` sit outside `/api/v1/`.

A bad query value returns 400. A download history point is the cumulative count at the start of a UTC day, carried forward over days with no poll. `/downloads/history` and `/versions` history start at each series' first stored snapshot.

`PUT /catalog/{slug}` rejects a name over 120 characters or a githubLabel over 100, control characters, and a githubLabel that starts with `mod:` (the label is the text after it). Labels compare without regard to case. A body over 64 KB returns 413. An edit that clears every link deletes the entry, so a relink can reuse its slug.

CurseForge per-file counts do not add up to the project's download total (the API leaves older and removed files out), so any per-file or per-version figure for CurseForge is partial. Project totals are the figure to quote.

`/metrics`: every series carries the registry slug of the mod. `modwatch_file_downloads_total` has an `id` label (the platform's file or version id) because Modrinth versions can share a version number. `modwatch_mods` counts the mods on the dashboard across platforms, not CurseForge projects.
