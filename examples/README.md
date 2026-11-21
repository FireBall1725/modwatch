# Examples

Three ways to run Modwatch. Each one is a starting point: copy the folder, fill in your own values and start it.

| Folder | Database | Use it when |
|---|---|---|
| [`docker-compose/sqlite`](docker-compose/sqlite) | SQLite file in a volume | You want the smallest setup, one container and nothing else to run |
| [`docker-compose/postgres`](docker-compose/postgres) | Postgres container | You want Postgres without a cluster |
| [`kubernetes`](kubernetes) | Postgres from CloudNativePG | You run Kubernetes and want the operator's backups and metrics |

Every example needs your CurseForge Core API key and your numeric CurseForge author ID. Both can also be set later on the Settings page. The keys in these files are placeholders. Don't commit real ones.

SQLite is plenty for one author's mods. A poll an hour adds a few hundred rows. A database isn't converted from one kind to the other, so pick one before the history builds up.

The image is `ghcr.io/fireball1725/modwatch`. The examples use the `latest` tag for the newest stable release. Pin a version, such as `26.11.0`, once you're running it for real, so an update is a change you make.
