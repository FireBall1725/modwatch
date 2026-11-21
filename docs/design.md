# Modwatch dashboard design

The brief: one place to manage my Minecraft mods. At a glance I want to know whether any issues are open, how each mod is doing, whether Modrinth and CurseForge have approved it, how many downloads it has on both platforms combined and apart, and which Minecraft versions people download for. More than one page.

The API contract is `web/src/lib/types.ts`. It is the source of truth: the Go handlers return exactly those shapes and the pages are written against them. Change it only with a reason and update both sides.

## Sources

| Source | What it gives | Key |
|---|---|---|
| CurseForge Core API | downloads, per-file downloads, review status (`status` 1 to 10), files with Minecraft versions | `CURSEFORGE_API_KEY` |
| Modrinth API | downloads, per-version downloads, `status` (`approved`, `processing`, `draft`...), `moderator_message`, `requested_status`, `queued` | `MODRINTH_TOKEN` |
| GitHub `FireBall1725/mod-issues` | issues, labelled `mod: <label>` plus a type (`bug`, `crash`, `enhancement`, `compatibility`, `question`) | `GITHUB_TOKEN` optional (public repo) |

**Modrinth hides unapproved projects without a token.** On 2026-11-21 an anonymous call returned 6 projects and the token returned 8: `ae-lights` was `processing` and `qmk-extra-keybinds` was `draft`. Without a token the dashboard must say so out loud (a `SourceStatus.detail`), not show a clean "all approved".

## The registry (manage my mods)

The three catalogues name one mod three ways: CurseForge `automatic-gui-scale`, Modrinth `ags`, GitHub label `mod: auto-gui-scale`; CurseForge `firecorelib`, Modrinth `firecoremod`, label `mod: firecore`. A registry entry joins them under one slug: `slug`, `name`, `curseforgeId`, `modrinthId`, `githubLabel`, `hidden`, `legacy`. `legacy` marks a mod that deliberately stays on old Minecraft versions: it never raises `no_latest_minecraft`, and the UI leaves it out of "ready for the newest version" checks. It also keeps the mod out of the lists, totals, version roll-ups and charts unless a request carries `?legacy=1` (the header switch sets it, and the browser remembers the choice); `/mods/{slug}`, `/issues` and `/metrics` always include it, and `totals.legacyMods` says how many are out. Mock mode ignores the switch.

The poller creates an entry for every owned project so nothing is hidden: it links a CurseForge and a Modrinth project to one entry when their slugs match exactly, or their normalised names do (`Automatic Gui Scale` on both), and gives every other owned project its own single-platform entry. A single-platform entry is also how a mismatch shows up: `firecorelib` on CurseForge and `firecoremod` on Modrinth are two entries until Settings merges them. A `mod: <label>` issue label links to the entry whose slug equals the label, or whose `githubLabel` was set by hand.

Manual links are never overwritten by auto-linking. Setting an entry's `curseforgeId` or `modrinthId` to a project another entry already holds moves the project and deletes the other entry if that leaves it with no links. `Catalog.unlinked.projects` is projects the poller found that no entry points at (the CurseForge mods the author is only a member of, such as Applied Energistics 2), which can be adopted into an entry. `Catalog.unlinked.githubLabels` is issue labels no entry claims. There is no login; the chart serves this on an internal-only ingress.

## Pages

All pages share one shell: a left nav on wide screens, a top bar with a menu on narrow ones, a poll status and "Poll now" in the header. Every page works at 1600 px wide, using the whole window, and at 390 px.

