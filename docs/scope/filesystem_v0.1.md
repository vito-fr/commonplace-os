# v0.1 Filesystem Plan

The minimal repo structure for v0.1: just enough scaffolding to support local-prototype development without pre-creating empty complexity for v1, v1.5, or v2 features.

This document is the navigation reference. When Claude Code is uncertain where something belongs, this document is consulted before improvising a new location.

When this document conflicts with `docs/scope/release_layers.md` or `PLANNING_AUDIT.md`, the scope and audit documents win for *what* gets built; this document defines *where* it lives.

---

## 1. Final v0.1 repo tree

The complete state of the repo at the moment v0.1 implementation begins. No folder exists in this tree that does not serve v0.1 directly.

```
archive/
├── README.md
├── CLAUDE.md
├── CONSTITUTION.md
├── SCHEMA.md
├── UI_ARCHITECTURE.md
├── PLANNING_AUDIT.md
├── .gitignore
├── .env.example
│
├── docs/
│   ├── ui-principles.md
│   ├── component-rules.md
│   ├── relationships.md
│   │
│   ├── anti-slop/
│   │   └── banned-phrases.md
│   │
│   ├── decisions/
│   │   ├── 0001-atomic-unit.md
│   │   ├── 0002-campaigns.md
│   │   ├── 0003-ai-metadata.md
│   │   ├── 0004-relationship-model.md
│   │   └── 0005-workspaces-and-privacy.md
│   │
│   ├── subagents/
│   │   ├── import.md
│   │   ├── ai-enrichment.md
│   │   └── hygiene.md
│   │
│   ├── scope/
│   │   ├── v1.md
│   │   ├── release_layers.md
│   │   └── filesystem_v0.1.md
│   │
│   ├── runbooks/
│   │   └── v0.1-backup.md
│   │
│   └── sessions/
│       └── .gitkeep
│
├── pocketbase/
│   ├── README.md
│   ├── pb_migrations/
│   │   └── .gitkeep
│   └── pb_hooks/
│       └── .gitkeep
│
└── seed/
    ├── README.md
    └── fixtures/
        └── .gitkeep
```

That's the entire tree. Three top-level folders besides `docs/`. Six `.gitkeep` files because git doesn't track empty directories. Twenty-eight files total before any code is written.

---

## 2. What each top-level folder means

**`/`** (repo root) — Holds the canonical governance documents (`CLAUDE.md`, `CONSTITUTION.md`, `SCHEMA.md`, `UI_ARCHITECTURE.md`, `PLANNING_AUDIT.md`) plus the repo orientation README. These are read at the start of every session. Living at the root makes them unmissable.

**`/docs`** — Everything that is documentation: principles, decisions, contracts, scope, runbooks, sessions. No code, no SQL, no fixtures. The folder exists to be browsed and referenced.

**`/pocketbase`** — Everything that is PocketBase configuration: the binary's resting place, JS-based migrations in `pb_migrations/`, JS-based server hooks in `pb_hooks/`. PocketBase data (`pb_data/`) lives here at runtime but is `.gitignore`d. The folder exists to be a self-contained backend root.

**`/seed`** — The curated fixture set and the loader script. Seed data is a first-class concern in this archive — the no-fake-data rule from `PLANNING_AUDIT.md` §11 makes the curated fixtures the only path to a working development environment. The folder exists separately from `pocketbase/` because the data is conceptually independent of the backend's runtime configuration.

**Folders that do NOT exist yet:**

- No `/src` or `/web` or `/app` — the frontend is not initialized in v0.1's foundation milestone (M0.1). It arrives at M1.1 (Capture). Pre-creating an empty frontend folder is empty complexity.
- No `/tests` — tests live alongside the code they test, in directories created when the code arrives.
- No `/scripts` — operational scripts (deployment, restore harness, etc.) belong to v1+ and arrive when v1 begins.
- No `/api`, `/server`, `/services` — PocketBase is the backend. Custom server logic, if any, lives in `pocketbase/pb_hooks/`.
- No `/extensions`, `/mobile`, `/electron` — all deferred capture surfaces.

