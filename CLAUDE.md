# CLAUDE.md

Operating protocol for Claude Code in this repo. Read every session. If you are an AI assistant working in this repo, this file plus `CONSTITUTION.md` define your scope.

---

## Stack

- Backend: PocketBase (single Go binary, embedded SQLite)
- Frontend: Vite + React + BlockNote
- Embeddings: Ollama (`nomic-embed-text`) + `sqlite-vec`
- Graph: `react-force-graph-2d` + Graphology
- Backup: Litestream → Cloudflare R2
- Network: Tailscale → Hetzner VPS
- Capture: PWA + iOS Shortcuts + forked linkding-extension

## Hard rules — never violate, never request override

1. AI subagents never write to canonical fields on `items` or extension tables. AI output goes to `ai_annotations`.
2. AI annotations remain `review_status='pending'` until human review. There is no auto-approval path.
3. Every query against tenant-scoped tables filters by `workspace_id`. There are no exceptions for "personal use" — the default workspace is still `personal`, and the filter still applies.
4. Imports and uploads land at `status='active'`.
5. Imports are idempotent on `(workspace_id, source_type, source_id)`. Duplicates are a bug, not a feature.
6. State changes log to `item_events`. No silent state mutation.
7. Symmetric relationships are stored once with canonical ordering (`from_id < to_id`). Never insert both directions.
8. Banned phrases (see `docs/anti-slop/banned-phrases.md`) are stripped from AI output before write. Loading the list is a precondition of any AI subagent run.

## UI hard rules — never violate, never request override

These are the durable rules. The full UI architecture lives in `UI_ARCHITECTURE.md` and `docs/ui-principles.md`. Component contracts live in `docs/component-rules.md`. The ten rules below are read every session.

1. No generic SaaS dashboard. No KPI cards, no insight widgets, no welcome banners. The product is a research instrument, not a metrics surface.
2. No table-first product identity. Tables are tools (hygiene reports, settings, bulk audit), never the home view. Default surfaces are masonry-first.
3. No fake analytics, no manufactured insights, no "AI noticed..." prompts. Counts appear only as actionable hooks ("12 items in inbox >14 days → triage").
4. Every UI element must serve at least one of: capture, inspect, connect, retrieve, reuse, retire, campaign memory. If it doesn't, it doesn't ship.
5. Every item card carries the four-signal row at all times: type, status, source, optional usage. Never hover-only, never collapsed, never omitted.
6. Every AI-rendered string carries a `ProvenanceMark` showing model name, version when available, confidence when available, and review status. AI content never visually equivalent to canonical content.
7. Rights warnings render at every campaign-attachment flow when applicable. `restricted` and `expired` items hard-block attachment. Overrides on advisory states require a note and log an event.
8. Desktop is the primary surface. Density wins. Mobile renders capture, browse, single-item triage, and search — and almost nothing else. No mobile-first compromises that weaken desktop.
9. No hover-only core actions. Triage, retire, attach to campaign, attach to collection, advance status are always visible. Hover may reveal secondary affordances only.
10. No unlabeled mystery icons. No decorative graph theater (no 3D, no force animation by default, no >30-node hairballs, no glowing nodes). Every icon has a label or unambiguous convention.

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
- Modifying `CONSTITUTION.md`, `CLAUDE.md`, or any file under `docs/decisions/`
- Modifying any file under `docs/subagents/`
- Touching anything in `migrations/`
- Bulk writes affecting more than 50 rows
- Promoting an AI annotation to canonical outside the standard user-action path
- Adding to `banned_phrases` (allowed, but propose with reasoning, never extend silently)
- Modifying `UI_ARCHITECTURE.md`, `docs/ui-principles.md`, or `docs/component-rules.md`
- Creating a forbidden component class (see `docs/component-rules.md` for the named list — KPICard, InsightCard, MetricTile, DashboardWidget, ItemDetailModal, etc.)
- Modifying the `ItemCard` four-signal-row contract or the `ProvenanceMark` contract
- Removing or weakening rights warning behavior at any campaign-attachment flow
- Adding any auto-play, auto-advance, or auto-promote behavior in the UI
- Adding any "smart," "auto," "magic," or "AI insight" labeled element
- Rendering item detail in a modal, sheet, or drawer (item detail is always a route)
- Adding a new top-level route
- Bypassing the >30-node graph zoom limit
- Modifying `rights_status` enum values or the rights warning thresholds
- Modifying the lifecycle status enum values

## Plan mode

When a stop-and-ask triggers:

1. Describe the change in one paragraph.
2. List affected files and tables.
3. Identify reversibility (easy / medium / hard).
4. Identify any cascade — events to log, indexes to update, callers to change.
5. Wait for explicit approval before writing.

Plan-mode output is appended to the current session log under a `## Plan` heading.

## Anti-slop rules

1. No abstractions before second use. Build concrete; abstract on the second instance.
2. No new library without an explicit reason existing tools fail. Document the reason in the commit message.
3. No generic dashboard, generic card, generic SaaS UI. Every view earns its existence by serving the core loop.
4. Prefer one feature working end to end over five features at 60%.
5. Never silently change the data model.
6. Never rename a schema field without a migration plan.
7. Never generate fake sample data that hides real design problems. Use real fixtures or no fixtures.
8. Never apply vague tags (`cool`, `modern`, `aesthetic`, `inspiration`) unless explicitly requested by the user.
9. Always run build and typecheck after a code change. A red build is a stop condition.
10. When rule 1 (no premature abstractions) collides with rule 4 (one strong feature), rule 4 wins.

## Subagent invocation

Subagents are defined in `docs/subagents/`. Each one has a fixed scope, fixed write authority, and a fixed output format. Do not invoke a subagent outside its defined scope.

In scope: `import`, `ai-enrichment`, `hygiene`.
Out of scope: caption / copy generation, schema modification, graph editing, meta-orchestration.

## Session summary format

At the end of every session, append to `docs/sessions/YYYY-MM-DD.md`:

```
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

No prose. No celebration. No restating what's already in the diff.

## Forbidden in long context

Do not load:

- Superseded schema versions
- The earlier Next.js + Supabase + Postgres exploration
- Notes from sprints that have been closed
- Any content from `docs/sessions/` older than the current week unless explicitly asked

The polymath-archive framing from earlier project memory is not deprecated — this system is intended to support both creative-marketing and personal-knowledge use cases through the same core. But the marketing lifecycle (campaigns, retired_by, captions as IP) is the active design driver. When in doubt, design for the marketing case; the polymath case is a subset.

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