1. **Overview** `/`. The at-a-glance page. KPI strip (downloads on both platforms combined with a CurseForge and Modrinth split, 24h and 7d movement, open issues with bugs and crashes called out, mods needing attention, projects in review). A "Needs attention" list ordered by severity (open crashes, bugs, Modrinth `processing`, `draft` or rejected, CurseForge not approved, a source down, no file for the newest Minecraft version). A card grid of mods, each with its icon, a status chip per platform, open issues, combined downloads with the platform split and a sparkline. Recent releases. If nothing needs attention it says so plainly.
2. **Mods** `/mods`. A dense sortable, filterable table of every mod: name, CurseForge status, Modrinth status, open issues (bugs and crashes), downloads split by platform, 7d movement, latest release, Minecraft versions supported. Search, filter by health or platform, toggle member mods. Rows link to the mod page.
3. **Mod detail** `/mods/:slug`. Header with icon, name, summary and links (CurseForge, Modrinth, GitHub, source, wiki). A status panel per platform with the raw status, requested status, moderator message and time in the review queue. Downloads over time, stacked by platform. Minecraft versions for this mod. A files table across both platforms. Open and recent issues. A button to the Settings link editor for this mod.
4. **Downloads** `/downloads`. Platform comparison. Combined and per-platform totals over time with a range selector (7, 30, 90, 365 days), daily movement, per-mod comparison of CurseForge against Modrinth for the same mod, share of downloads by platform, top movers.
5. **Minecraft versions** `/versions`. Downloads by Minecraft version (bars) and by loader, downloads per day by version over time, and a mod by version matrix (which mod has files for which version, with downloads in the cell), so a gap against the newest version is obvious. Versions sort by version number, not alphabetically; `26.1` is newer than `1.21.11`.
6. **Issues** `/issues`. Open issues from the issues repo across all mods: counts by mod and by kind, oldest open bug, a filterable list (mod, kind, state, age, search) with links to GitHub. Closed issues on request. Labels that no mod claims are flagged with a link to Settings.
7. **Releases** `/releases`. Approval and release board. Per mod and platform: review status, requested status, moderator message, time in queue. A release timeline across all mods and both platforms (newest first) with release type, Minecraft versions and loaders, plus days since each mod's last release.
8. **Settings** `/settings`. The registry editor: linked mods with their CurseForge, Modrinth and label links, edit and unlink, an unlinked list with suggested matches and one-click link, hide a mod. Data source health with each source's last success, error and limits (the Modrinth token note). Poll now and the schedule. Version and build.

## Look and feel

- **Dark only**, hot pink `#FF69B4` as the accent (the existing tokens in `web/src/index.css`). She dislikes light sites.
- **Platform colours are fixed everywhere**: CurseForge orange `#F16436`, Modrinth green `#1BD96A`. A platform is always shown as a small badge with its name, never colour alone.
- **Status colours**: approved green, in review amber, changes required or rejected red, draft and unlisted grey, inactive muted. Every status chip carries a word and an icon, not just a colour.
- **Numbers** use the mono face and tabular figures. A number that can't be known yet shows `–`. 24-hour clock. Canadian spelling ("colour", "licence").
- **Copy** is short and factual. No sentence that explains what the UI already shows. No em dashes anywhere, including UI strings. All user-facing strings go through i18next, one locale file per page.
- **No emoji as icons.** Use the inline SVG set in `components/ui/Icon.tsx`.
- **Charts are hand-written SVG** from `components/charts/`, no charting library. They resize with their container, have a hover tooltip, an accessible text alternative, and never rely on colour alone.
- **States**: every page has loading (skeleton), empty, and error states, designed, not default.
- **Accessibility**: keyboard reachable, visible focus, labelled controls, tables with headers, WCAG AA contrast on the dark tokens, `prefers-reduced-motion` respected.
- Invoke the `frontend-design` and `ui-ux-pro-max` skills before designing a page. Look at what you built in a real screenshot before calling it done.

## Who owns which files

Eight pages are built in parallel, so files are owned, not shared.

- **Foundation agent** owns `web/package.json`, `web/src/main.tsx`, `App.tsx`, `routes.tsx`, `lib/**` except `types.ts`, `hooks/**`, `components/layout/**`, `components/ui/**`, `components/charts/**`, `i18n/index.ts`, `mocks/**`, `index.css`, and one stub per page.
- **A page agent** owns `web/src/pages/<page>/**` and `web/src/i18n/locales/<page>.json` only. It may add components inside its own folder. If it needs a change to a shared component, it records it in its `sharedChangeRequests` result and works around it locally; it does not edit shared files.
- **Backend agents** own `internal/**`, `cmd/**` and Go tests, one after another, never at the same time.
- `web/src/lib/types.ts` and `docs/design.md` are owned by the lead.

## Mock mode

`VITE_MOCK=1 npm run dev` serves `web/src/mocks/fixtures/*.json` through the API client with a short delay, so pages can be built before the backend exists. The fixtures follow `types.ts` exactly and include the awkward cases: a Modrinth project `processing` with a moderator message, one `draft`, a CurseForge mod `ChangesRequired`, a mod on one platform only, an unlinked project, an open crash, a mod with `null` deltas, a mod with zero downloads, a version like `26.1`. A final integration step compares the fixtures' shape to the live API's.

