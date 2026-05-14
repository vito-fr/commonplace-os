# Commonplace OS Live Backend

PocketBase is the live backend for the archive. It is a single-binary server with an embedded SQLite database, JS migrations, and JS hooks under `pocketbase/`.

The frontend can run in two modes:

- fixture mode: `npm run dev`
- live PocketBase mode: `npm run dev:live`

## Layout

```
pocketbase/
├── pocketbase          The binary itself. Gitignored. Downloaded during M0.1 setup.
├── pb_data/            Runtime database, files, logs. Gitignored.
├── pb_migrations/      Committed JS migrations — source of truth for schema.
└── pb_hooks/           Committed JS server hooks — backend logic.
```

`SCHEMA.md` at the repo root is the human-readable mirror of `pb_migrations/`. When they diverge, `pb_migrations/` wins as the source of truth, and `SCHEMA.md` is updated to match.

---

## Local Live Setup

Use PocketBase v0.36.9 for the current local runtime. The binary is intentionally gitignored at `pocketbase/pocketbase`.

From the repo root:

```sh
# 1. Install or copy the v0.36.9 binary to pocketbase/pocketbase.

# 2. Run migrations.
npm run pb:migrate

# 3. Stop PocketBase if it is running, then load fixtures.
npm run seed:dry-run
npm run seed:load

# 4. Start PocketBase.
npm run pb:serve

# 5. In a second terminal, start the frontend in live mode.
npm run dev:live
```

The frontend reads `VITE_ITEM_CARD_READER=pocketbase` from `npm run dev:live`. Without that env var the app uses fixture mode, and write surfaces show live-mode disabled states.

### Viewing Uploaded Media

Uploaded PocketBase media is only visible when both local servers are running and the frontend is in live mode:

```sh
npm run pb:serve
npm run dev:live -- --host 127.0.0.1 --port 5173 --strictPort
```

Plain `npm run dev` uses fixture mode by default. Fixture mode is useful for UI work, but it will not show media already uploaded into local PocketBase `pb_data`.

### Backfill Image Dimensions

Existing local image records with missing dimensions can be backfilled from stored files:

```sh
curl -X POST "http://127.0.0.1:8090/api/vita/backfill-image-dimensions?workspace_id=seed:ws001"
```

The backfill is idempotent by default. It skips records that already have both `width` and `height`, skips unreadable files, and does not delete, rewrite, or recreate media files.

---

## Migrations

Every schema change is a numbered JS migration in `pb_migrations/`. Migration files are NEVER edited after they have been run on any environment. A correction to a prior migration is a new migration that supersedes the old one.

Migrations are stop-and-ask in `CLAUDE.md`. Adding, removing, modifying any migration triggers plan mode. The migration text is reviewed line-by-line before commit.

The first migration `0001_initial_schema.js` creates every table from `SCHEMA.md` plus indexes, triggers, CHECK constraints, and FK constraints. It has been accepted as-is under PocketBase v0.36.9, and `SCHEMA.md` is the matching human-readable mirror.

---

## Hooks

Server-side logic that enforces invariants at the backend boundary lives in `pb_hooks/`. Hooks complement the schema's CHECK constraints — they catch what SQL constraints can't.

Examples of v0.1 hooks (final list defined during M1.1+):

- `import.pb.js` — URL fetch on item creation, OG metadata extraction, content-type classification
- `relationships.pb.js` — application-boundary relationship validation; symmetric canonical ordering is enforced by the database trigger `trg_relationships_symmetric_ordering`
- `events.pb.js` — automatic event logging for status transitions when not handled by the client

Hooks do NOT duplicate UI logic. They enforce data invariants. If a rule should fire regardless of which client is making the request, it lives in a hook. If a rule is about user experience, it lives in the frontend.

---

## Running PocketBase

```bash
npm run pb:serve
```

The default port is 8090. The admin UI is at `http://127.0.0.1:8090/_/`.

---

## Backups

v0.1 uses manual backups per `docs/runbooks/v0.1-backup.md`. Always stop PocketBase before backing up `pb_data/`.

v1 introduces Litestream → R2 continuous replication. The runbook for that lives at `docs/runbooks/restore.md` when v1 ships.

---

## What does NOT live here

- Frontend code — lives in `src/` at the repo root when v0.1 frontend is initialized at M1.1
- Seed fixtures — live in `seed/fixtures/`
- Tests for hooks — colocated with the hook (e.g., `pb_hooks/import.test.pb.js`)
- Production deployment configuration — v1 concern