---

## 3. What files should exist before coding

The complete pre-coding state. Twenty-eight files. Most already exist from prior planning sessions; six are new in this turn.

**Already exist (from prior planning sessions, to be moved into the new repo):**

- `CLAUDE.md`
- `CONSTITUTION.md`
- `SCHEMA.md`
- `UI_ARCHITECTURE.md`
- `PLANNING_AUDIT.md`
- `docs/ui-principles.md`
- `docs/component-rules.md`
- `docs/relationships.md`
- `docs/anti-slop/banned-phrases.md`
- `docs/decisions/0001-atomic-unit.md`
- `docs/decisions/0002-campaigns.md`
- `docs/decisions/0003-ai-metadata.md`
- `docs/decisions/0004-relationship-model.md`
- `docs/decisions/0005-workspaces-and-privacy.md`
- `docs/subagents/import.md`
- `docs/subagents/ai-enrichment.md`
- `docs/subagents/hygiene.md`
- `docs/scope/v1.md`
- `docs/scope/release_layers.md`

**New in this turn:**

- `README.md` — root orientation
- `.gitignore` — version control hygiene
- `.env.example` — environment variable placeholders
- `docs/scope/filesystem_v0.1.md` — this document
- `docs/runbooks/v0.1-backup.md` — manual backup procedure
- `pocketbase/README.md` — backend setup and operation
- `seed/README.md` — seed data policy and loader instructions

**Placeholder files (`.gitkeep`):**

- `docs/sessions/.gitkeep`
- `pocketbase/pb_migrations/.gitkeep`
- `pocketbase/pb_hooks/.gitkeep`
- `seed/fixtures/.gitkeep`

---

## 4. Deferred files at filesystem-planning time

These were deferred to specific later milestones at the time this filesystem plan was written. The M0.1 migration has since been created and accepted; later files remain deferred until their milestones.

**M0.1 status:**

- `pocketbase/pb_migrations/0001_initial_schema.js` — complete and accepted under PocketBase v0.36.9.

**Still deferred after M0.1 migration acceptance:**

- `seed/load.ts` — the seed loader script.
- `seed/fixtures/*.json` — the curated fixture files.

**Defer to M1.1 (Capture milestone):**

- `package.json` at root
- `vite.config.ts`
- `tsconfig.json`
- `index.html`
- `public/` directory
- `src/` directory and all frontend source code
- `src/components/atoms/ItemCard.tsx` (the very first component, but still M1.1)
- Any test scaffolding

**Defer to v1 (production hardening):**

- `docs/runbooks/restore.md` — the production restore procedure (v0.1 has manual backup only)
- `docs/runbooks/environment.md` — the full production environment variable list
- `docs/runbooks/deploy.md` — deployment procedure
- Any Hetzner provisioning notes
- Any Litestream configuration
- Any CI / GitHub Actions workflow files

**Defer to v1.5+:**

- Anything related to the graph view's frontend
- Anything related to semantic search infrastructure
- Anything related to the hygiene subagent's automation

**Never to be pre-created (always emerges with the code):**

- Test files (live next to the code they test)
- Type definition files (live next to the modules they describe)
- Component-internal style files

---

## 5. Which files are governance / planning documents

The full governance set. These are read by Claude Code at session start (the canonical ones) or on demand (the rest). None contain code, configuration, or fixtures.

**Constitutional (read every session):**
- `CLAUDE.md` — operating protocol
- `CONSTITUTION.md` — architecture identity

**Reference (read when relevant):**
- `SCHEMA.md` — schema doc, mirror of `pb_migrations/`
- `UI_ARCHITECTURE.md` — UI architecture
- `PLANNING_AUDIT.md` — audit checkpoint and governance commitments

**Discipline:**
- `docs/ui-principles.md` — design philosophy
- `docs/component-rules.md` — component contracts
- `docs/relationships.md` — relationship type registry mirror
- `docs/anti-slop/banned-phrases.md` — anti-slop blocklist mirror

