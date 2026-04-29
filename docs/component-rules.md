# Component Rules

The prescriptive contracts that govern every UI component in the archive. When this document conflicts with `UI_ARCHITECTURE.md`, the architecture document defines structure and this document defines contracts; resolve disagreements by amending one or the other.

When a component contract is unclear, do not improvise. Stop and ask.

---

## Component philosophy

Components serve the core loop, not themselves. Every component must support at least one of: capture, inspect, connect, retrieve, reuse, retire, campaign memory.

Density over decoration. Type-driven hierarchy, not shadow-driven. Lines and space, not gradients and glow.

Every component declares an explicit contract: required props, forbidden props, accessibility requirements, state visibility. Components compose freely but never inherit complexity — a component does one thing and exposes it cleanly.

A component that exists for its own sake is removed. A component that needs three flags to look right is refactored.

---

## Card anatomy rules

The `ItemCard` is the most-rendered component in the product. Its contract is mandatory.

**Layout:**

- Content area on top: full-bleed image for `image` items, typeset text block for `caption` items, first-paragraph preview for `note` items, OG card for `link` items, cover image for `campaign` items.
- Signal row at the bottom, single line, always visible.

**Mandatory signal row, four elements in this order:**

1. **Type indicator** — a single character or short letter (`i` / `c` / `n` / `l` / `ç`). Type-driven, not iconographic.
2. **Status indicator** — short text label or colored dot: `inbox` / `triaged` / `active` / `archived` / `retired`. Retired items render the row in muted color across the board.
3. **Source mark** — short lowercase mark in monospaced font: `pinterest` / `arena` / `manual` / `url` / `ios`. Never abbreviated past recognizability.
4. **Optional usage badge** — `used 3×` when `used_in` count > 0; hidden when zero. Never `used 0×`.

The signal row is not hover-revealed. Not collapsible. Not dismissible. If the row would not fit at the chosen density, the density is too tight; the row is not the variable.

**Forbidden on cards:**

- Description text
- Tag chips
- AI annotation previews
- Hover-only metadata
- Drop shadows (`shadow-md`, `shadow-lg`, etc.)
- Corner radii > 4px
- Action buttons (cards link to detail; actions live on detail)
- Tooltips on chrome elements

**Allowed on cards:**

- Pending-AI indicator: a thin colored line on the card's left edge OR a small `ai · pending` mark in the signal row. Never both.
- Rights warning indicator: a small mark adjacent to the status indicator when `rights_status` is `restricted` or `expired`. Quiet, not alarming.
- Selection state: a single-pixel border in the structural accent color when multi-selected.

**Click and hover:**

- Click target is the entire card; navigates to item detail route.
- Hover state: a single-pixel border in the structural accent color, or a subtle background shift. No transform, no scale, no shadow lift.
- Long-press on touch: enters multi-select mode (mobile only).

**Card variants:**

- `ItemCard` — default masonry card
- `ItemCardCompact` — single-line list row, signal row only with thumbnail thumbnail, used in dense list views and search results
- `ItemCardEditorial` — larger render with more whitespace, used in collection detail and campaign hero areas

All variants share the four-signal-row contract. Compact and editorial differ in proportion, not in information.

---

## Item detail rules

**Item detail is always a route, never a modal.** This is non-negotiable. Modals do not survive deep linking, browser back, or sharing — and item detail is the primary referential surface in the product.

**Layout, top to bottom:**

1. **Hero** — full image render, typeset text block, OG preview, or campaign cover. Centered, max-width ~1200px on desktop.
2. **Metadata stack** — a right rail on desktop ≥1200px wide, below the hero on narrower viewports. Contains: editable title, type and status with controls, source link, created/updated timestamps, privacy chip with inheritance indicator, rights chip with status.
3. **Description and summary panels** — human-authored canonical text, editable in place. AI-suggested versions appear in a separate panel below, never in the same column.
4. **Tags** — two visually distinct rows: approved (chip style) and pending (dashed outline with `pending` affix). Never visually equivalent.
5. **Relationships** — typed list, each row showing relationship type, the other item's title and thumbnail, the note, and `asserted_by` mark. Hover reveals the full note.
6. **Collections** — chip row of collection memberships.
7. **Campaign attachments** — chip row with role indicator beside each.
8. **AI annotations panel** — collapsible. Default collapsed for non-inbox items, expanded for inbox items. Groups annotations by `field_name`. Each row carries a `ProvenanceMark`.
9. **Event timeline** — chronological list at the bottom. Filter by event type. Default: most-recent-first.

