# Modwatch design

Modwatch is one place to manage your Minecraft mods. At a glance it answers: are any issues open, how is each mod doing, have CurseForge and Modrinth approved it, how many downloads does it have on both platforms combined and apart, and which Minecraft versions do people download for.

The API contract is `web/src/lib/types.ts`. It is the source of truth: the Go handlers return exactly those shapes and the pages are written against them. Change both sides together, and `internal/api/contract_test.go` fails if the handlers and the mock fixtures drift apart.

## Sources

| Source | What it gives | Key |
|---|---|---|
| CurseForge Core API | downloads, per-file downloads, review status, files with Minecraft versions | `CURSEFORGE_API_KEY` |
| Modrinth API | downloads, per-version downloads, status (`approved`, `processing`, `draft`...), `moderator_message`, `requested_status`, queue time, the payout balance | `MODRINTH_TOKEN` |
| GitHub issues | issues in one shared repository, labelled `mod: <label>` plus a type (`bug`, `crash`, `enhancement`, `compatibility`, `question`), and optionally one repository per mod | `GITHUB_TOKEN`, optional for public repositories |

**Modrinth hides unapproved projects without a token.** An anonymous call returns only public projects, so a draft or a project in review is invisible. Without a token the dashboard says so out loud (a `SourceStatus.detail` and an entry in `Overview.problems`) rather than showing a clean "all approved".

## The registry

The catalogues name one mod three ways: CurseForge `my-mod`, Modrinth `mymod`, GitHub label `mod: my-mod`. A registry entry joins them under one slug: `slug`, `name`, `curseforgeId`, `modrinthId`, `githubLabel`, `githubRepo`, `versionRegex`, `hidden`, `legacy`. `legacy` marks a mod that deliberately stays on old Minecraft versions: it never raises `no_latest_minecraft`, and the UI leaves it out of "ready for the newest version" checks. It also keeps the mod out of the lists, totals, version roll-ups and charts unless a request carries `?legacy=1` (the header switch sets it, and the browser remembers the choice); `/mods/{slug}`, `/issues` and `/metrics` always include it, and `totals.legacyMods` says how many are out. Mock mode ignores the switch.

The poller creates an entry for every owned project so nothing is hidden. It links a CurseForge and a Modrinth project to one entry when their slugs match exactly, or their normalised names do (`Automatic Gui Scale` on both), and gives every other owned project its own single-platform entry. A single-platform entry is also how a mismatch shows up: two projects with different slugs stay two entries until Settings merges them. A `mod: <label>` issue label links to the entry whose slug equals the label, or whose `githubLabel` was set by hand.

Manual links are never overwritten by auto-linking. Setting an entry's `curseforgeId` or `modrinthId` to a project another entry already holds moves the project and deletes the other entry if that leaves it with no links. `Catalog.unlinked.projects` is projects the poller found that no entry points at, such as the CurseForge mods the author is only a member of, which can be adopted into an entry. `Catalog.unlinked.githubLabels` is issue labels no entry claims.

`versionRegex` is a mod's own pattern for reading its file names, with named groups `version` and optionally `pre` and `minecraft`. A mod whose files don't follow the default naming sets it in the edit dialog.

## Pages

All pages share one shell: a left nav on wide screens, a top bar with a menu on narrow ones. The header carries each source's status, the "Show legacy mods" and "Hide amounts" switches, the last poll and "Poll now". Every page works at 1600 px wide, using the whole window, and at 390 px. [docs/screenshots](screenshots) has a picture of each.