**Decisions:**
- `docs/decisions/0001-atomic-unit.md` through `0005-workspaces-and-privacy.md` — ADRs

**Subagent contracts:**
- `docs/subagents/import.md`
- `docs/subagents/ai-enrichment.md`
- `docs/subagents/hygiene.md`

**Scope and operations:**
- `docs/scope/v1.md` — full v1 target
- `docs/scope/release_layers.md` — layered delivery plan
- `docs/scope/filesystem_v0.1.md` — this document
- `docs/runbooks/v0.1-backup.md` — manual backup procedure

**Living history:**
- `docs/sessions/*.md` — append-only session reports (none yet; produced by Claude Code at session end)

**Repo orientation:**
- `README.md` — quick orientation for a new reader

---

## 6. Which files are app UI

In v0.1 before code: **none.** The frontend is not initialized at the foundation milestone.

When the frontend arrives at M1.1, UI files will live under `src/`:

- `src/main.tsx` — Vite entry point
- `src/App.tsx` — root component
- `src/routes/` — route components per `UI_ARCHITECTURE.md` §4
- `src/components/atoms/` — `TypeIndicator`, `StatusIndicator`, `SourceMark`, `UsageBadge`, `TagChip`, `ProvenanceMark`, `EmptyState` — the atoms inventoried in `UI_ARCHITECTURE.md` §21
- `src/components/items/` — `ItemCard`, `ItemCardCompact`, `ItemHero`, `ItemMetadataStack`, `ItemDescriptionBlock`, `RelationshipList`, `AnnotationPanel`, `EventTimeline`
- `src/components/triage/` — `TriagePanel`, `BulkTriageGrid`
- `src/components/search/` — `SearchBar`, `FilterDropdown`, `SmartFilterRail`, `ResultsGrid`
- `src/components/collections/` — `CollectionHeader`, `CollectionMembersGrid`
- `src/components/campaigns/` — `CampaignHero`, `CampaignAssetGroup`, `CampaignBriefEditor`, `CampaignTimeline`
- `src/components/chrome/` — nav, layout shell, capture trigger
- `src/styles/` — typography tokens, palette, base CSS

The grouping is by domain (items, triage, search) rather than by component-type abstraction (button, input, etc.). Domain grouping matches how features are built and how stop-and-ask boundaries are reasoned about.

---

## 7. Which files are feature logic

In v0.1 before code: **none.**

When feature logic arrives, it lives under `src/lib/`:

- `src/lib/pb.ts` — PocketBase client instance, scoped to the workspace
- `src/lib/queries/` — query helpers, one file per concern (`items.ts`, `relationships.ts`, `campaigns.ts`, `events.ts`, `annotations.ts`)
- `src/lib/types/` — TypeScript types mirroring the schema
- `src/lib/lifecycle.ts` — status transitions and validation
- `src/lib/rights.ts` — rights resolution (status precedence, attachment rules)
- `src/lib/anti-slop.ts` — banned phrase loader and length-cap enforcer (used when AI enrichment runs)
- `src/lib/events.ts` — event logger that all callers route through (no direct `item_events` writes)

The query helpers are the choke points where `workspace_id` enforcement is verified. A query that bypasses `src/lib/queries/` and uses the raw PocketBase SDK is a code smell that fails review.

Server-side feature logic lives in `pocketbase/pb_hooks/`:

- `pocketbase/pb_hooks/import.pb.js` — URL fetch on item creation, OG metadata extraction, content-type classification
- `pocketbase/pb_hooks/relationships.pb.js` — application-boundary relationship validation; symmetric canonical ordering is enforced by `trg_relationships_symmetric_ordering`
- `pocketbase/pb_hooks/events.pb.js` — automatic event logging for status changes, etc., when not handled by the client

The hooks enforce data invariants at the backend boundary. They do not duplicate UI logic.

---

## 8. Which files are PocketBase / database related

Everything PocketBase-specific lives under `/pocketbase`:

- `pocketbase/README.md` — setup and operation
- `pocketbase/pocketbase` — the binary itself, gitignored
- `pocketbase/pb_data/` — runtime database, files, logs; gitignored
- `pocketbase/pb_migrations/` — committed JS migration files; the source of truth for schema
- `pocketbase/pb_hooks/` — committed JS server hooks

`SCHEMA.md` at the repo root is the human-readable mirror of `pb_migrations/`. When they diverge, `pb_migrations/` wins as the source of truth, and `SCHEMA.md` is updated to match.

---

## 9. Which files are seed-data related

Everything seed-related lives under `/seed`:

- `seed/README.md` — seed data policy (mirrors `PLANNING_AUDIT.md` §11) plus how to run the loader
- `seed/load.ts` — the loader script (created in M0.1, run via `tsx` or `node --loader`)
- `seed/fixtures/*.json` — the curated 20–40 items as JSON, organized by entity:
  - `seed/fixtures/workspaces.json`
  - `seed/fixtures/sources.json`
  - `seed/fixtures/items.json`
  - `seed/fixtures/relationships.json`
  - `seed/fixtures/tags.json`
  - `seed/fixtures/collections.json`
  - `seed/fixtures/ai_annotations.json`

Final fixture file naming and shape is decided in M0.1 alongside the migration; the listing above is provisional.

The loader script connects to the local PocketBase via the JS SDK, authenticates as the Owner, and inserts fixtures in dependency order. It is idempotent: re-running with the same fixtures updates rather than duplicates.

The seed fixtures contain the canary item used by the v1 restore-test harness. In v0.1 the canary exists but is not yet wired into automated testing.

---

## 10. Which files are test-related

In v0.1 before code: **none.**

When tests arrive, they live next to the code they test:

- For React components: `src/components/items/ItemCard.test.tsx` next to `ItemCard.tsx`
- For library code: `src/lib/queries/items.test.ts` next to `queries/items.ts`
- For server hooks: `pocketbase/pb_hooks/import.test.pb.js` next to `import.pb.js`

Vitest is the runner for the frontend. PocketBase hooks are tested via the hook test harness PocketBase exposes.

There is no `/tests` directory at the repo root. The colocation pattern keeps tests close to their subjects and prevents the test directory from drifting into a separate codebase.

The two automated tests required by `PLANNING_AUDIT.md` v0.1 done criteria:

1. **`workspace_id` enforcement** — a test that exercises every query helper and asserts every emitted PocketBase API call includes `workspace_id` in its filter expression. Lives at `src/lib/queries/workspace-enforcement.test.ts` (created in M0.1 alongside the query helpers).
2. **AI canonical isolation** — a test that exercises the AI enrichment paths (even when stubbed) and asserts no canonical fields on `items` or extension tables are ever written. Lives at `src/lib/ai-isolation.test.ts` (created in M2 milestone when AI rendering arrives).

---

## 11. Where v1 / v1.5 / v2 deferred work should be documented

Without creating premature folders for deferred features, the convention is:

**Implementation-level deferred work:**

- Append a note to `docs/scope/release_layers.md` under the relevant layer's section. This document is the authoritative roadmap for layered delivery. New v1 / v1.5 / v2 work that surfaces during v0.1 implementation goes there.

**Architectural deferred decisions:**

- Create an ADR in `docs/decisions/`. ADRs are the decision log; deferred decisions get their own ADR with status `Deferred to v1` (or whichever layer). When the decision is taken up, the ADR's status is updated and a new ADR may supersede it.

**Operational deferred work:**

- For runbook content that belongs to v1 or later, do NOT create empty stub runbook files in `docs/runbooks/`. Instead, document the gap in `docs/scope/release_layers.md` under v1's "Infrastructure level" or "Governance level" section. Runbook files are created when the corresponding work is done — empty runbooks are misleading.

**Subagent deferred work:**

- The `docs/subagents/*.md` contracts already exist for all three subagents. Implementation status is described in `docs/scope/release_layers.md`: `import` partially active in v0.1, `ai-enrichment` optional in v0.1 and full in v1, `hygiene` deferred to v1.5. New observations about subagent behavior during v0.1 implementation that should change v1+ behavior get added to the relevant subagent's `.md` as a "Known v1+ refinements" section appended at the bottom of the file.