**Always-visible actions:**

- When `status='inbox'`: the triage controls (advance status, retire, attach to campaign, attach to collection)
- For all statuses: advance status (with allowed transitions), retire, attach to campaign, attach to collection, export, copy ID

Secondary actions (delete, hard-reset annotations, change rights status) live in a single overflow menu marked with a small caret. Never hidden behind multiple layers.

**Forbidden:**

- Item detail rendered in a modal, sheet, or drawer for any item type
- Tabs that hide event timeline behind clicks
- Carousel-style navigation between items
- Auto-advance to next item after action
- Any action button without a text label

---

## Campaign page rules

The most editorial surface in the product. Treat the layout like a portfolio project page, not a project tracker row.

**Required regions, top to bottom:**

1. **Hero** — cover image (the asset attached with `role='primary'`, if any) at large render. Title in display serif. Phase indicator next to title, distinct from status. Date range when set.
2. **Brief panel** — editable rich text (BlockNote). Markdown-supported.
3. **Attached assets** — grouped by role:
   - **Primary** — hero assets, larger render
   - **Supporting** — secondary visuals and copy, masonry
   - **Reference** — moodboard items, smaller render
   - **Retired-from** — assets that were once attached and have since been retired or replaced. Visually muted but visible. **This group is never hidden.** It is the campaign memory the product promises.
4. **KPI / post-mortem panel** — visible only when `phase` is `wrapping` or `post_mortem`. Free-form prose. Human-authored only.
5. **Relationships panel** — campaigns inspired by, references, retired by, contradicts.
6. **Event timeline** — full campaign history including every asset attachment, detachment, status change, phase change.

**Phase indicator vs. status indicator:**

- **Phase** lives on `campaign_profiles.phase`: `planning` / `live` / `wrapping` / `post_mortem`. Operational state.
- **Status** lives on `items.status`: `inbox` / `triaged` / `active` / `archived` / `retired`. Lifecycle state.

Both are rendered. Both are visible. They are not interchangeable. A campaign in `status='active'` can be `phase='wrapping'` simultaneously, and the rendering reflects both.

**Asset attachment:**

- Attachment requires a role selector. Default: supporting.
- Rights warning is rendered before attachment confirms. See "Rights warning rendering" below.
- Drag-and-drop targets are the role groups themselves, not a generic drop zone.
- Detachment moves the asset to retired-from group if the campaign is in `phase='live'` or later, otherwise removes the relationship cleanly.

**Cover image resolution:**

- If a primary-role asset exists, its image is the cover.
- If multiple primary-role assets exist, the first attached chronologically is the cover.
- If no primary asset, the cover area renders an editorial placeholder with the campaign title only — no stock image, no generic illustration.

---

## Collection / board rules

Collections are quiet organizational surfaces. They are not campaigns and they do not pretend to be.

**Required regions:**

1. **Header** — collection name in display serif, description in editorial prose (markdown supported), member count.
2. **Members grid** — masonry by default, density toggle preserved.
3. **Add affordance** — persistent input row at the top of the grid. Paste a URL, drag from anywhere, or trigger search-and-add.

**Forbidden:**