1. **Overview** `/`. The at-a-glance page. A banner counting problems, warnings and notes. A KPI strip (downloads on both platforms combined with a CurseForge and Modrinth split and 24 hour and 7 day movement, open issues with bugs and crashes called out, mods needing attention, projects in review). A "Needs attention" list ordered by severity (open crashes, bugs, Modrinth `processing`, `draft` or rejected, CurseForge not approved, a source down, no file for the newest Minecraft version), where the items that can be dismissed have a close button. A card grid of mods, each with its icon, a status chip per platform, open issues, combined downloads with the platform split and a sparkline. Top Minecraft versions, the Modrinth revenue card and recent releases. If nothing needs attention it says so plainly.
2. **Mods** `/mods`. A dense sortable, filterable table of every mod: name, CurseForge status, Modrinth status, open issues, downloads split by platform, 7 day movement, latest release, Minecraft versions supported. Search, filter by health, platform, review state or Minecraft version, and toggles for open issues, legacy and member mods. Rows link to the mod page.
3. **Mod detail** `/mods/:slug`. Header with icon, name, summary and links (CurseForge, Modrinth, GitHub, source, wiki, Discord). What needs attention for this mod. A status panel per platform with the raw status, requested status, moderator message and time in the review queue. Downloads over time, stacked by platform, over a range you pick. Minecraft versions and loaders for this mod. A files table grouped by release across both platforms, with filters. Open and closed issues. An "Edit links" button opens the registry editor for this mod.
4. **Downloads** `/downloads`. Platform comparison. Combined and per-platform totals over time with a range selector (7, 30, 90 days, 1 year), daily movement or a running total, share of downloads by platform, top movers, and a per-mod table of CurseForge against Modrinth.
5. **Minecraft versions** `/versions`. Downloads by Minecraft version and by loader, downloads per day by version over time, and a mod by version matrix (which mod has files for which version, with downloads in the cell) so a gap against the newest version is obvious. Versions sort by version number, not alphabetically; `26.1` is newer than `1.21.11`.
6. **Issues** `/issues`. Open issues across all mods: counts by mod and by kind, the oldest open bug, and a filterable list (mod, kind, state, age, search) with links to GitHub. Closed issues on request. Labels that no mod claims are flagged with a link to Settings.
7. **Releases** `/releases`. Approval and release board. Per mod and platform: review status, requested status, moderator message, time in queue. Days since each mod's last release, and a release timeline across all mods and both platforms, newest first, with release type, Minecraft versions and loaders.
8. **Settings** `/settings`, in four tabs.
   - **Connections**: each key and setting, with where its value comes from, plus data source health with each source's last success and error, Poll now and the schedule, and the version and build.
   - **Registry**: linked mods with their links, edit and unlink, an unlinked list with suggested matches, hide a mod, mark it legacy.
   - **Minecraft versions**: a switch per version any file has. A version switched off leaves the totals, charts, version matrix and health checks, and its history is kept, so switching it back on brings it back. A mod whose every file is on a switched-off version counts nothing.
   - **Appearance**: the colour theme.

## Look and feel

- **Fifteen colour themes**, picked on the Appearance tab and remembered in the browser. The default is Midnight Orchid: dark, with hot pink `#FF69B4` as the accent. `web/src/themes/palettes.ts` defines each theme from a handful of colours, and `npm run themes` derives the rest of the tokens and nudges any text colour that wouldn't read, so every theme keeps WCAG AA contrast.
- **Platform colours are fixed in every theme**: CurseForge orange `#F16436`, Modrinth green `#1BD96A`. A platform is always shown as a small badge with its name, never colour alone.
- **Status colours**: approved green, in review amber, changes required or rejected red, draft and unlisted grey, inactive muted. Every status chip carries a word and an icon, not just a colour.
- **Numbers** use the mono face and tabular figures. A number that can't be known yet shows `–`. Times use the 24-hour clock. Spelling is Canadian ("colour", "licence").
- **Copy** is short and factual. No sentence that explains what the UI already shows. No em dashes anywhere, including UI strings. All user-facing strings go through i18next, one locale file per page.
- **No emoji as icons.** Use the inline SVG set in `components/ui/Icon.tsx`.
- **Charts are hand-written SVG** from `components/charts/`, no charting library. They resize with their container, have a hover tooltip, an accessible text alternative, and never rely on colour alone.
- **States**: every page has loading (skeleton), empty and error states, designed, not default.
- **Accessibility**: keyboard reachable, visible focus, labelled controls, tables with headers, `prefers-reduced-motion` respected.
- **Hide amounts** in the header hides the Modrinth balance in the browser, for screen sharing. It changes nothing on the server.

## Mock mode

