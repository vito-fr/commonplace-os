# Release Layers

A layered delivery plan for the archive. The existing `docs/scope/v1.md` document remains the consolidated reference for what the v0.1 + v1 combined release contains; this document defines how to ship it in stages, plus what comes after.

The four layers are additive. Each layer extends the previous one without rewriting it. The schema is locked at v0.1 and remains backward-compatible through v2 — no layer requires a destructive migration of an earlier layer's data.

When this document conflicts with `docs/scope/v1.md`, this document defines delivery sequencing and the v1.md document defines target scope. Sequencing wins for "what to build next"; target scope wins for "what the system eventually contains."

---

## Layer 1 — v0.1: Local Usable Prototype

### Purpose

Prove the core loop works as designed with the Owner's real content, on local infrastructure, in the shortest time to actual use. v0.1 is the dogfooding release. The Owner runs it on their own laptop, captures their own work into it, and discovers what hurts before any production infrastructure is committed.

If v0.1 reveals UX or data-model issues, those issues are fixed before the cost of deployment is paid. If v0.1 confirms the design, the v1 layer hardens what already works.

### Must-have workflows

The seven core loop verbs, demonstrable end-to-end on local infrastructure:

1. **Capture** — paste a URL, upload a file, type a manual note → item appears in inbox within 5 seconds
2. **Inspect** — open an inbox item, read all canonical fields, see source provenance, view event timeline
3. **Triage** — apply tags from approved vocabulary, advance status from `inbox` → `triaged` → `active`
4. **Connect** — create relationships between items via the eight initial types, add items to collections, see backlinks on item detail
5. **Retrieve** — full-text search via FTS5; filter by type, status, tag, source, collection, campaign
6. **Reuse** — create a campaign, attach items with role (primary / supporting / reference), see attached assets grouped on the campaign page
7. **Retire** — change status to retired, optionally set `retired_by`, see retired items hidden from default archive view

### Included surfaces

- `/inbox` — inbox queue with masonry of inbox items
- `/archive` — active items in masonry with filter rail
- `/items/:id` — full item detail with hero, metadata stack, description, tags, relationships, collections, campaigns, AI annotations panel (collapsible), event timeline
- `/collections` and `/collections/:id` — collection index and detail
- `/campaigns` and `/campaigns/:id` — campaign index and detail with brief panel and assets grouped by role
- Search bar (cmd-K) with full-text + structured filters
- Triage UI rendered in-context on item detail (split layout deferred to v1)
- Capture entry: paste URL, drag file, type note — accessible from a global capture trigger

### Excluded surfaces

- `/graph` — graph view (deferred to v1.5)
- `/hygiene` — hygiene digest (deferred to v1.5)
- `/settings/sources` — source administration (deferred to v1)
- `/settings/banned-phrases` — anti-slop blocklist administration (deferred to v1; the blocklist exists in code from v0.1)
- `RightsWarning` component (deferred to v1; the rights chip on item detail is rendered, but no attachment-time warning fires)
- Workspace switcher (deferred indefinitely; default `personal` workspace is implicit)
- Bulk export (deferred to v1.5)
- Phase change UI on campaigns (deferred to v1; `phase` defaults to `planning` and is editable but without the gated UI)
- Smart filter rail (basic filters only in v0.1; smart filters in v1)

### Infrastructure level

Local-first. PocketBase runs as a single binary on the Owner's laptop. SQLite database file lives on local disk. File storage is local. No VPS, no Tailscale, no Cloudflare R2, no Litestream.

Backup discipline is manual: a documented procedure (`docs/runbooks/v0.1-backup.md`, written during v0.1 implementation) tells the Owner to copy the SQLite file and the file storage directory to an external drive before any risky operation. No automation. No restore test cadence yet.

The frontend is Vite + React running locally, pointed at the local PocketBase. No production build, no deployment.

### AI level

The `ai_annotations` table exists from v0.1. The `ProvenanceMark` component renders. The review path — pending → approved / rejected → optionally promoted to canonical — is fully wired.

