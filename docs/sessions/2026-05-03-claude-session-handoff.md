# Session Handoff — 2026-05-03

Resume context for picking up the personal-archive pivot and kinetic redesign in another tool (Codex, etc.).

---

## What this project is

A single-user personal archive (`vita-brain`) for visual and textual reference material. Earlier framings of "marketing campaigns archive" were retired — see ADR 0006. The current stack is:

- **Frontend:** Vite + React 19 + TypeScript, plain CSS with custom-property tokens, single `src/styles.css`.
- **Motion:** GSAP + ScrollTrigger + ScrollSmoother (all bundled in the `gsap` npm package since the Webflow acquisition). Wrapped at app boot in `src/motion/MotionShell.tsx`.
- **Backend:** PocketBase (Go binary + JS hooks). Custom endpoints under `/api/vita/*` defined in `pocketbase/pb_hooks/*.pb.js`. Schema in `pocketbase/pb_migrations/`.
- **Embeddings:** Ollama (`nomic-embed-text`) + `sqlite-vec` — referenced in CONSTITUTION but not wired in v1.

Branch: **`master`**. No remote. Uncommitted dev workflow.

---

## Recent commit history (most recent first)

```
c1d0a89  Replace topbar with vertical pill nav and metaball connections
2723c3c  Polish spotlight dock, drop the theme touchbar
f4e18e0  Add spotlight dock and rename "pieces" to "items"
d9cd04f  Add route cross-fades and fixture-mode item detail
e7aee7a  Replace topbar reveal keyframe with GSAP timeline
d1d1f60  Add GSAP motion shell with ScrollSmoother
b22b63f  Wire PocketBase hooks for the personal-archive lifecycle
e42f946  Rename topbar classes off ridgeway
3e6510a  Rewrite constitution for personal-archive pivot
e0d745f  Drop campaign and retirement, add Delete
647d471  Migrate to the personal-archive lifecycle
10bacab  Record pivot to personal archive
3f9cca4  Save in-progress redesign
24d60f4  Clarify archive and item-detail vocabulary
```

The pivot (10bacab → 3e6510a → all hooks/code) is fully landed. The kinetic redesign (d1d1f60 onward) is mid-flight.

---

## Personal-archive pivot — what changed (ADR 0006)

- Item types narrowed: `image | caption | note | link`. Dropped `campaign`.
- Lifecycle narrowed: `active | archived` plus hard delete. Dropped `inbox | triaged | retired`.
- Inbox is a smart view (a query), not a status.
- Hard delete cascades through relationships, item_tags, collection_items, ai_annotations, item_events, embeddings, and all type extension tables.
- `retired_by` relationship type removed from the registry.
- AI may now write directly to canonical fields under three guards: confidence threshold, banned-phrase scrubbing, mandatory ProvenanceMark. The earlier hard separation between AI annotations and canonical is loosened.
- Rights-warning system for campaign attachment is gone (campaigns are gone).
- Rights columns on `items` remain (rights_status, rights_note, rights_reviewed_at) — read but no longer enforced.

Migration `pocketbase/pb_migrations/0002_personal_archive_pivot.js` runs automatically on first PocketBase start. **Destructive — backup pb_data first.**

---

## Kinetic redesign — current state

### Motion vocabulary (locked across the app)

- **Open / enter:** `0.32–0.34s power3.out`
- **Close / exit:** `0.24–0.26s power3.in`
- **Content fade after enter:** `0.24s power2.out` with 60–80ms stagger after the shape resolves
- **Content fade before exit:** `0.16s power2.in`
- **Smooth scroll:** GSAP ScrollSmoother, `smooth: 1.2`

Every kinetic surface uses these. New surfaces should follow the same tokens.

### Surfaces wired