**UI deferred patterns:**

- New UI patterns or components that emerge as needed-eventually but not in v0.1 get added to `docs/component-rules.md` under the component class definition with a "Deferred to vN" note. This keeps the contract record complete without forcing implementation now.

Rule of thumb: **deferred work is a note appended to an existing governance document, not a new empty folder or empty stub file.**

---

## 12. Claude Code navigation rules for the filesystem

These are the rules Claude Code follows when navigating the filesystem during a session.

**Session start ritual:**

1. Read `CLAUDE.md` (operating protocol)
2. If `docs/sessions/YYYY-MM-DD.md` exists for today, read it
3. Read the section of `docs/scope/release_layers.md` for the current layer (v0.1 unless told otherwise)
4. Then proceed with the user's request

**Concern-to-document mapping:**

When the user raises a topic, Claude reads the documents listed in section 13 below before generating any code or producing a plan. This is not optional — improvising without the relevant governance is a stop condition.

**File-creation rules:**

- Files never appear outside their assigned folder. A new query helper goes under `src/lib/queries/`, never inline in a component file. A new ADR goes in `docs/decisions/` with the next sequential number.
- Files are never created speculatively. If a feature is not in the current milestone, its file does not exist.
- Empty files are never created to "claim" a future name. Either the file has content, or it doesn't exist.

**Naming rules:**

- Components are `PascalCase.tsx`. Queries and lib modules are `kebab-case.ts`. Tests share their subject's name with `.test.` infix. Migrations are numbered prefix + descriptive name: `0001_initial_schema.js`.
- ADRs are sequentially numbered: `00NN-short-topic.md`. Numbers are never reused.
- Session reports are `YYYY-MM-DD.md` per the format in `CLAUDE.md`.
- Runbooks are descriptive: `v0.1-backup.md`, `restore.md` (when v1), `environment.md` (when v1).

**Forbidden creation patterns:**

- No new top-level folders without a stop-and-ask. The five top-level folders (`docs/`, `pocketbase/`, `seed/` plus the deferred `src/` and `public/`) are the complete inventory.
- No new subagent definition files in `docs/subagents/` without a stop-and-ask. Three exist; new ones are an architectural change.
- No new files in `docs/decisions/` without a stop-and-ask — ADRs are governance commitments.
- No file or folder named anything that matches a forbidden component class from `docs/component-rules.md` (`KPICard`, `InsightCard`, `MetricTile`, `DashboardWidget`, `ItemDetailModal`, etc.).

**`.gitignore` discipline:**

- `pocketbase/pocketbase` (the binary) is gitignored
- `pocketbase/pb_data/` (the runtime data) is gitignored
- `.env` is gitignored; `.env.example` is committed
- `node_modules/`, `dist/`, build artifacts are gitignored
- `.DS_Store` and editor swap files are gitignored

The `.gitignore` itself is committed and complete from day one.

---

## 13. Documents Claude must read before touching specific concerns

A pragmatic mapping. Before generating code or a plan for the listed concern, Claude reads the listed documents in order.

**Schema (anything in `pb_migrations/` or `SCHEMA.md`):**
1. `CLAUDE.md` (stop-and-ask triggers)
2. `SCHEMA.md`
3. `docs/decisions/0001-atomic-unit.md` (item model)
4. `docs/decisions/0004-relationship-model.md` (relationship constraints)
5. `docs/decisions/0005-workspaces-and-privacy.md` (workspace_id propagation)
6. The current state of `pocketbase/pb_migrations/` — read all existing migrations in order
7. `PLANNING_AUDIT.md` §4 (metadata strategy)

Schema work is always a stop-and-ask. The reading happens before plan mode is entered.

**UI (anything in `src/components/`, `src/styles/`, or new routes):**
1. `CLAUDE.md` (UI hard rules section)
2. `UI_ARCHITECTURE.md` (full document)
3. `docs/ui-principles.md`
4. `docs/component-rules.md` (full document — this is the contract layer)
5. The relevant sub-section of `UI_ARCHITECTURE.md` for the surface being built (e.g., §8 for cards, §11 for campaigns)