The `ai-enrichment` subagent is OPTIONAL in v0.1. Two paths:

- **If the Owner has Ollama running locally:** manual enrichment trigger from item detail or inbox view runs the subagent against selected items. Banned phrase filter, length caps, tag vocabulary lock all enforced.
- **If the Owner does not run Ollama:** the system works without AI suggestions. The annotations panel is empty. The review queue has no items.

There is no automatic post-import enrichment in v0.1. There is no nightly catchup pass. AI is opt-in per-action.

### Search level

FTS5 full-text search over canonical title, description, summary, and tag names. Structured filters by type, status, tag (approved only), source, collection, campaign, date captured.

No semantic search. No visual similarity. No "more like this" affordance. No smart filters (those depend on event coverage that is partially built in v0.1).

### Graph level

No graph view. Relationships are functional from v0.1 — they're the data model — but they render only as backlink lists on item detail. The visual graph rendering arrives in v1.5.

### Governance level

The data model is fully governed from v0.1:

- `workspace_id` enforced on every tenant-scoped query
- Status lifecycle with logged `status_changed` events
- Sources table populated; `source_external_id` idempotency enforced
- Tag vocabulary lock active (pending vs. approved)
- Banned phrase blocklist seeded and enforced when AI runs
- AI canonical isolation: zero subagent paths can write canonical fields, verified by automated test
- Rights chip on item detail (manual editing of `rights_status` works); no enforcement at attachment

Event coverage in v0.1: `created`, `imported`, `status_changed`, `tagged`, `untagged`, `collection_added`, `collection_removed`, `relationship_added`, `relationship_removed`, `campaign_attached`, `campaign_detached`, `annotation_added`, `annotation_approved`, `annotation_rejected`, `retired`, `restored`. Sufficient for v0.1's smart-filter-free retrieval.

Hygiene subagent NOT active. Hygiene reports do not run. No nightly cadence.

### Demoable end state

Owner has used the local app for one week with real captures. The archive contains roughly 50 items spanning images, captions, notes, links, and at least one campaign. The Owner has triaged inbox items, created relationships across multiple types, attached assets to a campaign with roles, retired at least one item with a replacement, and run searches that return useful results.

The Owner can verbally walk through each of the seven core loop verbs and show the corresponding screens.

### Done criteria

1. All seven core loop verbs work end-to-end on local infrastructure
2. `workspace_id` enforcement test passes
3. AI canonical isolation test passes (verified even without AI running)
4. Component compliance: zero forbidden component classes; every `ItemCard` carries the four-signal row; every rendered AI annotation carries a `ProvenanceMark`; item detail is always a route
5. Schema is locked: every table from `SCHEMA.md` exists; every CHECK and FK is active; every index is in place
6. Seed fixture set loads and produces the documented coverage
7. Manual backup procedure is documented and the Owner has performed at least one full backup-and-restore drill manually
8. Capture-to-card latency is under 5 seconds on the Owner's local machine for URL paste and file upload

v0.1 is shipped when all eight criteria are met and the Owner has used the system for at least seven consecutive days with real content.

---

## Layer 2 — v1: Hardened Single-User Release

### Purpose

Move the working prototype from "runs on my laptop" to "I can rely on this." Production deployment, real backup with verification, full rights workflows, automated AI enrichment, full event coverage, and the governance layers that the prototype deferred.

v1 does not add new product capabilities beyond what v0.1 demonstrated. It adds the operational and trust layers that make the prototype's capabilities reliable.

### Must-have workflows (additive)

- Use the app from any device on the Tailscale network
- Survive a disk failure or VPS rebuild via restore from R2
- Receive nightly hygiene reports... NO — hygiene is v1.5 in this split
- Trigger AI enrichment automatically after every import; review pending annotations via the suggestions queue
- Receive a rights warning when attaching items to campaigns; override advisory states with a logged note; hard-block on `restricted` and `expired`
- Change campaign phase between `planning` / `live` / `wrapping` / `post_mortem`
- Export an item or a campaign as JSON
- Hard-delete an item with a logged `deleted` event preceding row removal
- Edit source default privacy and other source settings via UI
- Add or remove banned phrases via UI

