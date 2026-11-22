# Notices

## Font Awesome Free

The icons in `web/src/components/ui/Icon.tsx` come from [Font Awesome Free](https://fontawesome.com) 7 (Solid and Brands), Copyright Fonticons, Inc. The icons are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The npm packages `@fortawesome/free-solid-svg-icons` and `@fortawesome/free-brands-svg-icons` carry the full licence text. The GitHub mark is a brand logo and stays GitHub's trademark.

## CurseForge and Modrinth logos

The CurseForge and Modrinth logos in `web/src/components/ui/PlatformBadge.tsx` belong to their owners. They are used only to label which platform a number comes from.

## Mod loader logos

The Fabric, Forge and NeoForge icons in `web/src/components/ui/LoaderBadge.tsx` are the ones Modrinth serves for its loaders at `https://api.modrinth.com/v2/tag/loader`. The logos belong to the loaders' projects. They are used only to label which loader a file is for.

## IBM Plex fonts

The UI sets its text in IBM Plex Sans and IBM Plex Mono, Copyright IBM Corp., bundled unmodified through the npm packages `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`. They are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org), and each package carries the full licence text.

## Libraries

The binary links these Go modules, and the web client bundles these npm packages. Each one carries its own licence text.

| Library | Licence |
|---|---|
| [golang-migrate/migrate](https://github.com/golang-migrate/migrate) | MIT |
| [jackc/pgx](https://github.com/jackc/pgx) | MIT |
| [robfig/cron](https://github.com/robfig/cron) | MIT |
| [modernc.org/sqlite](https://gitlab.com/cznic/sqlite) | BSD-3-Clause. Its `LICENSE-3RD-PARTY.md` lists the notices for the SQLite source and the Go ports it is built from |
| [React](https://react.dev) and React DOM | MIT |
| [React Router](https://reactrouter.com) | MIT |
| [i18next](https://www.i18next.com) and react-i18next | MIT |
| [Tailwind CSS](https://tailwindcss.com), used at build time | MIT |

The rest of the dependency tree is listed in `go.sum` and `web/package-lock.json`, and each package there carries its own licence.

