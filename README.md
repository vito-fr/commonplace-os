# pocketbase/

The PocketBase backend for the archive. Single-binary backend with an embedded SQLite database, a JS migration system, and a JS hook system for server-side logic.

This folder is self-contained: everything the backend needs to run lives here.

---

## Layout

```
pocketbase/
├── README.md           This file.
├── pocketbase          The binary itself. Gitignored. Downloaded during M0.1 setup.
├── pb_data/            Runtime database, files, logs. Gitignored.
├── pb_migrations/      Committed JS migrations — source of truth for schema.
└── pb_hooks/           Committed JS server hooks — backend logic.
```

`SCHEMA.md` at the repo root is the human-readable mirror of `pb_migrations/`. When they diverge, `pb_migrations/` wins as the source of truth, and `SCHEMA.md` is updated to match.

---

## Local setup (M0.1)

PocketBase version, install steps, admin user creation, and the first migration are all defined in the M0.1 implementation plan. The plan is reviewed line-by-line before any code or migration is committed.

When the plan is approved, the steps to follow live in `docs/runbooks/m0.1-plan.md`.

---

## Migrations

Every schema change is a numbered JS migration in `pb_migrations/`. Migration files are NEVER edited after they have been run on any environment. A correction to a prior migration is a new migration that supersedes the old one.

Migrations are stop-and-ask in `CLAUDE.md`. Adding, removing, modifying any migration triggers plan mode. The migration text is reviewed line-by-line before commit.

The first migration `0001_initial_schema.js` (final filename TBD during M0.1) creates every table from `SCHEMA.md` plus indexes, CHECK constraints, and FK constraints. After it runs, `SCHEMA.md` is verified to match.

---

## Hooks

Server-side logic that enforces invariants at the backend boundary lives in `pb_hooks/`. Hooks complement the schema's CHECK constraints — they catch what SQL constraints can't.

Examples of v0.1 hooks (final list defined during M1.1+):

- `import.pb.js` — URL fetch on item creation, OG metadata extraction, content-type classification
- `relationships.pb.js` — symmetric relationship CHECK enforcement (belt-and-braces with the schema constraint)
- `events.pb.js` — automatic event logging for status transitions when not handled by the client

Hooks do NOT duplicate UI logic. They enforce data invariants. If a rule should fire regardless of which client is making the request, it lives in a hook. If a rule is about user experience, it lives in the frontend.

---

## Running PocketBase

```bash
cd pocketbase
./pocketbase serve
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