### Included surfaces (additive)

- `RightsWarning` component active at every campaign-attachment flow with three states (none / advisory / blocking)
- `/settings/sources` — source administration table
- `/settings/banned-phrases` — anti-slop blocklist administration
- Campaign phase change UI (with logged events)
- Triage UI as the dedicated split layout (per `docs/component-rules.md` "Inbox triage rules") with full keyboard navigation
- Suggestions queue: a global view of pending annotations across the workspace
- Smart filter rail with `Inbox debt`, `Stale active`, `Overused this quarter`, plus negative/temporal queries
- Export affordances on item detail and campaign detail
- Manual deletion path with confirmation dialog

### Excluded surfaces (still excluded)

- `/graph` — graph view (deferred to v1.5)
- `/hygiene` — hygiene digest (deferred to v1.5)
- Semantic / visual search results (deferred to v1.5)
- Workspace switcher (deferred to v2)
- Bulk export (deferred to v1.5)

### Infrastructure level

Production:

- Hetzner VPS provisioned, hardened, behind Tailscale (no public ports)
- PocketBase running as a systemd service
- File storage on VPS local disk
- Cloudflare R2 bucket with versioning + 30-day lifecycle policy
- Litestream replicating SQLite to R2 continuously, sub-second lag
- Files synced to R2 daily with reconciliation pass
- Weekly automated restore-to-staging test with three-check canary verification (schema version match, canary item queryable, canary file SHA-256 match)
- `docs/runbooks/restore.md` and `docs/runbooks/environment.md` written

The local development environment continues to exist alongside production. The Owner develops locally, deploys to production via a documented release path.

### AI level

The `ai-enrichment` subagent is fully active and runs automatically:

- After every import batch (operates on newly imported inbox items)
- Nightly catchup pass over inbox items not yet enriched
- On Owner demand for a specific item or batch via the suggestions queue

All `field_name` namespaces from v1 are implemented: `tags`, `description`, `summary`, `visual_dna`, `color_palette`, `relationship_suggestion`. (`ocr_text` is best-effort in v1; the polished OCR pipeline is v1.5.)

Banned phrase filter, length caps, tag vocabulary lock all enforced. Auto-approval on inbox items; pending elsewhere. Provenance complete: model name, model version, prompt version, confidence.

### Search level

Same as v0.1 — full-text via FTS5, structured filters, smart filters now functional thanks to complete event coverage. Vector storage scaffolding (`embeddings` table, sqlite-vec extension loaded) is in place but no semantic queries yet.

### Graph level

Still none. Graph view is v1.5.

### Governance level

Full governance:

- All event types from `PLANNING_AUDIT.md` §8 logged at the documented action
- Rights warnings active with override-note requirement
- Hard-block on restricted and expired rights statuses
- Settings UIs allow source privacy editing and banned phrase administration
- Owner is the only actor; subagent contracts enforced at the data layer
- Three consecutive successful weekly restore tests required before v1 is declared shipped

### Demoable end state

Owner uses the production system from multiple devices over Tailscale. A simulated disk failure on the VPS is recovered from R2 within 60 minutes. Inbox items receive AI annotations automatically; the Owner reviews them via the suggestions queue. A rights warning fires when attaching an `unknown`-status item to a campaign at primary role; the Owner overrides with a note. An attempt to attach an `expired`-status item is blocked. The Owner exports a campaign as JSON.

### Done criteria

1. All v0.1 criteria still pass
2. Tailscale-only access verified; no public reachability
3. Litestream replication lag under 1 second under typical load
4. Three consecutive weekly restore tests pass with all three canary checks green
5. AI enrichment subagent runs automatically post-import; pending annotations appear in the suggestions queue
6. Rights warning verified in all three states with the documented event-logging on overrides
7. All events from the v1-required column of `PLANNING_AUDIT.md` §8 are logged at the documented action
8. Settings pages function: source privacy editable, banned phrases editable, both surfaces follow `docs/component-rules.md` "Table view rules"
9. Documentation: `docs/runbooks/restore.md` and `docs/runbooks/environment.md` exist; the Owner has used `restore.md` to perform a manual restore at least once

