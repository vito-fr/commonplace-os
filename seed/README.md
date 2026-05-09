# Seed Loader

The v0.1 seed fixtures live in `seed/fixtures/` as one JSON file per table, ordered by filename.

The loader is `seed/load.js`. It writes the fixtures into the PocketBase SQLite database after migrations have been applied.

## Requirements

- Node.js 24 or newer. The loader uses the built-in `node:sqlite` module, which is still experimental in the current Node runtime. The experimental warning is expected for this v0.1 local workflow.
- PocketBase migrations already run, with `0001_initial_schema.js` recorded in `_migrations`.
- PocketBase stopped while the loader writes to `pocketbase/pb_data/data.db`; the loader opens SQLite directly.

## Workflow

From the repo root:

```sh
npm run pb:migrate

npm run seed:load
```

Expected output is one line per fixture file plus a final total, for example:

```text
loaded: 00_workspaces.json -> workspaces (1)
...
loaded: 167 total rows
```

To validate without writing rows:

```sh
npm run seed:dry-run
```

`--dry-run` still opens the target database, checks that the migration has been applied, validates table columns, and validates fixture references. Expected output uses `validated:` instead of `loaded:`.

To load a specific database, for example a temporary verification copy:

```sh
node seed/load.js --db /tmp/vita-pocketbase/pb_data/data.db
```

## Behavior

- Enables `PRAGMA foreign_keys=ON`.
- Enables `PRAGMA trusted_schema=ON` so FTS triggers can run under local SQLite behavior.
- Verifies `0001_initial_schema.js` is recorded in `_migrations`.
- If `0002_personal_archive_pivot.js` is recorded, adapts the legacy fixtures at load time:
  - skips removed campaign rows/tables
  - maps `inbox` and `triaged` item statuses to `active`
  - maps `retired` item statuses to `archived`
  - skips `retired_by` and campaign-dependent relationships/events
- Validates fixture references before writing.
- Upserts fixture rows by primary key in filename order.
- Wraps writes in one transaction.

Reruns are idempotent for rows that still exist in `seed/fixtures`: if a fixture row changes, rerunning the loader updates that row by its conflict key. The loader does not delete rows. If a fixture row is removed from the JSON, any previously loaded row remains until a reset workflow is explicitly added.
