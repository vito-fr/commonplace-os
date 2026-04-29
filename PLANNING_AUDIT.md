# Planning Integration Audit

Final pre-scope audit. Blunt. Opinionated. Ends in a verdict.

This document is not a constitution amendment. It is a checkpoint: confirms what is decided, names what is not, identifies what blocks v1 scope, and produces a clean handoff to the next stage.

---

## 1. Final product definition

**What we are building now (v1):**

A visual research instrument with campaign memory underneath. A single-user, single-workspace tool that captures images, captions, notes, links, and campaigns from external sources; stores them with provenance; connects them via a typed graph; and tracks the lifecycle from inbox to retirement. The first stress test is marketing/creative work because it demands fast capture, image-first browsing, source provenance, AI enrichment without slop, campaign memory, and retirement of overused assets.

**What it can become later:**

A company memory system. Multi-workspace, multi-user, with team roles, approval workflows, cross-workspace references, semantic and visual search, license tracking with expiry, and a curator layer that synthesizes the archive nightly. Marketing is one demanding case among several — research, product, brand, support archives all map onto the same primitives.

**Why v1 is marketing/creative-led but not marketing-only:**

Marketing/creative work is the most demanding pressure test of the core primitives:

- It demands fast capture (campaigns die without it)
- It demands image-first browsing (asset libraries are visual)
- It demands campaign memory (used / retired / replaced is meaningful history)
- It demands strict AI provenance (caption IP cannot be polluted)
- It demands lifecycle visibility (overused assets must be retirable)

If the system survives marketing work, it survives most other knowledge work. Marketing is the load test, not the destination.

**What we are explicitly NOT building in v1:**

- Multi-user features (sharing, permissions beyond owner-only, real-time collaboration)
- Cross-workspace references
- Semantic text search (embeddings)
- Visual similarity search (perceptual hashing beyond dedup, vector image search)
- OCR pipeline as automated enrichment
- Approval workflows beyond AI annotation review
- Team roles (Editor, Reviewer, Viewer)
- License expiry monitoring
- Automated rights enforcement
- A second workspace
- The curator/synthesis nightly layer (Sprint 11+)
- GitNexus or codebase intelligence
- Mobile-first triage (mobile is capture + browse only)
- Browser-extension import beyond URL-paste fallback
- Pinterest/Are.na real API import (URL-paste fallback first)

**Lock-in:** The product memory will record this as the active definition. The earlier polymath / second-brain framing is preserved as a future use case but is not the design driver for v1.

---

## 2. Architecture reconciliation

| Decision | Verdict | Why | v1 consequence |
|---|---|---|---|
| Item as atomic unit | **Keep** | Foundational. Reverses badly. Constitution-locked. | Single `items` table; type extensions; all graph/event/annotation primitives reference `items.id`. |
| Campaigns as items with `campaign_profiles` | **Keep** | Anything in the graph is an item. Campaign-as-separate-table forces UNION queries forever. | `type='campaign'` + extension table; campaign UI joins both. |
| Captions as first-class items | **Keep** | Captions are reusable IP in marketing. Embedding them on images destroys reuse queries. | `type='caption'` + `annotates` relationship to images. |
| Collections as thinking surfaces | **Keep, sharpen language** | Collections are organizational, not containment. An item can belong to many. Distinct from campaigns (participatory) and tags (vocabulary). | `collections` + `collection_items` junction. |
| Relationships as one-row graph edges | **Keep** | Symmetric types canonical-ordered, single row. Reverse edges never materialized as source of truth. | `relationships` table with `trg_relationships_symmetric_ordering`; `relationship_types` registry. |
| AI annotations / suggestions separation from canonical | **Keep** | The most important rule in the system. AI never writes canonical. Provenance always recorded. | `ai_annotations` table with model/version/prompt/confidence/review_status. |
| Event history | **Keep, expand** | Without complete events, hygiene queries collapse and audit becomes impossible. | `item_events` covers status changes, collection adds/removes, campaign attach/detach, relationship lifecycle, annotation lifecycle, imports, exports, uses, retirements. |
| Workspace + privacy model | **Keep, defer cross-workspace** | `workspace_id` on day one is the single most expensive retrofit avoided. Privacy is advisory, not enforced. | All tenant-scoped tables carry `workspace_id`; default `personal` workspace seeded. |
| Import quarantine | **Keep** | Inbox-as-status is the spine of the lifecycle. Without quarantine, the archive is a junk drawer. | Imports default to `status='inbox'`; idempotent on `(workspace_id, source_type, source_id)`. |
| Semantic + visual search | **Defer to v1.5** | Vector scaffolding required now to avoid migration pain; query layer waits. | Schema includes an empty `embeddings` table with `vector BLOB` placeholder storage; UI does not expose semantic/visual search yet. |
| GitNexus / codebase intelligence | **Defer indefinitely** | Not a product primitive. Out of scope until use case demands it. | No schema impact. Removed from active planning. |

**One revision worth making explicit:** "Collections as thinking surfaces" — sharpen the language to: *Collections are organizational primitives orthogonal to lifecycle status. They group items by user-defined affinity. They are not containers, not folders, and not the same as campaigns.* This kills the recurring question "should this be a collection or a campaign?"

---

## 3. Governance layer (new — most of this has not been decided yet)

### Metadata standards

Every item in v1 must carry: `type`, `status`, `workspace_id`, `created_at`, `updated_at`. Source-derived items must carry `source_id` and `source_external_id`. Optional but encouraged at v1: `title`, at least one tag, `privacy_level` (or inherit from source).