## Backend rules

- Everything in `AGENTS.md` still applies: no ORM, no router library, raw SQL in `internal/repository/`, SPDX header on every file, empty slices not `nil`, fixed-width UTC times, a failed poll never blanks the dashboard.
- A source failing never blocks the others. Each source has a `SourceStatus`.
- Existing endpoints and metrics keep working until the UI no longer uses them.
- New metrics (hand-written, same style as `metrics.go`):
  - `modwatch_project_downloads_total{platform,slug,name}` counter
  - `modwatch_project_review_status{platform,slug,status}` gauge, 1 for the current status
  - `modwatch_project_review_queue_seconds{platform,slug}` gauge, only while in review
  - `modwatch_issues_open{mod,kind}` gauge, `modwatch_oldest_open_bug_age_seconds{mod}` gauge
  - `modwatch_mod_health{slug,health}` gauge, 1 for the current health
- Config: `GITHUB_ISSUES_REPO` (default empty, off), `GITHUB_TOKEN` (optional), `MODRINTH_TOKEN` (optional but needed for unapproved projects; with `MODRINTH_USER` set and no token, `Problems()` reports that drafts and projects in review are hidden, which shows in `Overview.problems` and `/api/v1/summary`).
- Write endpoints (`PUT /api/v1/catalog/{slug}`, `POST /api/v1/catalog/relink`, `POST /api/v1/poll`) validate input, return `{"error": "..."}` with a 4xx, and never panic on bad JSON.  Unknown `/api/*` paths return `{"error":"not found"}` with 404, and an empty query value such as `?days=` behaves as if the parameter were absent.

## Checking your work

Backend: `go build ./... && go vet ./... && go test ./... && golangci-lint run`.
Web: `cd web && npx tsc -b && npm run lint && npm test && npm run build`.

Look at pages with headless Chrome, which can't collide with another agent's browser:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --window-size=1600,1100 --virtual-time-budget=6000 \
  --screenshot=/private/tmp/claude-501/shots/<name>.png "http://127.0.0.1:<port>/<path>"
```

then read the PNG. Check 1600 px and 390 px. Each page agent runs its own Vite dev server on its own port (5201 to 5208, Overview first).


## Settings, issue repositories and dismissals

**Settings.** Seven values can come from an environment variable or be set in Settings: `curseforgeApiKey`, `curseforgeAuthorId`, `modrinthUser`, `modrinthToken`, `githubToken`, `githubIssuesRepo` and `metricsEnabled` (`MODWATCH_METRICS_ENABLED`, the strings `true` or `false`; not chosen means on). With metrics off `/metrics` answers 404, so Prometheus shows the target as down. A value set in Settings wins; clearing it brings the environment variable back. `GET /api/v1/settings` returns `{items: SettingItem[]}` with `source` (`ui`, `env`, `none`) and `envSet`; a secret's `value` is always null. `PUT /api/v1/settings` takes a partial `SettingsUpdate`. The server reads the effective values at the start of every poll, so a change applies to the next poll (the UI offers Poll now). Values set in Settings are stored in the database in plain text; the UI says so and points at the environment variable for anyone who would rather keep a key out of it.

**Issue repositories, two modes.** The shared repository (`githubIssuesRepo`) holds issues for every mod and links them by `mod: <label>` labels. A mod can also have its own repository (`CatalogEntry.githubRepo`): every issue in it belongs to that mod, labels or not. Both can be used together. Settings has the shared repository field in the connections section and a per-mod "Issues repository" field in the registry. An issue's `repo` says where it came from, and issue numbers are only unique within a repo.

**Dismissals.** A needs-attention item of a dismissible kind (`AttentionItem.dismissible`) can be dismissed: `POST /api/v1/attention/dismiss {kind, modSlug}`; `POST /api/v1/attention/restore` undoes it. A dismissed item leaves `Overview.attention` and the mod's `attention`, stops counting toward the mod's health and `needAttention`, and moves to `Overview.dismissed`. It stays dismissed until restored. Dismissing is per kind and mod, so dismissing `not_approved` for a mod covers its CurseForge and Modrinth items.
