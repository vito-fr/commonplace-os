# System Constitution

This is the root governance document for the archive. Every architectural decision in this repo descends from here. When this file conflicts with anything else, this file wins until it is explicitly amended.

Amendments require an ADR in `docs/decisions/` and a stop-and-ask before any code change.

---

## 1. Purpose

A personal-first, business-extensible archive for visual and text-based marketing and creative work. The system supports the full lifecycle of creative content: capture, contextualize, connect, retrieve, reuse, retire.

It is not a Pinterest clone. It is not a Notion clone. It is not a generic asset library. The core differentiator is the combination of:

- A unified item graph spanning images, captions, notes, links, and campaigns
- Typed relationships that survive lifecycle transitions
- Marketing-aware lifecycle states (inbox → triaged → active → archived → retired)
- Quarantined imports and provenance-tracked AI enrichment
- A workspace model that scales from solo to team without retrofit

Anything that does not serve the core loop — capture, contextualize, connect, retrieve, reuse — is out of scope.

## 2. Atomic unit

The atomic unit is the **item**. Every piece of content in the system — image, caption, note, link, campaign — is a row in `items`, distinguished by a `type` discriminator and extended by a type-specific table (`items_image`, `items_caption`, `items_note`, `items_link`, `campaign_profiles`).

Rationale: anything that can be meaningfully linked into the graph must be queryable through the same lens. Splitting campaigns or captions into separate top-level entities forces every cross-domain query into a UNION and fragments lifecycle and event logging.

See `docs/decisions/0001-atomic-unit.md`.

## 3. Core tables

The schema is organized into eight families:

1. **Tenancy** — `workspaces`, `sources`
2. **Items** — `items` plus type extensions (`items_image`, `items_caption`, `items_note`, `items_link`, `campaign_profiles`)
3. **Graph** — `relationship_types` (registry), `relationships`
4. **Organization** — `tags`, `item_tags`, `collections`, `collection_items`
5. **AI** — `ai_annotations`
6. **History** — `item_events`
7. **Hygiene** — `banned_phrases`
8. **Future** — reserved for cross-workspace sharing, deferred until first business workspace

Full schema in `SCHEMA.md`.

## 4. Type-specific extension tables

Extension tables hold fields that exist for one type only. Shared concerns (workspace, status, source, timestamps, title) live on `items`. Examples:

- `items_image` — file_ref, dimensions, dominant_colors, ocr_text, perceptual_hash
- `items_caption` — body, tone, cta_type, length_chars
- `items_note` — body, format
- `items_link` — url, og_metadata, fetched_at, content_type
- `campaign_profiles` — phase, channel, start_at, end_at, brief, kpi_summary

A new item type requires: a new extension table, a registry entry, a stop-and-ask, and an ADR.

## 5. Relationship model

A relationship is a single row in `relationships`. Symmetric types use canonical ordering (`from_id < to_id` by lexicographic ID comparison) enforced at the database level. Reverse edges are not materialized.

Columns: `id, workspace_id, from_id, to_id, type, weight, metadata (JSON), note, asserted_by, created_at`.

Type semantics live in `relationship_types`, a small reference table whose contents are mirrored in `docs/relationships.md`. Adding or modifying a type is a stop-and-ask.

Initial types: `inspired_by`, `references`, `derived_from`, `annotates`, `used_in`, `retired_by`, `contradicts` (symmetric), `visually_similar_to` (symmetric).

See `docs/decisions/0004-relationship-model.md`.

## 6. Lifecycle model

Every item carries a `status` in {`inbox`, `triaged`, `active`, `archived`, `retired`}. Transitions are recorded in `item_events`.

- `inbox` — newly captured or imported. Invisible from main views. AI may enrich freely.
- `triaged` — reviewed by a human; minimal metadata applied. Eligible for promotion.
- `active` — in canonical use. Surfaces in default search and graph views.
- `archived` — out of active rotation, kept for reference and history.
- `retired` — superseded or dead. May carry a `retired_by` relationship to a replacement.

Collections and campaigns are orthogonal to status. An item can be `archived` and still belong to a "Fall24 references" collection. Status answers "is this in active use"; collections answer "what does this belong with."

## 7. Import quarantine

Every imported item enters with `status='inbox'` regardless of source. Imports are idempotent on `(workspace_id, source_type, source_id)`. Re-import updates fields and increments `update_count`; it never duplicates. Inbox items are excluded from default search, graph rendering, and main browsing views.

Triage promotes items out of inbox. The triage action may include any combination of: applying tags, assigning collection memberships, attaching to a campaign, approving or rejecting AI annotations, advancing status.

See `docs/subagents/import.md`.

## 8. AI metadata model

Canonical fields on `items` and extension tables are **human-authored only**. AI subagents never write to canonical fields under any circumstance.

AI output lives in `ai_annotations`:

- `id, item_id, workspace_id, field_name, payload (JSON), model_name, model_version, prompt_version, confidence, review_status, reviewed_by, reviewed_at, created_at, superseded_at`

`field_name` namespaces the annotation type (`tags`, `description`, `summary`, `visual_dna`, `ocr_text`, `color_palette`, `semantic_neighbors`, etc.). `payload` is JSON shaped by `field_name`. New annotation types require a registry entry but no schema migration.

`review_status` cycles: `pending` → `approved` | `rejected` | `superseded`. Approved annotations may be promoted to canonical fields only by an explicit user action that creates a corresponding human-authored value. Promotion does not delete the annotation; it links the canonical value to its origin.

Anti-slop enforcement is mandatory and layered:

1. Banned phrase blocklist, loaded by every AI subagent at run start. See `docs/anti-slop/banned-phrases.md`.
2. Tag vocabulary lock. AI may apply tags with `status='approved'`; AI-proposed new tags enter as `status='pending'` and are not searchable until approved.
3. Length cap. AI-generated `description` payloads are capped at 140 characters. AI-generated `summary` payloads at 280.

See `docs/decisions/0003-ai-metadata.md`.

## 9. Workspace and privacy model

Every tenant-scoped table carries `workspace_id` from day one. There is no path that forgets it. The default workspace is `personal`. Cross-workspace sharing is deferred until the first business workspace exists; when introduced, it will use a relationship type, not a permissions retrofit.

Privacy is resolved by two-tier inheritance: `sources` carry a `default_privacy_level`; items inherit unless they explicitly override via `privacy_level`. Resolution happens in application code, not in views.

See `docs/decisions/0005-workspaces-and-privacy.md`.

## 10. Events

`item_events` is the system's audit log and the foundation of hygiene queries. Every state change of consequence is logged.

Event types: `imported`, `status_changed`, `collection_added`, `collection_removed`, `campaign_attached`, `campaign_detached`, `relationship_added`, `relationship_removed`, `annotation_added`, `annotation_approved`, `annotation_rejected`, `annotation_superseded`, `tagged`, `untagged`, `exported`, `used`, `retired`.

Columns: `id, workspace_id, item_id, event_type, actor, metadata (JSON), created_at`.

Without complete event coverage, the hygiene subagent and lifecycle reports cannot function. Skipping event writes during a sprint is a stop-and-ask.

## 11. Stop-and-ask rules

Claude Code must enter plan mode and request explicit approval before any of the following:

- Any schema change (new column, new table, type change, constraint change)
- Dropping a column or table
- Adding a new item type
- Adding or modifying a relationship type
- Adding or modifying a `field_name` namespace in `ai_annotations`
- Installing a new dependency
- Refactoring more than five files in a single pass
- Deleting tests
- Modifying `CONSTITUTION.md`, `CLAUDE.md`, or any file in `docs/decisions/`
- Touching anything in `migrations/`
- Changing a subagent's authority, write scope, or invocation rules
- Bulk operations affecting more than fifty rows
- Promoting an AI annotation to a canonical field outside the standard user-action path

Full triggers and operating protocol in `CLAUDE.md`.

## 12. Subagents

**In scope now:**

- `import` — fetches from sources, writes inbox items idempotently
- `ai-enrichment` — generates annotations into `ai_annotations`, never writes canonical
- `hygiene` — read-only; produces reports on staleness, duplicates, inbox debt, retired-without-replacement, overuse

**Out of scope now:**

- Caption generation, copywriting, or any creative authoring subagent (taste corruption risk; captions are IP)
- Schema modification subagents (humans + plan mode only)
- Graph editing subagents (hygiene reports yes; automated edits no)
- Meta-orchestrators (premature at solo scale)

Subagent contracts live in `docs/subagents/`.

## 13. Files this constitution depends on

- `CLAUDE.md` — operating protocol for Claude Code
- `SCHEMA.md` — current schema reference
- `docs/relationships.md` — relationship type registry
- `docs/anti-slop/banned-phrases.md` — initial blocklist and editing rules
- `docs/decisions/0001-atomic-unit.md` through `0005-workspaces-and-privacy.md` — ADRs
- `docs/subagents/import.md`, `ai-enrichment.md`, `hygiene.md` — subagent contracts
- `migrations/` — sequential SQL migrations (created during implementation)

## 14. Open questions deferred to implementation

These are intentionally not resolved in this document. Resolve via ADR before the relevant sprint:

- Concrete `payload` schemas per `field_name` in `ai_annotations`
- Whether `tags` are a separate table or a JSON array on items (schema cost vs. query cost)
- Embedding storage layout in `sqlite-vec` and which fields drive vectors
- Export formats and what counts as an `exported` event
- What "use" means as a user action and how it is captured

---

*Last updated: 2026-04-27. Amendments require ADR and stop-and-ask.*