A field is "required" only if the schema enforces it. Soft conventions documented but not enforced are ignored within a sprint. Either NOT NULL it or remove it from the standard.

### Controlled vocabulary / tag governance

Approved-tag vocabulary lock from ADR 0003 stands. v1 governance additions:

- New tags proposed by AI enter `status='pending'` and are not searchable
- New tags created by the user enter `status='approved'` directly
- Tags can be merged (a "rename / merge" action that reassigns `item_tags` rows and logs an event)
- Tags can be deprecated (`status='rejected'`) without deleting their item links — the link remains, the tag stops appearing in autocomplete
- The hygiene subagent flags `pending` tags older than 30 days and `approved` tags unused for 180 days

### Naming conventions

- **Item titles:** human-authored, free-form. Not enforced. AI may suggest titles via `field_name='title'` annotation.
- **Tag names:** lowercase, no spaces (use hyphens), no leading/trailing whitespace. Enforced at insert.
- **Collection names:** free-form, but hygiene subagent flags duplicates differing only by case or whitespace.
- **Campaign names:** free-form. Recommend a date prefix (e.g., "2026-Q2 Spring Drop") but not enforced.
- **Source identifiers:** stable per source kind (Pinterest pin ID, Are.na block ID, normalized URL hash for arbitrary URLs, SHA-256 for local files).
- **File references:** PocketBase-managed; never user-named.

Naming convention violations are not blocking errors. They are hygiene flags.

### Roles and permissions

v1 has one role: **Owner.** Single user, owns everything in their workspaces.

The schema accommodates more roles via a `workspace_members(workspace_id, user_id, role)` table that does not exist in v1 but is reserved for v1.5+. Roles when introduced: Owner, Admin, Editor, Reviewer, Viewer, Agent.

AI subagents have **Agent**-equivalent authority through their definition files (`docs/subagents/*.md`), not through database role rows. This stays this way until multi-user.

### Asset ownership

Every item is owned by its workspace. Sub-ownership (which user within a workspace owns this) is deferred. v1 = workspace-level ownership only.

### Approval rights

Three approval surfaces in v1:

- **AI annotations** — Owner approves/rejects via the suggestions queue
- **Pending tags** — Owner approves/rejects via the tag governance UI
- **Re-import canonical conflict** — when re-import would overwrite a user-edited canonical field, the system stops and the Owner decides

Multi-step approval workflows (e.g., editor proposes → reviewer approves → admin publishes) are deferred to v1.5+.

### Lifecycle authority

Status transitions are Owner-authored. Subagents log events but never advance status. The UI exposes status transitions explicitly; there is no auto-promotion based on activity.

The single exception: imports auto-set `status='inbox'`. This is not authority, it's the entry point.

### Versioning

See section 6. v1 versioning: minimal, via `update_count` on items, `superseded_at` on annotations, and `retired_by` relationships for asset replacement. No file-level version history in v1.

### Source / provenance requirements

Every item from an external source MUST carry `source_id` and `source_external_id`. Manual / paste captures get a `manual` source row. There is no item without a source — even hand-typed notes get the `manual` source.

This is a v1 hard rule because retrofitting provenance after the fact is hopeless.

### Legal rights and usage restrictions

See section 5. v1 minimum: `rights_status`, `rights_note`, and `rights_reviewed_at` on items. The accepted enum is `unknown`, `reference_only`, `approved_for_internal_use`, `approved_for_external_use`, `restricted`, `expired`. This is just enough that "is this safe to use in a campaign" has a recorded answer.

### License expiry

Deferred to v1.5+. v1 stores `rights_status`; tracking expiration dates and notifying before expiry is not built.

### Audit logs

`item_events` is the audit log. Every consequential action writes an event. Events are append-only — never edited, never deleted (an erroneous event is followed by a corrective event, not removed).

### Backup and retention

See section 11. v1: Litestream → Cloudflare R2 continuous, weekly verified restore test, 30-day point-in-time recovery window. Files (PocketBase-managed) backed up via the same mechanism.

### Periodic hygiene audits

The hygiene subagent runs nightly. Its digest is visible in the home view. Outstanding flags persist until resolved. v1 surfaces 11 reports (see ADR / hygiene subagent definition).

### Documentation ownership

- `CONSTITUTION.md` and ADRs — owned by the Owner. Amendments require an ADR + stop-and-ask.
- `CLAUDE.md`, `SCHEMA.md`, `docs/relationships.md` — operating documents. Updated to match implementation.
- `docs/ui-principles.md`, `docs/component-rules.md` — design documents. Updated when design evolves.
- `docs/sessions/` — auto-generated, never hand-edited.
- `pocketbase/pb_migrations/` — hand-written JS migrations, reviewed before merge.

When tooling and documentation diverge, **tooling wins** and documentation is updated. The reverse is forbidden (no "the doc said this so the code must be wrong" arguments).

---

## 4. Metadata strategy

Eight categories. For each: purpose, examples, who creates, v1-required, AI-suggest, AI-write-direct, schema location.

### Technical metadata

- **Purpose:** Identify the file as a digital object.
- **Examples:** mime type, byte size, image dimensions, duration (for video), perceptual hash, SHA-256 content hash.
- **Created by:** Import subagent or the system on file ingest.
- **v1 required:** Yes for image items (dimensions, mime, perceptual hash). Optional for others.
- **AI suggest:** No.
- **AI write direct:** Yes — this is mechanical extraction, not interpretive enrichment.
- **Schema location:** Type extension tables (`items_image.width`, etc.). Hashes on `items` if shared across types.