- Phase indicator
- KPI panel
- Aggregate timeline (events live on items, not aggregated at collection level)
- Cover image (collections do not have heroes; they have headers)
- Member sub-grouping (collections are flat; if grouping matters, that's a campaign)

---

## Inbox triage rules

The triage UI is where AI work meets human review. It is the most kinetic surface in the product.

**Required layout, desktop:**

- Left column: the next inbox item rendered at full size with all its pending AI annotations visible inline.
- Right column: the triage panel — quick-tag input with vocabulary autocomplete (approved tags only), pending AI tag suggestions with approve/reject, AI description / summary suggestions with approve/reject/edit-and-approve, collection picker, campaign attachment picker with role, status advance button, skip, retire.

**Required keyboard navigation:**

- `J` / `K` — move between inbox items
- `T` — focus tag input
- `A` — approve all AI suggestions for the current item
- `R` — reject all AI suggestions for the current item
- `Enter` — promote to active
- `S` — skip (defer to next session)
- `X` — retire from inbox
- `Esc` — close panels

Keyboard shortcuts are visible in a small hint area; not memorized-only.

**Required behaviors:**

- Skip defers, does not dismiss. Skipped items return to the inbox queue.
- Bulk triage mode toggles to a multi-select grid for batch tag, batch advance, batch retire.
- Empty inbox state: a single editorial line, "Inbox is clear." No streak counter, no badge, no "great job," no celebratory animation.
- Triage actions log appropriate events (`status_changed`, `tagged`, `annotation_approved`, `annotation_rejected`, `collection_added`, `campaign_attached`).

**Forbidden:**

- Auto-advance after approve or reject (the user controls the flow)
- "Smart suggestions" or "AI recommends advancing this" prompts
- Streak counters, badges, achievement notifications
- Hidden "more options" panels for primary triage actions

---

## AI provenance rendering

Every AI-rendered string carries a `ProvenanceMark`. No exceptions.

**`ProvenanceMark` contract:**

- Required: `model_name`, `review_status`
- Optional: `model_version`, `prompt_version`, `confidence`
- Visual: a small monospaced tag rendered adjacent to the AI content, in muted color
- Example rendering: `claude-sonnet-4 · 0.78 · pending`

**Visual treatment by review state:**

- **Pending** — dashed outline on container, muted color, `pending` affix in the ProvenanceMark
- **Approved** — full color, no affix; the ProvenanceMark is still rendered but compactly (model name only on hover)
- **Rejected** — visible only in audit views, struck through, with rejection timestamp
- **Superseded** — visible only in history views

**Pending tags specifically:**

- Rendered with dashed border and muted text color
- Carry `pending` affix or a small `ai` mark
- Excluded from autocomplete in tag pickers
- Excluded from default search filters
- Reachable only via the triage UI or the suggestions queue

**Approved tags from AI:**

- Visually equivalent to user-applied tags (chip style, full color)
- Searchable, applicable in autocomplete
- Hover reveals `ai` mark in the ProvenanceMark
- Approved tags are the only AI-originated content that visually integrates with human-authored content; this is intentional and limited

**Promotion to canonical:**

- Always an explicit user action. Never automatic.
- Button label: `Promote to canonical description` (or whatever field). Never `Save`, never `Apply`.
- Promotion creates a canonical write AND preserves the annotation row.
- Promotion logs `annotation_approved` plus the canonical-write event.

**Forbidden:**

- AI content rendered indistinguishably from canonical
- "Smart" or "Enhanced" labels in lieu of model names
- Hiding the ProvenanceMark behind hover when content is pending or rejected
- Auto-promoting high-confidence annotations (no confidence threshold makes auto-promotion acceptable)

---

## Rights warning rendering

The archive is no longer legally blind. The UI renders rights state visibly and applies soft enforcement at the moment that matters most: campaign attachment.

**`RightsChip` contract:**

- Renders the `rights_status` value compactly on item detail
- Visual treatment by status:
  - `unknown` — neutral chip, italicized
  - `reference_only` — neutral chip with subtle qualifying mark
  - `approved_for_internal_use` — quiet chip, no warning state
  - `approved_for_external_use` — quiet chip, no warning state
  - `restricted` — high-contrast warning chip, red or orange accent
  - `expired` — high-contrast warning chip, red or orange accent

**`RightsWarning` component, rendered at the moment of campaign attachment:**

Three states based on attachment context and `rights_status`:

1. **None** — attachment proceeds without prompt. Triggered when `rights_status` is `approved_for_internal_use` or `approved_for_external_use`. Or when attaching `reference_only` to a campaign with no public-facing role.

2. **Advisory** — modal with warning, override allowed, note required. Triggered when:
   - `rights_status='unknown'` and attached at any role
   - `rights_status='reference_only'` and attached at `role='primary'` or `role='supporting'`
   - The warning explains the specific concern. The user types a justifying note. The override and the note are logged as an event.

3. **Blocking** — modal with warning, no override, attachment refused. Triggered when:
   - `rights_status='restricted'`
   - `rights_status='expired'`
   - The dialog explains the block and offers two paths: change the rights status (with reason), or cancel. There is no "override anyway" button.

**Required behaviors:**

- Every attachment that triggers a rights warning logs an event in `item_events` regardless of outcome (`campaign_attached` with `metadata.rights_warning_state` and `metadata.override_note` when relevant).
- The hygiene subagent flags `unknown` items used in active campaigns and items with rights warnings overridden in the last 30 days.
- Rights status changes are themselves events; changing from `unknown` to `approved_for_external_use` is logged.

**Forbidden:**

- Silent attachment of `restricted` or `expired` items, even at low role
- Override of blocking states without an explicit rights-status change
- Hiding the warning behind hover or a checkbox the user can dismiss permanently
- Visual treatment that makes warnings feel like marketing decoration rather than legal caution

---

## Empty state rules

Every empty state has three required parts. No exceptions.

1. **Title** — a single short editorial line, serif type
2. **Why** — one paragraph explaining the empty condition in plain language
3. **Action** — one concrete next-step, rendered as a button or input

**Forbidden in empty states:**

- Decorative illustrations of empty boxes, cute robots, or floating documents
- Emoji or icon as the primary visual anchor
- Motivational copy ("You got this!", "Time to get started!")
- Multiple competing actions
- Skeleton loaders shown when the state is empty by reality, not loading

**The empty-inbox state is its own special case:**

- Title: `Inbox is clear.`
- No why-paragraph required
- No action required
- No streak counter, no badge, no celebration animation

Reaching empty-inbox is not gamified. It is a quiet result of work done.

---

## Graph view rules

The graph is the most likely place to ship decorative theater. Discipline here is non-negotiable.

**Default behavior:**

- Default zoom shows ≤30 nodes. If a query would render more, the system tells the user to filter further. The system does not auto-decimate.
- Force physics OFF by default. Static layout. Physics toggles on for exploration only.
- Edges are typed and color-coded consistently across all graph views.
- Symmetric edges render with solid stroke, no arrowheads.
- Directional edges render with arrowheads.
- Node sizing reflects event count — recently-engaged work renders larger.

**Required interactions:**

- Hover an edge — tooltip shows relationship type, weight, note, `asserted_by`, plus an "explain this connection" affordance
- Click a node — side panel slides in from the right with item summary and "open detail" link; the graph stays visible
- Click an edge — tooltip with full metadata
- Filter sidebar — collapsible, with: type, relationship type, status, collection, campaign, date range

**Forbidden:**

- 3D rendering
- Particle effects, ambient motion, decorative bg patterns
- Auto-running force simulation as a "live" effect
- Glowing nodes, pulsing edges, animated colors
- Hairball default views (the `>30 nodes` limit prevents this; do not bypass)
- Hidden edge labels (hover-only is acceptable; no-label-ever is not)

---

## Table view rules

Tables are tools, not the home. They are used for:

- Hygiene reports
- Bulk audit operations
- Source administration (`/settings/sources`)
- Tag administration (approval queue)
- Annotation suggestions queue (when not in per-item context)

**Required behaviors:**

- Tables NEVER render as the default landing of any route except settings pages
- Each row carries the four-signal row pattern (type, status, source, optional usage) — even in compact form, these are not omitted
- Bulk action toolbar appears on selection, dismissable, sticky to top of viewport
- Sort by column with explicit headers; no implicit sort

**Forbidden:**

- Tables as the home view for archive, collection, or campaign content
- Table-first identity (the product is masonry-first; tables are escape hatches)
- Pivoting / cross-tabulation features (deferred indefinitely)
- Spreadsheet-like inline editing across many cells (use detail views)

---

## Mobile vs desktop component rules

**Desktop is primary.** Mobile renders a focused subset.

**Components rendered on mobile:**

- `ItemCard`, `ItemCardCompact`
- `MasonryGrid` (with reduced density options)
- `ItemDetail` (simplified — collapsible event timeline, reduced metadata stack)
- `SearchBar`
- `CaptureFlow` (the polished mobile primary)
- `TagRow` (read-only by default)

**Components NOT rendered on mobile:**

- `GraphCanvas` (reachable but not optimized; the user can view a node's neighbors via item detail relationships, not via the graph)
- `BulkTriageGrid` (single-item triage only on mobile)
- `CampaignBriefEditor` (read-only; full editing prompts "Open on desktop")
- `HygieneDigest` (summary-only; full reports are desktop)
- `SourceSettingsTable`, other settings tables

**Mobile-specific behaviors:**

- Bottom nav: Inbox, Search, Capture, Graph
- Long-press on item card to enter multi-select mode
- Swipe gestures on inbox items: swipe-left to retire, swipe-right to advance — but always with a visible button alternative
- Capture is one tap from anywhere

**Forbidden mobile compromises:**

- Reducing desktop density to match mobile constraints
- Hiding desktop affordances behind disclosure when they would otherwise be visible
- Simplifying campaign or item detail in ways that lose the four-signal-row contract
- Mobile-first design tradeoffs that weaken the desktop primary surface

---

## Forbidden component patterns

**Named forbidden component classes:**

The following must never be created. If a request seems to call for one, stop and ask.

- `KPICard`
- `InsightCard`
- `MetricTile`
- `DashboardWidget`
- `WelcomeBanner`
- `StatsCard`
- `ItemDetailModal` (item detail is always a route)
- `HoverOnlyActionBar`
- `InfiniteFeed`
- `EngagementBadge`
- `StreakCounter`
- `AchievementToast`
- `SmartSuggestion` (any component with "Smart" in its name)
- `AIInsight` (any component with "Insight" in the AI sense)
- `EnhanceWithAI` (any "Enhance" / "Magic" / "Auto-organize" labeled affordance)

**Forbidden visual patterns:**

- Soft drop shadows on cards (`shadow-md`, `shadow-lg`, etc.)
- Gradient backgrounds, except as the photographic content of an item
- Glassmorphism / `backdrop-blur` on chrome
- Purple-to-pink AI-startup gradients
- Floating orbs, decorative blobs, animated bg patterns
- Particle effects of any kind
- Auto-playing video or GIF in chrome (in-content media is fine)
- Toast notifications for non-critical events
- Skeleton loaders that shimmer with color animation (a static placeholder is fine)
- Round avatars (defer until multi-user; meanwhile, no avatars)
- Confetti, fireworks, or any celebration animation
- Pulsing dots indicating "AI thinking" — show progress textually if needed

**Forbidden labels:**

- "Smart"
- "AI Insights"
- "Auto-organize"
- "Enhance"
- "Magic"
- "Powered by AI"
- "Recommended for you"
- "We noticed..."

When AI does something, name the model and the action. `Generated by claude-sonnet-4 · 142 tokens` is acceptable; `AI Insights` is not.

---

## shadcn customization rules

shadcn is starting material, not finished UI. Every shadcn primitive ships with a customization layer specific to this product.

**Required customizations applied globally before any component renders:**

- Corner radius reduced to 0–4px maximum (override `radius` token)
- Drop shadows replaced with single-pixel borders (`shadow-*` tokens emptied; `border` tokens carry the visual weight)
- Default color tokens overridden with the editorial palette
- Default fonts replaced with serif + sans pairing
- Default focus ring replaced with a single-pixel rule in the structural accent color

**shadcn components used as-is (chrome only):**

- `Dialog` — for confirmations, rights warnings, blocking states
- `DropdownMenu` — for action menus
- `Select` — for picker fields
- `Tooltip` — for hover-revealed labels and provenance details
- `Popover` — for compact contextual UIs

**shadcn components forbidden in default form:**

- `Card` — must use a customized `ItemCard`, `ItemCardCompact`, or `ItemCardEditorial` with the four-signal-row contract
- `Toast` — no toast system for critical events; use the dialog pattern or persistent visual state
- `Sheet` / `Drawer` — anything important is a route, not a sheet
- `Avatar` — defer until multi-user
- `Badge` — must be replaced with `TagChip`, `StatusIndicator`, `ProvenanceMark`, or other named atoms

When a shadcn component is shipped, the customization is applied; the un-customized version never reaches users.

---

## Stop-and-ask before UI changes

Claude Code enters plan mode and requests explicit approval before any of the following:

1. Adding any forbidden component class (see list above)
2. Modifying the `ItemCard` four-signal-row contract
3. Modifying the `ProvenanceMark` contract
4. Removing or weakening rights warning behavior at any campaign-attachment flow
5. Adding hover-only behavior to a core action
6. Introducing any icon without a text label, or any unlabeled mystery icon
7. Adding a new top-level route
8. Modifying the empty-state required-parts contract
9. Removing keyboard navigation from triage, search, or graph flows
10. Adding any auto-play, auto-advance, or auto-promote behavior
11. Adding any "smart," "auto," "magic," or "AI insight" labeled element
12. Rendering item detail in a modal, sheet, or drawer
13. Rendering an empty state without title-why-action structure
14. Bypassing the `>30 nodes` graph zoom limit
15. Using shadcn primitives without the required customization layer
16. Adding decorative bg patterns, particle effects, or motion graphics on chrome
17. Modifying the rights warning thresholds, override flow, or note requirement
18. Modifying any contract in this document
19. Adding a new component variant that requires more than three boolean flags to render correctly

The trigger applies even when the request seems to be a small refactor. The cost of asking is one round-trip; the cost of an undisciplined component is permanent surface degradation.