1. **`src/motion/MotionShell.tsx`** — boot ScrollSmoother once. Wraps `<App />` in `main.tsx`.
2. **Topbar reveal (legacy, removed in c1d0a89)** — was the first GSAP timeline. Replaced by PillNav.
3. **Route cross-fades** — App.tsx animates between grid / item / collection routes via a `routeRef` and a `renderedRoute` state that lags during fade-out.
4. **Spotlight dock** — `src/components/spotlight/SpotlightDock.tsx`. Bottom-centre frosted pill, ⌘K opens, mouse-leave + click-outside collapse, arrow indicator inside when open.
5. **Vertical pill nav** — `src/components/nav/PillNav.tsx`. Two-layer SVG goo metaball trick: blobs in `<filter id="pill-goo">`, labels above unfiltered.

### Style references

- **adamridgeway.com** — confirmed stack: Nuxt + GSAP + ScrollTrigger + ScrollSmoother + Three.js. Smooth scroll feel locked from this.
- **austen.fun** — confirmed `feGaussianBlur` + `feColorMatrix` for the metaball effect. **Note:** the current PillNav is *inspired* by this but is NOT a faithful replica of austen's nav. Austen's pills are tab-selector-style: pills are nav state indicators that morph the active blob between pills as the user changes pages, and the panels live elsewhere. The current PillNav is a panel-expander: each pill grows to contain its own panel content. This is a deliberate divergence (because vita-brain has more nav surfaces with content than a portfolio site) but worth revisiting if you want a closer aesthetic match.

---

## File map

```
src/
  App.tsx                              ─ root component, route shell, all data wiring
  main.tsx                             ─ root render, MotionShell boundary
  styles.css                           ─ single CSS file, ~1700 lines
  motion/
    MotionShell.tsx                    ─ ScrollSmoother + GSAP plugin registration
  components/
    atoms/                             ─ TypeIndicator, StatusIndicator, SourceMark, UsageBadge
    items/
      ItemCard.tsx                     ─ masonry tile
      MasonryGrid.tsx                  ─ CSS column-count grid
      ItemDetail.tsx                   ─ full detail view, sticky right rail with metadata + actions
    collections/
      CollectionView.tsx               ─ Pinterest-style editorial collection layout
    spotlight/
      SpotlightDock.tsx                ─ bottom-centre search dock, portal to body
    nav/
      PillNav.tsx                      ─ vertical pill column with metaball goo filter
  data/                                ─ all PocketBase readers and writers
    itemCardReader.ts
    pocketBaseItemCards.ts
    pocketBaseItemDetail.ts
    pocketBaseItemCapture.ts
    pocketBaseItemCollection.ts
    pocketBaseItemDelete.ts
    pocketBaseItemRelationship.ts
    pocketBaseItemStatus.ts
    seedItemCards.ts                   ─ fixture-mode card reader
    seedItemDetail.ts                  ─ fixture-mode detail reader (added in d9cd04f)

pocketbase/
  pb_hooks/                            ─ each file = one or more /api/vita/* endpoints
    item_capture.pb.js                 ─ POST /api/vita/item-capture
    item_cards.pb.js                   ─ GET  /api/vita/item-cards
    item_collection.pb.js              ─ collection-options, collection-detail, item-collection
    item_delete.pb.js                  ─ POST /api/vita/item-delete (cascade delete)
    item_detail.pb.js                  ─ GET  /api/vita/item-detail
    item_relationship.pb.js            ─ POST /api/vita/item-relationship
    item_status.pb.js                  ─ POST /api/vita/item-status (active <-> archived only)
  pb_migrations/
    0001_initial_schema.js
    0002_personal_archive_pivot.js     ─ runs on first PB start; destructive

docs/
  decisions/
    0001-atomic-unit.md
    0002-campaigns.md                  ─ partly superseded by 0006
    0003-ai-metadata.md                ─ partly superseded by 0006
    0004-relationship-model.md
    0005-workspaces-and-privacy.md
    0006-personal-archive-pivot.md     ─ canonical for current direction
  relationships.md                     ─ relationship-types registry mirror
  ui-principles.md                     ─ outdated re: motion stance after 0006; hasn't been rewritten
  component-rules.md                   ─ outdated re: campaigns and lifecycle
  sessions/
    codex-redesign-handoff-may-1-2026.md
    2026-05-03-claude-session-handoff.md   ─ this file
CONSTITUTION.md                        ─ rewritten 3e6510a; section 6 lifecycle, section 8 AI rules
CLAUDE.md                              ─ operating protocol; some hard rules now stale post-pivot
SCHEMA.md                              ─ may be stale post-migration (not verified)
```