v1 is shipped when all nine criteria are met. The original `docs/scope/v1.md` document represents the v0.1 + v1 combined target.

---

## Layer 3 — v1.5: Intelligence and Search Expansion

### Purpose

Add the intelligence layer that distinguishes the archive from a tagged folder. Semantic and visual search transform retrieval from "do I remember the right keyword" to "show me what felt like this." The graph view turns the relationship data into an actual research instrument. Hygiene reports surface the rot the system has been silently logging.

v1.5 is when the archive starts to feel intelligent rather than merely organized.

### Must-have workflows (additive)

- Search semantically: type a phrase, get items whose canonical content is conceptually similar
- "More like this" from any item — both textually and visually
- Open the graph view filtered to a collection or campaign; see typed edges; click into items
- Receive a nightly hygiene digest with all 11 reports; resolve flags via in-context actions
- See the archive's dedup work surfaced (cross-source duplicates flagged, perceptual-hash matches highlighted)
- Trigger OCR enrichment as a polished workflow on image items

### Included surfaces (additive)

- `/graph` — graph view with all features from `UI_ARCHITECTURE.md` §12 and `docs/component-rules.md` "Graph view rules"
- `/hygiene` — full hygiene digest with all 11 reports
- Hygiene digest summary on the home view
- "Find similar" affordances on item detail (textual semantic + visual)
- Search bar gains a semantic mode toggle
- Bulk export across an archive subset

### Excluded surfaces (still excluded)

- Workspace switcher (deferred to v2)
- Multi-user UI (deferred to v2)
- Curator / nightly synthesis output (deferred to v2)

### Infrastructure level

Same as v1, plus:

- Vector index populated in sqlite-vec for semantic search
- Embeddings produced for canonical text on item create/update via Ollama (`nomic-embed-text`)
- Visual embeddings or perceptual-hash-based similarity index for image items
- OCR pipeline as a polished enrichment workflow (Tesseract or equivalent, integrated through the `ai-enrichment` subagent)
- Hygiene cron at 03:00 local with digest delivery

### AI level

Stronger AI workflows:

- Embedding generation runs automatically post-import
- "Find similar" queries hit the vector index
- The OCR pipeline upgrades from best-effort to polished
- Prompt versioning is formalized — every annotation records the prompt hash; old prompts can be re-run for comparison
- Nightly enrichment passes also compute relationship suggestions from semantic neighbors and surface them in the suggestions queue

The curator / nightly synthesis layer (the LLM that would write summaries across the archive nightly) is NOT in v1.5. That's a v2 concept.

### Search level

Three modalities:

- Full-text (FTS5) — the v0.1 default
- Semantic text — vector similarity over canonical text embeddings
- Visual similarity — perceptual hash + visual embeddings for image items

Hybrid ranking is NOT in v1.5; modalities are explicitly toggled.

### Graph level

The full graph experience per `UI_ARCHITECTURE.md` §12 and `docs/component-rules.md` "Graph view rules":

- ≤30 nodes default, force-filter beyond
- Typed color-coded edges
- Symmetric vs. directional rendering
- Force physics off by default
- Node sizing by event count
- Click-node side panel
- Hover-edge tooltips with relationship metadata
- "Explain this connection" affordance

Advanced graph intelligence (community detection, centrality scoring, automated graph editing) remains out of scope.

### Governance level

Same as v1, plus:

- Hygiene reports fully active: `inbox_debt`, `stale_active`, `retired_without_replacement`, `retired_by_inconsistency`, `cross_source_duplicates`, `tag_vocabulary_drift`, `overused`, `orphaned`, `dangling_annotations`, `banned_phrase_audit`, plus `restore_test_status` if the report from v0.1's deferred-decision list is greenlit
- Audit-time review of approved annotations against current banned phrase list (the `banned_phrase_audit` report)
- Hygiene flag resolution flows in the UI

