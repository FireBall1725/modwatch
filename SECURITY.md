# Security policy

## Reporting a vulnerability

Report privately through [GitHub Security Advisories](https://github.com/FireBall1725/modwatch/security/advisories/new) rather than opening a public issue. Include what you did, what happened, and what you expected.

This is a single-maintainer project. Expect an acknowledgement within a week.

## What this server holds

One credential: `CURSEFORGE_API_KEY`, a read-only Core API key. It is never logged or returned by the API. The data it fetches (download counts for public projects) is public on CurseForge.

## Deployment notes

- There is no login. The only write endpoint is `POST /api/v1/poll`, which starts a poll that is already scheduled to run hourly. Serve the UI on an internal-only ingress anyway.
- `/metrics` is unauthenticated, as Prometheus scrapers expect. It exposes mod names and download counts, nothing else.
- The image runs as uid 65532 and writes only to `/data`.