---

## How to run

### Fixture mode (no backend)

```bash
unset VITE_ITEM_CARD_READER
cd /Users/vito/Desktop/vita-brain
npm run dev
```

Loads from `seed/fixtures/*.json`. Read-only demo. Item detail works via `seedFixtureItemDetailReader`. Capture / Delete / Status changes silently no-op (no backend).

### Live mode (real backend)

1. Download PocketBase macOS binary from `https://pocketbase.io/docs/`.
2. Place at `/Users/vito/Desktop/vita-brain/pocketbase/pocketbase`. `chmod +x`.
3. In one terminal: `./pocketbase/pocketbase serve` (port 8090). First run applies both migrations.
4. In another: `VITE_ITEM_CARD_READER=pocketbase npm run dev`.
5. Browser at 5173 talks to PocketBase at 8090 via the hooks.

The migration runs automatically on first PB start. **Back up `pb_data/` before running it on data you care about.**

### Keyboard

- `⌘K` — open spotlight dock
- `Esc` — close dock
- `M` — toggle light/dark theme

---

## Loose threads (in priority order I'd suggest)

1. **PillNav direction.** The current implementation is panel-expander; austen.fun is tab-selector. Decide whether to morph to austen-faithful (active blob slides between pills, panels go elsewhere) or keep the panel-in-pill approach and make the visual closer.
2. **Image hero / download in detail view.** Server-side: have `pocketBaseItemDetail.ts` build the file URL using PocketBase's `/api/files/` route. Frontend: render the image in `renderHero()` and add a real download button (currently text-types use clipboard, image type shows placeholder).
3. **Fixture detail completeness.** `seedFixtureItemDetailReader` returns empty arrays for tags / relationships / collections / aiAnnotations / events. Wire those from the existing fixture JSON files (10_item_tags.json, 13_relationships.json, etc).
4. **Item card hover.** Replace global `opacity 180ms ease` with a GSAP transform (subtle scale or translateY).
5. **Scroll-triggered fade-in for masonry items** as they enter viewport.
6. **CONSTITUTION + CLAUDE.md alignment.** Section 11 stop-and-ask rules and Section 12 subagents are partially stale post-pivot. `docs/ui-principles.md` and `docs/component-rules.md` predate the pivot and need a pass.
7. **Seed JSON fixture cleanup.** Files in `seed/fixtures/` still contain `campaign`-typed and `inbox`/`triaged`/`retired`-status rows. Stale data that the fixture readers skip via `defaultProofItemIds`, but the JSON itself is unclean.

---

## What I'd flag for whoever picks this up

- **The pill nav is the most likely thing the user will want to redo.** They said "you didn't correctly replicate the UI on austen.fun" right after I shipped it. Worth pulling up austen.fun in a browser and comparing live before iterating.
- **Browser MCP (Chrome) was flaky** in this session — screenshots and JS execution failed with "Cannot access a chrome-extension:// URL of different extension" intermittently. DOM reads worked. If picking up via Codex, may have a different / better browser story.
- **The migration is destructive on first run.** Triple-check `pb_data/` is empty or backed up before starting PocketBase against a real archive.
- **GSAP is free now** post-Webflow acquisition. ScrollSmoother and SplitText (premium plugins) ship in the npm `gsap` package.

---

*Written 2026-05-03. Master tip at handoff: `c1d0a89`.*
