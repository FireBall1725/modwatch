# Security policy

## Reporting a vulnerability

Report privately through [GitHub Security Advisories](https://github.com/FireBall1725/modwatch/security/advisories/new) rather than opening a public issue. Include what you did, what happened, and what you expected.

This is a single-maintainer project. Expect an acknowledgement within a week.

## What this server holds

Modwatch keeps up to four secrets. Each can come from an environment variable or from the Settings page.

| Secret | Needed for | What it can do |
|---|---|---|
| `CURSEFORGE_API_KEY` | Always | A read-only Core API key. Everything it fetches is public on CurseForge |
| `MODRINTH_TOKEN` | Optional | A personal access token. With the project read scope Modwatch sees your drafts and projects in review. With the payouts permission it also reads your payout balance |
| `GITHUB_TOKEN` | Optional | Raises GitHub's 60 requests an hour and reads private issue repositories. Read access to issues is enough |
| `DATABASE_URL` | Postgres only | Carries the database password |

Give the Modrinth and GitHub tokens only the scopes listed above. The payout balance is read only while Revenue is on; turn it off on the Settings page or with `MODWATCH_REVENUE_ENABLED=false` and Modwatch stops reading it.

A key set on the Settings page is stored in the database in plain text. The API never returns a secret's value, and Modwatch doesn't log one. To keep a key out of the database, set its environment variable instead.

## Deployment notes

- There is no login. Anyone who can reach the server can change the settings (including replacing the keys), edit the registry, dismiss attention items, start a poll, and read everything, including the Modrinth balance at `/api/v1/revenue`. Serve it on an internal-only ingress or behind a proxy that does its own authentication.
- `/metrics` is unauthenticated, as Prometheus scrapers expect. It exposes mod names, download counts, review status and issue counts, and the Modrinth balance while Revenue is on. `MODWATCH_METRICS_ENABLED=false` turns it off.
- Modwatch makes requests only to `api.curseforge.com`, `api.modrinth.com` and `api.github.com`. The base URLs are set by environment variable, never from the Settings page.
- The image runs as uid 65532 and writes only to `/data`. The Kubernetes example keeps the root filesystem read-only.