`npm run dev:mock` in `web/` serves `web/src/mocks/fixtures/*.json` through the API client with a short delay, so a page can be built without the backend. `node src/mocks/generate.mjs` regenerates the fixtures. They follow `types.ts` exactly and include the awkward cases: a Modrinth project `processing` with a moderator message, a `draft`, a CurseForge mod `ChangesRequired`, a mod on one platform only, an unlinked project, an open crash, a mod with `null` deltas, a mod with zero downloads, and a version like `26.1`.

## Backend rules

- Everything in `AGENTS.md` still applies: no ORM, no router library, raw SQL in `internal/repository/`, empty slices not `nil`, fixed-width UTC times, a failed poll never blanks the dashboard.
- A source failing never blocks the others. Each source has a `SourceStatus`.
- Write endpoints (`PUT /api/v1/catalog/{slug}`, `POST /api/v1/catalog/relink`, `PUT /api/v1/settings`, `POST /api/v1/attention/dismiss`, `POST /api/v1/attention/restore`, `POST /api/v1/curseforge/author`, `POST /api/v1/poll`) validate input, return `{"error": "..."}` with a 4xx, and never panic on bad JSON. Unknown `/api/*` paths return `{"error":"not found"}` with 404, and an empty query value such as `?days=` behaves as if the parameter were absent.
- With `MODRINTH_USER` set and no token, `Config.Problems()` reports that drafts and projects in review are hidden, which shows in `Overview.problems` and `/api/v1/summary`.

## Settings, issue repositories, revenue and dismissals

**Settings.** Eight values can come from an environment variable or be set in Settings: `curseforgeApiKey`, `curseforgeAuthorId`, `modrinthUser`, `modrinthToken`, `githubToken`, `githubIssuesRepo`, `metricsEnabled` (`MODWATCH_METRICS_ENABLED`) and `revenueEnabled` (`MODWATCH_REVENUE_ENABLED`). The two switches take the strings `true` or `false`; not chosen means on. With metrics off `/metrics` answers 404, so Prometheus shows the target as down. A value set in Settings wins, and clearing it brings the environment variable back. `GET /api/v1/settings` returns `{items: SettingItem[], minecraftVersions: string[]}`, each item with `source` (`ui`, `env`, `none`) and `envSet`; a secret's `value` is always null. `PUT /api/v1/settings` takes a partial `SettingsUpdate`. The server reads the effective values at the start of every poll, so a change applies to the next poll (the UI offers Poll now). Values set in Settings are stored in the database in plain text; the UI says so and points at the environment variable for anyone who would rather keep a key out of it. The list of switched-off Minecraft versions is also stored as a setting, but has no environment variable.

**Issue repositories, two modes.** The shared repository (`githubIssuesRepo`) holds issues for every mod and links them by `mod: <label>` labels. A mod can also have its own repository (`CatalogEntry.githubRepo`): every issue in it belongs to that mod, labels or not. Both are used together, not one or the other: a mod with its own repository shows the issues from it and also the issues the shared repository labels for it, and both count toward its open issues and health. Settings has the shared repository field on the Connections tab and a per-mod "Issues repository" field in the registry. An issue's `repo` says where it came from, and issue numbers are only unique within a repo.

**Revenue.** With a Modrinth token that has the payouts permission, each poll reads the author's balance and stores it (`GET /api/v1/revenue`). The Overview shows it in a card with the last twelve months. `modwatch_revenue_*` series carry it to Prometheus. CurseForge doesn't share its balance through its API, and the card says so. Turning Revenue off stops the read.

**Dismissals.** A needs-attention item of a dismissible kind (`AttentionItem.dismissible`) can be dismissed: `POST /api/v1/attention/dismiss {kind, modSlug}`; `POST /api/v1/attention/restore` undoes it. A dismissed item leaves `Overview.attention` and the mod's `attention`, stops counting toward the mod's health and `needAttention`, and moves to `Overview.dismissed`. It stays dismissed until restored. Dismissing is per kind and mod, so dismissing `not_approved` for a mod covers its CurseForge and Modrinth items. Real bugs and crashes, a source that is down and an unlinked label can't be dismissed.
