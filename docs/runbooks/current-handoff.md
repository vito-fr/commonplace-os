# Current Handoff

Last updated: 2026-04-29

## Current Phase

M0.1 local planning-to-first-migration boundary.

The first schema migration has been written, runtime-verified, accepted as-is, and the documentation has been aligned and committed.

## Latest Accepted Result

- Migration file accepted: `pocketbase/pb_migrations/0001_initial_schema.js`
- Runtime verified under PocketBase v0.36.9 for macOS ARM64.
- Documentation alignment committed:
  - Commit: `3690778 Align schema and planning docs with accepted initial migration`
- `SCHEMA.md` now mirrors the accepted migration.
- `docs/runbooks/m0.1-plan.md` records the accepted decisions and runtime verification notes.

## Approved Flags

- F-1 approved: include `rights_status`, `rights_note`, and `rights_reviewed_at` in `items`.
- F-2 approved: enforce symmetric relationship ordering with `trg_relationships_symmetric_ordering`, a `BEFORE INSERT` trigger.
- F-3 approved: scaffold `embeddings` with `vector BLOB NOT NULL` placeholder storage.
- F-4 approved: create `items_fts` with `content=''` and explicit sync triggers.

## Verified Runtime Notes

- PocketBase version used for verification: v0.36.9.
- `0001_initial_schema.js` applies cleanly under PocketBase.
- `PRAGMA foreign_keys` returned `1` under PocketBase.
- `PRAGMA trusted_schema` returned `1` under PocketBase.
- FTS insert/update/delete triggers worked under PocketBase.
- Symmetric reverse-order relationship inserts were rejected with the expected trigger error.
- The local macOS `sqlite3` CLI may default `trusted_schema` to `0`; CLI-only checks that fire FTS triggers should run `PRAGMA trusted_schema=ON`.

## Next Task

Commit or otherwise explicitly handle the accepted migration file:

- `pocketbase/pb_migrations/0001_initial_schema.js`

After that, proceed to the seed specification / seed loader step from `docs/runbooks/m0.1-plan.md`.

## In-Scope Files

For the immediate next task:

- `pocketbase/pb_migrations/0001_initial_schema.js`
- `docs/runbooks/current-handoff.md`

For the next implementation step after the migration is committed:

- `seed/README.md`
- `seed/load.ts`
- `seed/fixtures/*.json`
- `docs/runbooks/m0.1-plan.md` as the source of truth for fixture coverage

## Out-Of-Scope Files

- Frontend files (`src/`, `package.json`, Vite/React config, component files)
- Existing migration logic in `pocketbase/pb_migrations/0001_initial_schema.js` unless a concrete runtime incompatibility is proven
- `SCHEMA.md` unless a later accepted migration changes the schema
- `CONSTITUTION.md`
- `AGENTS.md`
- Files under `docs/decisions/`
- Files under `docs/subagents/`
- `.DS_Store` files

## Done-When Criteria

Immediate handoff task is done when:

- `docs/runbooks/current-handoff.md` exists.
- It captures the current phase, accepted migration result, approved flags, runtime notes, next task, scope boundaries, and done-when criteria.
- No frontend files are changed.
- No schema or migration logic is changed.

Next migration-commit task is done when:

- `pocketbase/pb_migrations/0001_initial_schema.js` is committed.
- The commit excludes `.DS_Store` noise unless intentionally handled separately.
- `git status --short` shows no unexpected staged files.