### Demoable end state

Owner types a vague phrase into search and gets relevant results from across the archive. Right-clicks an image and chooses "Find similar"; sees visually related items. Opens the graph filtered to a campaign; sees how its assets connect to earlier work. Reviews the hygiene digest in the morning; resolves three stale-active flags by retiring outdated assets. The archive feels searchable in ways the v1 build was not.

### Done criteria

1. All v1 criteria still pass
2. Semantic search returns useful results on a representative query set
3. "Find similar" works for both textual and visual modalities
4. Graph view enforces the 30-node limit and renders typed edges per the contract
5. All 11 hygiene reports run nightly and surface in the digest
6. Hygiene flag resolution actions work in-context
7. OCR pipeline produces searchable text on at least 90% of test image items with embedded text
8. Vector index size and query latency are within acceptable bounds (define during v1.5 implementation)

---

## Layer 4 — v2: Company Brain Expansion

### Purpose

Open the system to multiple users, multiple workspaces, and the integrations that turn it from "personal research instrument" into "company memory." Approval workflows, role-based permissions, cross-workspace references, polished imports from external platforms, and the curator layer that synthesizes the archive nightly.

v2 is where the archive becomes the durable knowledge layer of an organization.

### Must-have workflows (additive)

- Invite collaborators to a workspace with role-based permissions
- Switch between personal and business workspaces
- Reference items from another workspace without copying them
- Receive a nightly synthesis report from the curator agent
- Capture from a polished browser extension
- Capture via an iOS share-sheet flow that handles auth, workspace selection, and inbox tagging in under 5 seconds
- Import bulk content from Pinterest API, Are.na API
- Publish a curated subset of the archive as a read-only public view (where appropriate)

### Included surfaces (additive)

- Workspace switcher in nav (visible when count > 1)
- Multi-user invitation and role assignment UI
- Approval workflow surfaces (Reviewer, Editor distinct from Owner)
- Curator output rendering: nightly synthesis appears as a new entity type or as items of `type='note'` with a `generated_by_curator` provenance mark
- Polished browser extension (one-click capture with workspace and tag selection)
- Polished iOS Shortcuts share flow
- Pinterest and Are.na API import wizards
- Public read-only views for selected collections or campaigns

### Excluded surfaces

Anything not specifically called out for v2 is out. Speculative features are not added at this layer.

### Infrastructure level

Same as v1.5, plus:

- Multi-tenant authentication via PocketBase auth or SSO
- `workspace_members(workspace_id, user_id, role)` table active
- Role-based query enforcement
- Cross-workspace reference resolution at the data layer
- API rate limiting and quotas
- Curator subagent infrastructure (LLM scheduling, output storage, synthesis prompts under version control)

### AI level

Curator subagent runs nightly:

- Synthesizes recent archive activity into named summaries
- Identifies patterns across collections, campaigns, and time
- Files synthesis output back into the archive as items
- Every output carries full provenance (model, prompt version, source items referenced)

The curator never writes canonical fields on existing items. Its output is new items with their own provenance.

Stronger AI workflows for multi-user contexts: per-user prompt customization, workspace-scoped tag vocabularies, role-aware suggestion routing.

### Search level

Same modalities as v1.5, with cross-workspace search constrained by the `cross_workspace_reference` relationship type (an item is reachable from another workspace only if a reference relationship exists).

### Graph level

Same graph experience as v1.5. Cross-workspace edges render with a distinct visual treatment.

### Governance level

The full role and permission model:

- Owner, Admin, Editor, Reviewer, Viewer, Agent — all active
- Workspace membership in `workspace_members`
- Role-based authority enforced at every API call
- Approval workflows: editor proposes → reviewer approves → admin publishes (or the simplified subset that surfaces during real use)
- Audit log surfaces actor identity beyond the binary "Owner vs. subagent" of v1
- License expiry tracking and notification

Cross-workspace references are explicit relationships, never implicit access leaks.

### Demoable end state

