# AGENTS.md

Operating protocol for Codex in this repo. Read this file first every session. This file is the Codex-facing entry point for the project. It complements, but does not replace, the deeper governance and architecture documents already in the repo.

---

## Project

This repo is the v0.1 build of Vita’s visual archive / knowledge graph platform.

It is a desktop-first research and operations instrument for capture, inspect, connect, retrieve, reuse, retire, and campaign memory. The active design driver is the marketing lifecycle case. The polymath / personal-knowledge use case remains supported, but it is a subset.

---

## Authority order

If documents appear to conflict, follow this order unless explicitly told otherwise:

1. `AGENTS.md`
2. `CONSTITUTION.md`
3. `SCHEMA.md`
4. `UI_ARCHITECTURE.md`
5. `docs/runbooks/m0.1-plan.md`
6. `docs/scope/*.md`
7. `docs/decisions/*.md`
8. `PLANNING_AUDIT.md`
9. `README.md`

If there is still ambiguity, stop, summarize the conflict, and ask before writing.

---

## Current phase

Current milestone: **M0.1 planning-to-first-migration boundary**.

The planning document already exists at:

- `docs/runbooks/m0.1-plan.md`

The next intended implementation step is:

- `pocketbase/pb_migrations/0001_initial_schema.js`

Do not widen scope beyond that unless explicitly instructed.

---

## Current approved decisions

These four flags are already approved and should be treated as active project decisions:

- **F-1 approved** — include `rights_status`, `rights_note`, and `rights_reviewed_at` in the initial migration, then update `SCHEMA.md` after.
- **F-2 approved** — enforce symmetric relationship ordering via a `BEFORE INSERT` trigger rather than a `CHECK` constraint.
- **F-3 approved** — scaffold the `embeddings` table now with a vector `BLOB` placeholder.
- **F-4 approved** — use FTS5 external content mode with sync triggers.

Do not re-litigate these decisions unless a later instruction explicitly reopens them.

---

## Stack

- Backend: PocketBase (single Go binary, embedded SQLite)
- Frontend: Vite + React + BlockNote
- Embeddings: Ollama (`nomic-embed-text`) + `sqlite-vec`
- Graph: `react-force-graph-2d` + Graphology
- Backup: Litestream → Cloudflare R2
- Network: Tailscale → Hetzner VPS
- Capture: PWA + iOS Shortcuts + forked linkding-extension

---

## Hard rules — never violate, never request override

1. AI subagents never write to canonical fields on `items` or extension tables. AI output goes to `ai_annotations`.
2. AI subagents never write to a row whose `status != 'inbox'` without going through the suggestion / annotation path.
3. Every query against tenant-scoped tables filters by `workspace_id`. There are no exceptions for "personal use" — the default workspace is still `personal`, and the filter still applies.
4. Imports always set `status='inbox'`. They never write `triaged`, `active`, `archived`, or `retired`.
5. Imports are idempotent on `(workspace_id, source_type, source_id)`. Duplicates are a bug, not a feature.
6. State changes log to `item_events`. No silent state mutation.
7. Symmetric relationships are stored once with canonical ordering (`from_id < to_id`). Never insert both directions.
8. Banned phrases (see `docs/anti-slop/banned-phrases.md`) are stripped from AI output before write. Loading the list is a precondition of any AI subagent run.
9. For seed fixtures, use structural redacted placeholders only unless real or explicitly redacted source content is provided. Never invent realistic production-like content.

---

## UI hard rules — never violate, never request override

These are the durable rules. The full UI architecture lives in `UI_ARCHITECTURE.md` and `docs/ui-principles.md`. Component contracts live in `docs/component-rules.md`.

1. No generic SaaS dashboard. No KPI cards, no insight widgets, no welcome banners. The product is a research instrument, not a metrics surface.
2. No table-first product identity. Tables are tools, never the home view. Default surfaces are masonry-first.
3. No fake analytics, no manufactured insights, no "AI noticed..." prompts. Counts appear only as actionable hooks.
4. Every UI element must serve at least one of: capture, inspect, connect, retrieve, reuse, retire, campaign memory. If it does not, it does not ship.
5. Every item card carries the four-signal row at all times: type, status, source, optional usage. Never hover-only, never collapsed, never omitted.
6. Every AI-rendered string carries a `ProvenanceMark` showing model name, version when available, confidence when available, and review status. AI content never appears visually equivalent to canonical content.
7. Rights warnings render at every campaign-attachment flow when applicable. `restricted` and `expired` items hard-block attachment. Overrides on advisory states require a note and log an event.
8. Desktop is the primary surface. Density wins. Mobile supports capture, browse, single-item triage, and search, with minimal compromise to desktop.
9. No hover-only core actions. Triage, retire, attach to campaign, attach to collection, and advance status are always visible.
10. No unlabeled mystery icons. No decorative graph theater.

---

## Stop-and-ask triggers

Enter plan mode and request explicit approval before:

- Any schema change (column, table, type, constraint, index)
- Dropping any column or table
- Adding a new item `type`
- Adding or modifying a row in `relationship_types`
- Adding a new `field_name` namespace for `ai_annotations`
- Installing any dependency
- Refactoring more than five files in one pass
- Deleting any test
- Modifying `CONSTITUTION.md`, `AGENTS.md`, or any file under `docs/decisions/`
- Modifying any file under `docs/subagents/`
- Touching anything in `migrations/` or `pocketbase/pb_migrations/`
- Bulk writes affecting more than 50 rows
- Promoting an AI annotation to canonical outside the standard user-action path
- Adding to `banned_phrases` without an explicit proposal and reason
- Modifying `UI_ARCHITECTURE.md`, `docs/ui-principles.md`, or `docs/component-rules.md`
- Creating a forbidden component class
- Modifying the `ItemCard` four-signal-row contract or the `ProvenanceMark` contract
- Removing or weakening rights warning behavior at any campaign-attachment flow
- Adding any auto-play, auto-advance, or auto-promote behavior in the UI
- Adding any "smart," "auto," "magic," or "AI insight" labeled element
- Rendering item detail in a modal, sheet, or drawer
- Adding a new top-level route
- Bypassing the >30-node graph zoom limit
- Modifying `rights_status` enum values or the rights warning thresholds
- Modifying the lifecycle status enum values

---

## Plan mode

When a stop-and-ask trigger fires:

1. Describe the change in one paragraph.
2. List affected files and tables.
3. Identify reversibility (`easy`, `medium`, `hard`).
4. Identify any cascade — events to log, indexes to update, callers to change.
5. Wait for explicit approval before writing.

When working in Codex, summarize this before making edits rather than assuming approval from prior generic discussion.

---

## Anti-slop rules

1. No abstractions before second use. Build concrete; abstract on the second instance.
2. No new library without an explicit reason existing tools fail. Document the reason in the commit message.
3. No generic dashboard, generic card, generic SaaS UI.
4. Prefer one feature working end to end over five features at 60%.
5. Never silently change the data model.
6. Never rename a schema field without a migration plan.
7. Never generate fake sample data that hides real design problems. Use real fixtures or no fixtures.
8. Never apply vague tags (`cool`, `modern`, `aesthetic`, `inspiration`) unless explicitly requested by the user.
9. Always run build and typecheck after a code change. A red build is a stop condition.
10. When rule 1 collides with rule 4, rule 4 wins.

---

## Working rules for Codex

1. Read `AGENTS.md` first, then load only the minimum additional docs needed for the current task.
2. Prefer grounded repo context over assumptions.
3. Before editing, state which docs were used.
4. Before editing, state any ambiguity that remains.
5. Keep diffs minimal and reviewable.
6. Do not widen scope from the requested task.
7. Do not silently "clean up" unrelated code.
8. If a requested change implies schema drift from `SCHEMA.md`, say so explicitly.
9. If prior planning and current docs diverge, stop and ask.
10. Treat repo docs as the durable memory layer. Chat history is secondary.

---

## Immediate task boundary

Unless the user says otherwise, the current task boundary is:

- read `docs/runbooks/m0.1-plan.md`
- cross-check against `SCHEMA.md`, `CONSTITUTION.md`, and `PLANNING_AUDIT.md`
- write `pocketbase/pb_migrations/0001_initial_schema.js`
- do not initialize the frontend
- do not modify unrelated files

Before writing the migration, summarize:

1. the docs used
2. any remaining ambiguity
3. any schema drift introduced by the approved flags

---

## Subagent invocation

Subagents are defined in `docs/subagents/`. Each one has a fixed scope, fixed write authority, and a fixed output format. Do not invoke a subagent outside its defined scope.

In scope:

- `import`
- `ai-enrichment`
- `hygiene`

Out of scope:

- caption / copy generation
- schema modification
- graph editing
- meta-orchestration

---

## Session summary format

At the end of every session, append to `docs/sessions/YYYY-MM-DD.md`:

```md
## Session {timestamp}

### Files changed
- path/to/file.ts (+N -M)
- ...

### Schema changes
none | yes — see migrations/000X_*.sql

### Tests
ran: yes | no
result: pass | fail (details)

### Unresolved questions
- ...

### Followups for next session
- ...
```

No prose. No celebration. No restating what is already in the diff.

---

## Forbidden in long context

Do not load unless explicitly needed:

- superseded schema versions
- the earlier Next.js + Supabase + Postgres exploration
- notes from closed sprints
- content from `docs/sessions/` older than the current week

---

## Pointers

- Identity and architecture: `CONSTITUTION.md`
- Schema reference: `SCHEMA.md`
- Relationship type registry: `docs/relationships.md`
- Anti-slop blocklist: `docs/anti-slop/banned-phrases.md`
- ADRs: `docs/decisions/`
- Subagent contracts: `docs/subagents/`
- UI architecture: `UI_ARCHITECTURE.md`
- UI principles: `docs/ui-principles.md`
- Component rules: `docs/component-rules.md`
- Planning audit and v1 readiness: `PLANNING_AUDIT.md`
- Current implementation plan: `docs/runbooks/m0.1-plan.md`