**Items (anything affecting `items`, extension tables, or item lifecycle):**
1. `docs/decisions/0001-atomic-unit.md`
2. `SCHEMA.md` (items, extension tables, item_events)
3. `docs/component-rules.md` "Item detail rules" and "Card anatomy rules"
4. `UI_ARCHITECTURE.md` §8 and §9
5. `PLANNING_AUDIT.md` §4 (metadata strategy) and §8 (events)

**Relationships (anything affecting `relationships` or relationship semantics):**
1. `docs/decisions/0004-relationship-model.md`
2. `docs/relationships.md` (the type registry)
3. `SCHEMA.md` (relationships table, trigger, CHECK constraints)
4. `UI_ARCHITECTURE.md` §9 (relationship list rendering)

**Campaigns (anything affecting `campaign_profiles`, campaign UI, or campaign attachment):**
1. `docs/decisions/0002-campaigns.md`
2. `SCHEMA.md` (campaign_profiles)
3. `UI_ARCHITECTURE.md` §11
4. `docs/component-rules.md` "Campaign page rules" and "Rights warning rendering"
5. `PLANNING_AUDIT.md` §5 (rights model)

**Rights (anything touching `rights_status`, `rights_note`, or rights warnings):**
1. `PLANNING_AUDIT.md` §5 (the canonical rights model)
2. `docs/component-rules.md` "Rights warning rendering"
3. `SCHEMA.md` (items.rights_status, items.rights_note, items.rights_reviewed_at)
4. `docs/scope/release_layers.md` v0.1 section (rights chip only) and v1 section (full warning)

In v0.1, rights are chip-only (no warning component). The full warning ships in v1.

**AI annotations (anything touching `ai_annotations`, ProvenanceMark, or AI subagents):**
1. `docs/decisions/0003-ai-metadata.md`
2. `docs/subagents/ai-enrichment.md`
3. `docs/anti-slop/banned-phrases.md`
4. `docs/component-rules.md` "AI provenance rendering"
5. `SCHEMA.md` (ai_annotations table)
6. `PLANNING_AUDIT.md` §4 (metadata strategy, AI annotations row)

In v0.1, AI enrichment is optional. The full subagent activates in v1.

**Imports (anything touching `sources`, `import` subagent, or capture flows):**
1. `docs/subagents/import.md`
2. `SCHEMA.md` (sources, items, idempotency unique index)
3. `PLANNING_AUDIT.md` §3 (source / provenance metadata)
4. `docs/scope/release_layers.md` v0.1 section (manual capture only)

**Events (anything touching `item_events` or event logging):**
1. `PLANNING_AUDIT.md` §8 (event types and v1 inclusion)
2. `SCHEMA.md` (item_events table)
3. `docs/scope/release_layers.md` v0.1 section (event coverage list)
4. `docs/subagents/*.md` for each subagent's "Must log" section

For any concern not listed above, the fallback is: read `CLAUDE.md`, `CONSTITUTION.md`, and the most relevant ADR before proceeding.

---

## 14. Exact `mkdir` / `touch` commands

These commands assume the user is in an empty directory that will become the repo root. The user creates the directory (`mkdir archive && cd archive`) before running these.

**Step 1: Create the directory structure.**

```bash
mkdir -p docs/anti-slop \
         docs/decisions \
         docs/runbooks \
         docs/scope \
         docs/sessions \
         docs/subagents \
         pocketbase/pb_hooks \
         pocketbase/pb_migrations \
         seed/fixtures
```

**Step 2: Create the .gitkeep placeholders.**

```bash
touch docs/sessions/.gitkeep \
      pocketbase/pb_hooks/.gitkeep \
      pocketbase/pb_migrations/.gitkeep \
      seed/fixtures/.gitkeep
```

**Step 3: Place the existing governance documents.**

The following files exist from prior planning sessions. Copy each into the listed location in the new repo. Do not regenerate them.