### Human descriptive metadata

- **Purpose:** Capture human-authored meaning. Title, description, summary, manual tags.
- **Examples:** `items.title`, `items.description`, `items.summary`, approved tags applied by Owner.
- **Created by:** Owner only.
- **v1 required:** No (but encouraged for items past inbox).
- **AI suggest:** Yes (via `ai_annotations`).
- **AI write direct:** **Never. Hard rule.**
- **Schema location:** Canonical fields on `items` and extensions.

### AI-generated annotations

- **Purpose:** AI's contribution to metadata. Always provenanced. Never canonical.
- **Examples:** AI-suggested tags, descriptions, summaries, OCR text, color palettes, visual DNA, semantic neighbors, relationship suggestions.
- **Created by:** ai-enrichment subagent.
- **v1 required:** No (the system functions without AI enrichment).
- **AI suggest:** Yes — that's the entire purpose.
- **AI write direct:** Yes, into `ai_annotations` only. Never canonical.
- **Schema location:** `ai_annotations` table, namespaced by `field_name`.

### Administrative / governance metadata

- **Purpose:** Track who, when, why for governance.
- **Examples:** `created_at`, `updated_at`, `update_count`, `created_by` (deferred to v1.5+), `last_modified_by` (deferred), workspace, privacy level.
- **Created by:** System.
- **v1 required:** Yes (timestamps + workspace + privacy resolution).
- **AI suggest:** No.
- **AI write direct:** No.
- **Schema location:** Canonical columns on `items`.

### Source / provenance metadata

- **Purpose:** Where did this come from, when, by what mechanism.
- **Examples:** `source_id`, `source_external_id`, source kind, source URL, original-fetched-at, import event in `item_events`.
- **Created by:** Import subagent or manual capture.
- **v1 required:** Yes. Every item has a source (even manual ones).
- **AI suggest:** No.
- **AI write direct:** Yes — the import subagent writes provenance on entry.
- **Schema location:** `sources` table + FK + denormalized `source_external_id` on `items`.

### Lifecycle / event metadata

- **Purpose:** History of state changes and consequential actions.
- **Examples:** Every event type from ADR / `item_events`.
- **Created by:** All subagents and human actions.
- **v1 required:** Yes for the v1 event types listed in section 8.
- **AI suggest:** No (events are records, not suggestions).
- **AI write direct:** Yes — subagents log events for actions they perform.
- **Schema location:** `item_events`.

### Rights / legal metadata