Two users in the same workspace collaborate: one captures, the other reviews and approves AI annotations, the third (the team's brand director) sets policy on banned phrases. A second workspace exists for external client work; selected references bridge from personal to client via cross-workspace relationships. The curator delivers a nightly synthesis showing what was captured this week and how it connects to ongoing campaigns. A polished browser extension lets capture happen from any tab in under 2 seconds.

### Done criteria

To be defined when v1.5 is shipped and v2 scope is taken up. Speculative criteria now would be effort wasted; v2's actual priorities will be informed by what hurt during v1 and v1.5.

---

## Recommendation

**Build v0.1 first.** Then v1, then v1.5, then v2.

The original `v1.md` is a strong target spec but a brutal first build. Its M0 alone — Hetzner provisioning, Tailscale setup, R2 bucket creation, Litestream configuration, canary harness, restore rehearsal — is a week of infrastructure work the Owner pays for before having anything to use. By the time M8 ships and the three-week restore-test verification completes, the Owner has been waiting roughly two months to use the system with real content.

That's the wrong order.

The schema is right. The architecture is right. The UX rules are right. None of those need production infrastructure to validate. They need real content and real use.

v0.1 puts the Owner in the system within a few weeks of starting. They capture their actual references, attach them to actual campaigns, retire actual stale work. If the design is right, v1 hardens it; if the design has rough edges, those edges are filed off before the cost of deployment is paid.

**The risks of v0.1 first, and how they're addressed:**

- **"v0 forever" — the prototype gets used indefinitely and is never hardened.** Real risk. Mitigation: v0.1 ships with explicit done criteria and a manual backup discipline that becomes increasingly painful as the archive grows. The pain is the forcing function for v1. If after one month of v0.1 use the Owner is not motivated to start v1, the design has not earned hardening — and that's important information.

- **Some architectural assumptions only show under production load.** Partially true. `workspace_id` enforcement, FTS5 performance, AI subagent throughput — these can be validated locally. Litestream behavior, R2 latency, Tailscale routing — these only show in production. v1's restore test catches the production-specific issues; running it for three consecutive weeks before declaring v1 done is exactly the canary for that risk.

- **Local backup discipline slips.** Real risk. Mitigation: v0.1 documents the backup procedure in `docs/runbooks/v0.1-backup.md` and v0.1 done criteria includes "the Owner has performed at least one full backup-and-restore drill manually." This makes the discipline concrete from day one.

- **Some v0.1 decisions get re-litigated when v1 hardens.** Possible but not destructive. Schema is locked at v0.1 and remains backward-compatible through v2. The work that gets re-done in v1 is operational (deployment scripts, runbooks, restore test) — not architectural.

**The risks of v1 first, why they're worse:**

- **Two months before the first real use.** The Owner accumulates capture debt during the build, then dumps it all in at once with no triage muscle memory. The system gets a load test before the user has a flow.

- **UX issues found late.** A capture-flow problem discovered in M1 is fixable. Discovered in M8 after eight weeks of building around the assumption, it's expensive.

- **Restore-test discipline before there's anything worth restoring.** Three weeks of weekly restore tests on a database with seed fixtures and no real content is theater. The discipline matters once real content lives in the system, not before.

- **Infrastructure friction before product feedback.** The Owner's first weeks are spent on Hetzner / Tailscale / R2 / Litestream debugging — not on "is the triage UI actually fast enough."

**The verdict, blunt:**

The original `docs/scope/v1.md` is a great document and the wrong starting point. Build v0.1 first. Use the system for at least four weeks with real content. Then start v1 — and at that point, the production hardening is hardening something that's already proven, not building speculatively against a spec.

The next prompt to issue, when ready:

> v0.1 begins. Stop-and-ask before any code is written. Produce the M0.1 plan: the local-only foundation. Confirm the local development setup, the first migration `migrations/0001_initial.sql`, the seed-data loader, and the initial component build order. Do not provision infrastructure. Do not write SQL yet. Do not commit yet. Produce a written plan only.

This sequences the work so the Owner is using the system within the shortest reasonable time, then hardens what already works.
