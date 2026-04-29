# Seed Loader

The v0.1 seed fixtures live in `seed/fixtures/` as one JSON file per table, ordered by filename.

The loader is `seed/load.js`. It writes the fixtures into the PocketBase SQLite database after `0001_initial_schema.js` has been applied.

## Requirements

- Node.js 24 or newer, for the built-in `node:sqlite` module.
- PocketBase migrations already run.
- PocketBase stopped while the loader writes to `pocketbase/pb_data/data.db`.

## Workflow

From the repo root:

```sh
./pocketbase/pocketbase migrate up \
  --dir pocketbase/pb_data \
  --migrationsDir pocketbase/pb_migrations

node seed/load.js
```

To validate without writing rows:

```sh
node seed/load.js --dry-run
```

To load a specific database, for example a temporary verification copy:

```sh
node seed/load.js --db /tmp/vita-pocketbase/pb_data/data.db
```

## Behavior

- Enables `PRAGMA foreign_keys=ON`.
- Enables `PRAGMA trusted_schema=ON` so FTS triggers can run under local SQLite behavior.
- Verifies `0001_initial_schema.js` is recorded in `_migrations`.
- Validates fixture references before writing.
- Upserts fixture rows by primary key in filename order.
- Wraps writes in one transaction.

The loader does not delete rows. If a fixture row changes, rerunning the loader updates that row. If a fixture row is removed from the JSON, any previously loaded row remains until a reset workflow is explicitly added.