```
CLAUDE.md                                  → archive/CLAUDE.md
CONSTITUTION.md                            → archive/CONSTITUTION.md
SCHEMA.md                                  → archive/SCHEMA.md
UI_ARCHITECTURE.md                         → archive/UI_ARCHITECTURE.md
PLANNING_AUDIT.md                          → archive/PLANNING_AUDIT.md

docs/anti-slop/banned-phrases.md           → archive/docs/anti-slop/banned-phrases.md
docs/component-rules.md                    → archive/docs/component-rules.md
docs/relationships.md                      → archive/docs/relationships.md
docs/ui-principles.md                      → archive/docs/ui-principles.md

docs/decisions/0001-atomic-unit.md         → archive/docs/decisions/0001-atomic-unit.md
docs/decisions/0002-campaigns.md           → archive/docs/decisions/0002-campaigns.md
docs/decisions/0003-ai-metadata.md         → archive/docs/decisions/0003-ai-metadata.md
docs/decisions/0004-relationship-model.md  → archive/docs/decisions/0004-relationship-model.md
docs/decisions/0005-workspaces-and-privacy.md
                                           → archive/docs/decisions/0005-workspaces-and-privacy.md

docs/subagents/import.md                   → archive/docs/subagents/import.md
docs/subagents/ai-enrichment.md            → archive/docs/subagents/ai-enrichment.md
docs/subagents/hygiene.md                  → archive/docs/subagents/hygiene.md

docs/scope/v1.md                           → archive/docs/scope/v1.md
docs/scope/release_layers.md               → archive/docs/scope/release_layers.md
docs/scope/filesystem_v0.1.md              → archive/docs/scope/filesystem_v0.1.md
```

**Step 4: Place the new files (created in this turn).**

```
README.md                                  → archive/README.md
.gitignore                                 → archive/.gitignore
.env.example                               → archive/.env.example
docs/runbooks/v0.1-backup.md               → archive/docs/runbooks/v0.1-backup.md
pocketbase/README.md                       → archive/pocketbase/README.md
seed/README.md                             → archive/seed/README.md
```

**Step 5: Initialize git.**

```bash
git init
git add .
git commit -m "Initial commit: governance and v0.1 scaffolding"
```

The first commit contains the full governance set and the v0.1 scaffolding. No code, no migrations, no fixtures. This is the cleanest possible starting point: the rules are committed before the artifacts they govern.

**Step 6: Verify the tree.**

```bash
find . -not -path './.git/*' -type f | sort
```

The output should match the file inventory in section 1 of this document, with each file accounted for.

---

## Historical next prompt

This was the next prompt at filesystem-planning time. It produced `docs/runbooks/m0.1-plan.md`; the migration has since been written and accepted.

> M0.1 begins. Stop-and-ask before any code or SQL is written.
>
> Produce the M0.1 implementation plan covering:
>
> 1. The local development setup procedure (PocketBase binary version, install steps, admin user creation, JS migration approach)
> 2. The first migration content as text only (every table from `SCHEMA.md`, every CHECK constraint, every FK, every index — written as plain text for line-by-line review, NOT yet committed to `pocketbase/pb_migrations/`)
> 3. The seed fixture spec (which item types appear, which sources, which relationship types, how many of each, which rights statuses, which AI annotation states — but no actual JSON yet)
> 4. The first three components in build order (`ItemCard` with the four-signal row contract, the signal-row atoms it depends on, `MasonryGrid`) — described as written specifications, NOT yet coded
>
> Do not initialize the frontend.
> Do not commit the migration to `pb_migrations/`.
> Do not write the loader script.
> Do not create fixture files.
> Do not write any TSX or JS or SQL.
>
> Produce the plan as a single document at `docs/runbooks/m0.1-plan.md` that the Owner reviews line by line before any code is written. The migration content within the plan is the most important part to review carefully.

After the M0.1 plan is reviewed and approved, the SQL/JS migration is committed in a follow-up turn. After that, the seed fixtures are written. After those, the frontend is initialized. Each step is a stop-and-ask.