- **Purpose:** Record what we know about usage rights for an asset.
- **Examples:** `rights_status` (unknown / reference_only / approved_for_internal_use / approved_for_external_use / restricted / expired), `rights_note` (free-text origin: "Pinterest, public board, photographer credit unknown"), `rights_reviewed_at`.
- **Created by:** Owner. Imports default to `unknown`.
- **v1 required:** Fields exist; population beyond default `unknown` is encouraged but not enforced.
- **AI suggest:** No (legal status is not AI's call).
- **AI write direct:** No.
- **Schema location:** `items.rights_status`, `items.rights_note`, `items.rights_reviewed_at`.

### Search / indexing metadata

- **Purpose:** What makes an item findable.
- **Examples:** Full-text index over canonical title + description + summary; tag links; status; type; source; collection; campaign.
- **Created by:** System (FTS5 virtual tables, junction tables).
- **v1 required:** Yes.
- **AI suggest:** No (the index is mechanical).
- **AI write direct:** Indirect (AI tags eventually become searchable after approval).
- **Schema location:** `items_fts` (FTS5 virtual table); existing tag/collection/campaign junctions. Vector columns scaffolded but not populated in v1.

---

## 5. Rights and licensing model (v1 = practical, not enterprise)

The archive is legally blind today. Marketing work involves third-party imagery routinely. v1 needs minimum structure so the user can answer "is this safe to use" without manual archaeology.

**v1 model — three columns, soft enforcement at attachment, hard block on the two terminal states:**

| Column | Type | Values |
|---|---|---|
| `items.rights_status` | text, default `unknown` | `unknown` / `reference_only` / `approved_for_internal_use` / `approved_for_external_use` / `restricted` / `expired` |
| `items.rights_note` | text, nullable | Free-form: license URL, photographer credit, agreement reference, expiry note, restriction reason |
| `items.rights_reviewed_at` | timestamp, nullable | When Owner last confirmed rights status |

**Status semantics:**

- `unknown` — the import default. Most Pinterest references will live here. Implies "do not attach to outward-facing campaign work without further review."
- `reference_only` — explicitly captured for inspiration / research. Visible in moodboards, never to be attached to a campaign as primary or supporting without a documented override.
- `approved_for_internal_use` — covered for internal use (decks, briefs, internal references). Not safe for public publication.
- `approved_for_external_use` — covered for public-facing use. Free to attach to live campaigns.
- `restricted` — known to be off-limits (revoked license, contested rights, do-not-use directive). Hard-block on attachment.
- `expired` — license or usage right has lapsed. Hard-block on attachment until renewed.

**Soft UI enforcement at attachment (rendered by `RightsWarning`):**

- **No prompt** — when `rights_status` is `approved_for_internal_use` or `approved_for_external_use`. Or when attaching `reference_only` to a campaign with no public-facing role.
- **Advisory warning** — when `rights_status` is `unknown`, OR `reference_only` being attached at `role='primary'` or `role='supporting'`. The user can override; the override requires a justifying note. Both the warning and the note are logged as event metadata.
- **Hard block** — when `rights_status` is `restricted` or `expired`. No override. The dialog offers two paths: change the rights status (which is itself a logged action), or cancel.

**Other hooks:**

- The hygiene subagent flags `unknown` items used in active campaigns and items whose rights warnings were overridden in the last 30 days.
- Rights status changes log to `item_events` with the old and new status in metadata.
- `rights_reviewed_at` is set every time `rights_status` is updated by the Owner; this is the audit anchor for "when was this last looked at."

**What v1 explicitly does NOT do:**

- Automated license expiry scanning (the user manually transitions to `expired`)
- License document storage / linking
- Per-channel usage restrictions ("licensed for social only")
- Attribution requirement enforcement
- Automated takedown workflows
- Rights propagation to derivative items

These move to v1.5+ when the cost of legal blindness exceeds the cost of building them. Today, three columns + UI flag at attachment + hygiene flag is enough.

---

## 6. Versioning model

**v1 minimum:**

- **Re-imports update in place.** `update_count` increments. No version history is kept. If a Pinterest pin's caption changes, the new caption replaces the old; we don't keep a chain.
- **Replacements are relationships.** When asset B replaces asset A: A gets `status='retired'` and a `retired_by` relationship to B. A's data is preserved. The link is the version trail.
- **Annotations supersede.** When AI generates a new annotation for an existing `(item_id, field_name)`, the old becomes `superseded`. Both rows persist.
- **No file-level version history.** When a user re-uploads a corrected image, options are: (a) update the file_ref in place (no history), (b) create a new item with `derived_from` to the original. v1 ships option (b) as the recommended workflow; option (a) is allowed for cosmetic corrections only.

**What waits:**

- Per-file version chains (v1 → v2 → v3 of the same logical asset, all preserved)
- Auto-generated derivative items for crops / color corrections
- Diff views between versions
- Rollback to a prior version
- Branching versions (variant A / variant B of the same source)

**Decision:** No new schema for versioning in v1. The combination of `update_count`, `retired_by`, `derived_from`, `annotation_superseded` carries us. Watch for pain. Add a `versions` table only when actual workflow demands it.

**Risk:** users will eventually want "show me how this asset evolved." v1 says "look at the `derived_from` relationships and the event timeline." That answer holds for a while.

---

## 7. Roles and permissions model

**v1 = single role: Owner.**

The Owner is a row in a `users` table with PocketBase-managed authentication. The Owner is the workspace creator. All operations are Owner-authored unless logged as `actor='subagent:*'` or `actor='system'`.

**Schema scaffolding for future roles (NOT built in v1):**

- `workspace_members(workspace_id, user_id, role)` — exists in design only; not migrated until v1.5+
- Roles when introduced:
  - **Owner** — full authority, can transfer ownership
  - **Admin** — full authority except transfer / delete workspace
  - **Editor** — can create / edit / triage items, attach to campaigns, propose tags
  - **Reviewer** — can approve / reject AI annotations and pending tags; cannot edit canonical content
  - **Viewer** — read-only
  - **Agent** — represents an AI subagent's authority; defined by subagent contract files, not DB rows

**AI subagent permissions in v1:**

- `import` — writes inbox items, source rows, import events
- `ai-enrichment` — writes `ai_annotations`, pending tags, annotation events
- `hygiene` — read-only

These authorities are defined in `docs/subagents/*.md`, not in a database table. When multi-user arrives, the Agent role becomes a DB row, but the contracts remain authoritative.

**Approval authority in v1:**

- Owner approves AI annotations
- Owner approves pending tags
- Owner resolves re-import canonical conflicts
- No multi-step approval workflows

**Decision:** Owner-only in v1. Don't build the roles table. Schema reservations are docs-only.

---

## 8. Audit and event model — v1 inclusion

| Event | v1 required | Notes |
|---|---|---|
| `created` | **Yes** | Logged on item insert (any source, including manual). |
| `imported` | **Yes** | Logged by import subagent on insert AND on re-import update. |
| `status_changed` | **Yes** | Every transition. From and to are in metadata. |
| `added_to_collection` | **Yes** | Required for hygiene queries. |
| `removed_from_collection` | **Yes** | |
| `added_to_campaign` | **Yes** | Captures role in metadata. |
| `removed_from_campaign` | **Yes** | |
| `relationship_suggested` | **No (v1.5)** | AI-proposed relationships log via `annotation_added` with `field_name='relationship_suggestion'` for v1. |
| `relationship_accepted` | **Yes** (logged as `relationship_added`) | Materialized when user approves a suggestion or creates manually. |
| `relationship_rejected` | **No (v1.5)** | For v1, rejected suggestions are just `annotation_rejected` events. |
| `ai_annotation_created` | **Yes** (logged as `annotation_added`) | |
| `ai_annotation_accepted` | **Yes** (logged as `annotation_approved`) | |
| `ai_annotation_rejected` | **Yes** (logged as `annotation_rejected`) | |
| `exported` | **Yes** | Event logged when item is downloaded, attached to a brief, or otherwise leaves the system in a tracked way. Define what counts as "exported" during implementation. |
| `used` | **Defer or define narrowly** | "Use" is ambiguous. v1 narrow definition: an item is "used" when it is attached to a campaign with role ∈ {primary, supporting} AND the campaign is in `phase='live'`. Logged via `campaign_attached` events; no separate `used` event in v1. |
| `retired` | **Yes** | Logged as a special-case `status_changed` to `retired`, with optional `replaced_by_item_id` in metadata. |
| `restored` | **Yes** | Logged as `status_changed` from `retired` or `archived` back to `active`. |
| `deleted` | **Yes** | Logged BEFORE the row is deleted. The event survives the deletion. |

**Two consolidations:**

1. The events list above conflates user-input names with internal storage names. Storage names use the schema's existing event_type strings (`status_changed`, `annotation_added`, etc.). The "v1 required" column maps user-facing concepts to those storage strings.
2. `used` as a distinct event is deferred. v1 derives "use" from `campaign_attached` events filtered by phase. Adding a separate event later is non-disruptive (events are append-only).

**Decision:** Event coverage is sufficient for v1. The audit log will support the hygiene reports defined in `docs/subagents/hygiene.md`.

---

## 9. Search and retrieval readiness

**v1 search capabilities:**

- **Full-text search** over canonical title + description + summary — SQLite FTS5 virtual table. Tag search uses the normalized `tags` / `item_tags` tables.
- **Tag search** — exact match, autocomplete from approved vocabulary.
- **Source filter** — by source id or source kind.
- **Status filter** — single or multi-select.
- **Type filter** — image / caption / note / link / campaign.
- **Collection filter** — by collection id.
- **Campaign filter** — by campaign id (queries `relationships` where `to_id` is the campaign and `type='used_in'`).
- **Negative + temporal filters** — "tagged X but not used in N days," "in inbox >M days." Driven by `item_events`.
- **Relationship/backlink navigation** — from any item detail, click into related items by relationship type.

**v1 search NOT included (deferred to v1.5+):**

- Semantic text search (embedding similarity)
- Visual similarity search (perceptual hash for dedup is computed; visual search UI is not)
- Image-to-image search via vector index
- OCR-driven search of in-image text
- Hybrid ranking (full-text + semantic + tag scoring)
- Natural-language query layer ("show me what I captured for the Spring campaign last year")

**Schema scaffolding required NOW so v1.5 doesn't pay migration cost:**

1. **An `embeddings` table** with `(item_id, field_name, model_name, model_version, vector)` — empty in v1, populated when semantic search ships. M0.1 stores `vector` as `BLOB NOT NULL` placeholder storage.
2. **A `perceptual_hash` column on `items_image`** (already specced in SCHEMA.md) — populated on import, used for dedup in v1, used for visual similarity in v1.5+.
3. **A canonical FTS derivation** — M0.1 indexes `items.title`, `items.description`, and `items.summary`. Tags remain structured filters.
4. **Vector storage layout decision** — M0.1 accepted `BLOB` placeholder storage. Native sqlite-vec column/query details are deferred to v1.5.

**Decision:** v1 search is full-text + tag + structured filter + relationship navigation. Vector scaffolding ships with v1. Vector queries do not.

**Risk:** Users will expect semantic search to "just work" since the marketing materials describe an "AI-assisted archive." Be explicit in product copy: AI is for enrichment, not search, in v1.

---

## 10. UX planning completion audit

| Item | Status |
|---|---|
| `UI_ARCHITECTURE.md` | **Complete.** Created previous turn. |
| `docs/ui-principles.md` | **Complete.** Created previous turn. |
| `docs/component-rules.md` | **NOT created.** Was the next file in the previous turn. **Blocker for scope.** |
| `CLAUDE.md` UI rules merge | **NOT done.** UI rules exist in `UI_ARCHITECTURE.md` but the durable subset has not been integrated into the operating protocol. **Blocker for scope.** |
| Route / view inventory | Present in `UI_ARCHITECTURE.md §4`. **Sufficient.** |
| Component inventory | Present in `UI_ARCHITECTURE.md §21`. Names defined; contracts deferred to `component-rules.md`. **Incomplete pending component-rules.md.** |
| Empty state rules | Present in `UI_ARCHITECTURE.md §17`. **Sufficient.** |
| Desktop / mobile boundaries | Present in `UI_ARCHITECTURE.md §18-19`. **Sufficient.** |
| Card anatomy | Present in `UI_ARCHITECTURE.md §8`. **Sufficient** at architecture level; component-rules.md needs to lock pixel-level contract. |
| Item detail anatomy | Present in `UI_ARCHITECTURE.md §9`. **Sufficient.** |
| Campaign page anatomy | Present in `UI_ARCHITECTURE.md §11`. **Sufficient.** |
| Collection / board anatomy | Present in `UI_ARCHITECTURE.md §10`. **Sufficient.** |
| AI suggestions review UI | Present in `UI_ARCHITECTURE.md §14`. **Sufficient.** |
| Graph view behavior | Present in `UI_ARCHITECTURE.md §12`. **Sufficient.** |
| Search behavior | Present in `UI_ARCHITECTURE.md §13`. **Sufficient.** |

**Two real gaps:**

1. **`docs/component-rules.md` has not been written.** It would contain: forbidden component classes (KPICard, InsightCard, MetricTile, DashboardWidget, ItemDetailModal, etc.), the mandatory four-signal row contract for ItemCard, the ProvenanceMark contract, the EmptyState required-parts contract, hover-vs-always-visible rules, density toggle contract, AI-vs-human visual treatment rules. This is the document Claude Code reads before generating any UI component.
2. **`CLAUDE.md` has not absorbed UI rules.** The durable rules from the UI architecture (e.g., "item detail is always a route, never a modal," "every AI-rendered string carries provenance," "tables are tools, not the home") need to be in the operating protocol so they're enforced at every component-generation pass, not only at design review.

**Both gaps must close before v1 scope. They are short documents, not major work, but they are real and unfinished.**

---

## 11. Operational model

**Backup strategy:**

- **What is backed up:** the full PocketBase SQLite database, all uploaded files (PocketBase-managed), and the contents of `pocketbase/pb_migrations/` and `docs/` (via the git repository, separate concern).
- **Where backups live:** Cloudflare R2 bucket dedicated to this archive, separate from any personal Cloudflare buckets. Bucket has versioning enabled with a 30-day lifecycle policy.
- **Backup mechanism:** Litestream replicates the SQLite database continuously to R2 (sub-second lag). PocketBase file storage syncs to the same R2 bucket via either PocketBase's S3 sync (preferred) or a Litestream-aware file replication step. Final mechanism decided during implementation.
- **Backup frequency:** Continuous for the database (Litestream streams WAL frames as they're produced). Files sync on write with a daily reconciliation pass for any drift.
- **Retention:** 30-day point-in-time recovery window for the database. 30-day file version history for uploads.

**Restore strategy:**

- **Restore procedure:** documented in `docs/runbooks/restore.md` (to be written during implementation, not now).
- **Restore-to-staging rehearsal:** a fresh VPS or local docker environment receives the latest backup and runs against a staging Tailscale node. Target: full restore in under 60 minutes, end-to-end including file rehydration.
- **Restore test frequency:** weekly automated test, scheduled at a low-traffic hour. Failure of the restore test triggers a notification (email or in-app, decided during implementation) and persists as a critical hygiene flag.
- **Verification of success:** the automated restore test runs three checks: (1) database opens and the schema version matches the latest migration; (2) a known canary item — created by the test harness, marked `seed:canary`, never modified — is queryable with all its relationships; (3) a known canary file is fetchable and matches its stored SHA-256 hash. Any check failing fails the test.
- **Who/what verifies:** the automated test harness verifies every week. The Owner reviews the test result digest at least monthly. A failed restore test is a stop-everything situation — no migrations, no schema changes, no large refactors until restore is green again.

**A backup that has never been restored is a dead backup.** This rule is non-negotiable.

**Local development data:**

- Each developer (right now: just the Owner using Claude Code) keeps a local SQLite + file storage.
- Production database is never replicated to local dev.
- Local dev seeds with the curated fixture set described below.

**Seed data policy:**

- **No fake / generative sample data ever.** This is an anti-slop rule that is operational here. Lorem ipsum, AI-generated placeholder images, fake names, simulated campaigns — all forbidden.
- Seed fixtures consist of 20–40 real items the Owner has imported, with all source identifiers replaced with `seed:NNNN` and any PII redacted. The fixtures are checked into the repo as JSON.
- **Required seed coverage (every fixture set must include):**
  - Items of every type: `image`, `caption`, `note`, `link`, `campaign`
  - At least one collection with multiple members
  - At least one campaign with attached assets across multiple roles (primary, supporting, reference)
  - Sources representing multiple kinds: at least Pinterest, Are.na, URL, manual
  - Relationships representing at least three types: `annotates`, `inspired_by`, and one symmetric type
  - At least three rights-status examples spanning `unknown`, `approved_for_internal_use`, and either `restricted` or `expired`
  - At least three AI-annotation examples in different review states: pending, approved, rejected
  - At least one retired item with a `retired_by` relationship to a replacement
- Seed fixtures are versioned. The seed-loading script logs which fixture version was loaded.
- Updating the fixtures is a small, documented operation; it is not a stop-and-ask but it is a commit with a clear message.

**Environment variables:**

- A `.env` file with explicit list of expected variables documented in `docs/runbooks/environment.md`.
- PocketBase admin credentials, Cloudflare R2 keys, Tailscale auth, Ollama endpoint URL.
- `.env` in `.gitignore`. `.env.example` checked in with placeholders.
- No secrets ever in code, ADRs, or session logs.

**Secret handling:**

- All secrets in `.env` or in PocketBase's encrypted settings store.
- Subagent contracts that need credentials (e.g., Pinterest API key for the import subagent, when implemented) read from environment, never from arguments.

**File storage strategy:**

- PocketBase-managed file storage on the VPS local disk.
- Mirrored to R2 via the backup mechanism.
- Files referenced by `file_ref` in extension tables.
- File deletion follows the deletion policy below.

**Thumbnail generation:**

- On image upload, generate three sizes: small (256px wide), medium (640px wide), large (1280px wide).
- Stored alongside originals in PocketBase file storage.
- Generated synchronously on upload for v1; move to async queue if it becomes a bottleneck.

**Deletion policy:**

- Items in any status can be retired (soft) or deleted (hard).
- Retirement is reversible (status change back to active).
- Hard deletion is irreversible.
- Hard deletion logs a `deleted` event BEFORE row removal. The event survives.
- Hard deletion of an item with relationships cascades: relationships referencing the deleted item are also deleted. Their deletion is logged as `relationship_removed` events on the OTHER endpoint.
- Hard deletion of files: PocketBase deletes the file. The file backup in R2 is retained for the 30-day backup window before purge.
- The Owner is the only actor who can hard-delete in v1. Subagents cannot delete.

**Export policy:**

- "Export" means: download original file, copy a structured payload (JSON of canonical fields + relationships), or generate a brief / report from a campaign.
- Every export logs an `exported` event with `metadata.destination` and `metadata.format`.
- v1 supports: file download, JSON export of an item, JSON export of a campaign with its attached assets.
- Bulk export and structured archive-wide export deferred to v1.5+.

**Periodic hygiene audit schedule:**

- Hygiene subagent runs nightly (default 03:00 local time, configurable).
- Digest delivered to home view; outstanding flags persist until resolved.
- Weekly summary as an in-app notification (no email).

---

## 12. Claude Code operating constraints

The final stop-and-ask trigger list. Claude Code enters plan mode and requests explicit approval before any of the following.

**Schema:**
1. Adding, removing, or modifying any column on any table
2. Adding, removing, or renaming any table
3. Changing column types or constraints (NOT NULL, UNIQUE, CHECK, FK)
4. Adding, removing, or modifying any index

**Migrations:**
5. Creating any file in `pocketbase/pb_migrations/`
6. Modifying any existing migration after it has been run on any environment
7. Manual data migration scripts beyond simple INSERT/UPDATE patterns

**Dependencies:**
8. Installing any new npm, Go, or system dependency
9. Updating a major version of any existing dependency
10. Removing a dependency

**Auth / privacy / workspace logic:**
11. Any change to workspace_id propagation
12. Any change to privacy resolution logic
13. Any change to the Owner / role model
14. Any change to PocketBase API rules

**AI write-permission changes:**
15. Adding any field to the canonical-write list (currently empty for AI)
16. Adding a new `field_name` namespace in `ai_annotations`
17. Changing the inbox-vs-non-inbox auto-approval rule
18. Changing the banned phrase loading mechanism
19. Adding new model providers or changing model selection logic

**Type registries:**
20. Adding, removing, or modifying any item `type`
21. Adding, removing, or modifying any row in `relationship_types`
22. Adding, removing, or modifying lifecycle status values
23. Modifying the role enum (when v1.5 introduces it)

**Rights / legal:**
24. Adding, removing, or modifying `rights_status` values
25. Changing soft-enforcement rules (UI flags) for rights

**Imports:**
26. Changing the import idempotency key `(workspace_id, source_type, source_id)`
27. Adding a new source kind
28. Changing how import handles canonical-conflict on re-import

**Refactors and deletions:**
29. Refactoring more than 5 files in a single pass
30. Deleting any test
31. Deleting any file in `docs/decisions/`
32. Bulk operations affecting more than 50 rows

**Documentation:**
33. Editing `CONSTITUTION.md`
34. Editing `CLAUDE.md`
35. Editing `SCHEMA.md` (the doc; the table of truth is the migration)
36. Editing any file in `docs/decisions/`
37. Editing `docs/subagents/*.md`
38. Editing `docs/ui-principles.md` or `docs/component-rules.md`

**Plan mode output format:**

When triggered, Claude Code:

1. Names the trigger (e.g., "Adding column `rights_reviewed_at` triggers rule 1")
2. Describes the change in one paragraph
3. Lists affected files and tables
4. Identifies reversibility (easy / medium / hard)
5. Identifies cascade effects (events, indexes, callers, subagent contracts)
6. Waits for explicit approval before writing

---

## 13. Subagent model — final confirmation

### import subagent

- **Reads:** sources, items, items extensions (for re-import diffing), the source itself
- **Writes:** items (insert with status=inbox, update on re-import), items extensions, sources (upsert), item_events (imported)
- **Suggests:** nothing
- **Forbidden:** writing relationships (except `annotates` between caption-image pairs from the same import operation), tags, collections, campaigns, ai_annotations, canonical fields beyond what the source provides, status promotion beyond inbox, deduplication by content similarity, silent overwrite of user-edited canonical fields
- **Must log:** `imported` event on every insert and on every re-import that changed source content
- **Stop-and-ask when:** re-import would overwrite a user-edited canonical field; source returns malformed data repeatedly; new source kind encountered

### ai-enrichment subagent

- **Reads:** items + extensions, ai_annotations (for supersession), tags (full vocabulary), banned_phrases, relationship_types, relationships
- **Writes:** ai_annotations (with full provenance), tags (only as status=pending), item_events (annotation_added, annotation_superseded)
- **Suggests:** everything via ai_annotations — tags, descriptions, summaries, OCR, color palette, visual DNA, semantic neighbors, relationship suggestions
- **Forbidden:** writing canonical fields (ever, no exceptions), writing relationships rows, writing collections, writing campaign_profiles, approving its own annotations on non-inbox items, approving pending tags, extending the banned phrase list, authoring captions or marketing copy
- **Must log:** `annotation_added` per annotation; `annotation_superseded` when replacing a pending or approved annotation
- **Stop-and-ask when:** asked to operate on a `field_name` not in the registry; asked to modify the inbox-vs-non-inbox auto-approval rule; encounters a model/prompt mismatch in provenance

### hygiene subagent

- **Reads:** all tables (full read access)
- **Writes:** nothing — produces report artifacts only
- **Suggests:** nothing — flags conditions, never proposes changes to data
- **Forbidden:** every form of data modification, including merging duplicates it identifies; suppressing flags; changing thresholds at runtime
- **Must log:** nothing (read-only operations don't log)
- **Stop-and-ask when:** never autonomously; the hygiene subagent has no write authority that could need approval

**No additional subagents in v1.** Caption-generation, copy-writing, schema-modification, graph-editing, and meta-orchestration agents are all out of scope.

---

## 14. Decisions still open

### Closed at this checkpoint (all five gaps closed in 2026-04-27 session)

1. **Component rules** — `docs/component-rules.md` written. Defines the contracts for `ItemCard`, `ProvenanceMark`, `RightsWarning`, `EmptyState`, AI-vs-human visual treatment, forbidden component classes, shadcn customization, and UI stop-and-ask triggers.
2. **CLAUDE.md UI integration** — durable UI rules merged into the operating protocol as a "UI hard rules" section. Stop-and-ask triggers updated to include UI-relevant rules. Pointers updated.
3. **Rights model** — six-value enum accepted: `unknown` / `reference_only` / `approved_for_internal_use` / `approved_for_external_use` / `restricted` / `expired`. Soft enforcement at attachment with three states (none / advisory / blocking). Override notes required and event-logged. Hard block on `restricted` and `expired`. Section 5 of this audit captures the full model.
4. **"Use" event narrow definition** — accepted. v1 derives use from `campaign_attached` events filtered by `campaign_profiles.phase='live'` and `metadata.role IN ('primary', 'supporting')`. No separate `used` event in v1. The event registry is flexible enough that adding `used`, `exported`, or `published` later is non-disruptive.
5. **Seed data policy** — accepted. 20–40 real-or-redacted items checked in as JSON. Required coverage: all item types, at least one collection, one campaign with multi-role attachments, multiple sources, multiple relationship types, at least three rights-status examples, at least three AI-annotation examples in different review states, at least one retired item with `retired_by`. No fake / generative fixtures ever.

### Can decide DURING v1 implementation (do not block scope)

6. Native sqlite-vec storage/query layout beyond the M0.1 `vector BLOB` placeholder
7. Concrete `payload` JSON schemas per `field_name` in `ai_annotations`
8. Thumbnail generation: synchronous vs. async queue
9. PocketBase admin UI customization vs. full custom Owner interface
10. Ollama prompt versioning scheme (commit hash, semver, named prompts)
11. Specific keyboard shortcut bindings beyond the documented few
12. Density toggle defaults per route
13. Final restore test notification mechanism (email vs. in-app)
14. File replication mechanism (PocketBase S3 sync vs. Litestream-aware file replication)
15. Whether canonical-conflict on re-import surfaces as a stop-and-ask in chat OR as an Owner-facing review queue inside the app

### Defer to v1.5

- Semantic search query layer (vectors are scaffolded in v1, queries are not)
- Visual similarity search UI
- OCR pipeline as automated enrichment
- License expiry tracking and proactive notification
- Multi-step approval workflows
- `relationship_suggested` and `relationship_rejected` as distinct events
- Per-file version history
- Bulk export
- Mobile triage beyond single-item flows
- iOS Shortcuts capture polish (URL-paste fallback is fine for v1)
- Browser extension as a polished surface (URL-paste fallback for v1)

### Defer to v2+

- Multi-user roles (Editor, Reviewer, Viewer, Agent as a DB row)
- `workspace_members` table and team permissions
- Cross-workspace references and the `cross_workspace_reference` relationship type
- Curator / nightly synthesis layer (the LLM curator from earlier planning)
- Real-time collaboration
- GitNexus / codebase intelligence (likely never)
- Mobile-first triage flows
- Public sharing / read-only published views
- Rights propagation to derivative items
- Per-channel usage restrictions on rights

---

## 15. Final planning readiness verdict

**READY for v1 scope.**

Architecture: locked. Eleven foundational decisions confirmed in section 2.

Governance: defined. Metadata strategy, rights model, versioning, roles, audit events, hygiene cadence — all documented and committed.

UX: complete. `UI_ARCHITECTURE.md`, `docs/ui-principles.md`, `docs/component-rules.md` are written. Durable UI rules are integrated into `CLAUDE.md`.

Operations: documented. Backup strategy, restore strategy with weekly verification, seed data policy, deletion policy, export policy.

Subagents: contracts locked. Three subagents in scope (`import`, `ai-enrichment`, `hygiene`). Authority defined per-subagent in `docs/subagents/*.md`.

Anti-patterns: catalogued. Twenty UI anti-patterns and their remediations are routed to `CLAUDE.md`, `docs/ui-principles.md`, or `docs/component-rules.md`.

Stop-and-ask triggers: comprehensive. Schema, migrations, dependencies, AI permissions, registry changes, rights model, lifecycle, refactors, deletions, documentation edits, UI contracts.

The product definition is unambiguous: a single-user, single-workspace visual research instrument with campaign memory underneath. Marketing/creative is the v1 load test. The polymath/second-brain framing is preserved as a future use case but does not drive v1 design.

There are no remaining decisions that block scope definition. The fifteen items in the "Can decide DURING v1 implementation" list are real and unresolved, but each is local to a sprint and none requires re-architecting anything.

**Exact next prompt to issue:**

> Now that planning is complete, define v1 scope. Produce `docs/scope/v1.md` containing:
>
> 1. v1 product summary (single paragraph)
> 2. v1 scope — exactly what ships, organized as: foundational schema and migrations, capture surfaces, archive and search surfaces, item detail and triage surfaces, collections, campaigns, graph, hygiene, settings
> 3. v1 milestone sequence — ordered implementation phases with dependencies, each phase ending in a verifiable demoable state
> 4. v1 explicit out-of-scope list — every feature deferred to v1.5 and v2+ from the planning audit, restated for clarity
> 5. v1 done criteria — the conditions under which v1 is considered shipped
>
> Use the architecture, governance, and UX decisions already locked in `CONSTITUTION.md`, `SCHEMA.md`, `docs/decisions/`, `docs/subagents/`, `UI_ARCHITECTURE.md`, `docs/ui-principles.md`, `docs/component-rules.md`, and `PLANNING_AUDIT.md`.
>
> Do not propose new architecture. Do not add features beyond what the audit lists. Do not write code. Do not create folders or migrations. Produce only `docs/scope/v1.md`.

After v1 scope is defined and approved, the next prompt creates the filesystem and the first migration.
