# UI Architecture

The interface for a visual research instrument with campaign memory underneath. Editorial in pacing, dense in information, quiet in chrome, unmistakably non-corporate.

This document is opinionated and prescriptive. When it conflicts with `ui-principles.md` or `component-rules.md`, this document wins until amended.

---

## 1. Interface philosophy

The product is a research instrument, not a destination. It earns its place by disappearing in service of the work — the work being capturing visual material, connecting it across time and intention, and remembering how it was used.

Two modes are braided through every screen:

**Drift mode.** Browsing, discovering, surfacing. Image-first, masonry-laid, low-friction. The mode in which you encounter material.

**Work mode.** Triaging, retiring, attaching to campaigns, approving annotations. Dense, kinetic, deliberate. The mode in which you turn material into memory.

The interface never picks one and abandons the other. Every drift surface carries enough work-mode affordance that the user can act without leaving; every work surface preserves enough drift-mode pacing that the user doesn't feel they've descended into a database.

The product is closer to a magazine contact sheet than to a Pinterest board, closer to a research notebook than to a Notion workspace. The reference frame is editorial publishing, not productivity software.

## 2. Visual principles

**Palette.** Near-monochrome base — paper white or warm off-white in light mode, deep ink in dark — with a single structural accent color used sparingly for state (selected, active link, focus ring). No gradients. No purple glow. No glassmorphism.

**Typography.** A real serif for editorial surfaces (titles, briefs, descriptions, empty-state copy) paired with a strong neutral sans for system text and dense UI. The serif carries identity; the sans carries scaffolding. Type does the structural work that gradients and shadows do in SaaS UI.

**Lines and space, not shadows.** Hierarchy comes from rules, dividers, and whitespace. Soft drop-shadows on cards are forbidden — they're the shadcn default that makes every AI-built product look alike.

**Corner radii.** 0–4px maximum. Most surfaces are square. Pill shapes are reserved for chips and tags.

**Density.** Calm density. Information-rich but quiet. Cards are tight, not lonely. Detail views breathe but never sparse to the point of hiding metadata.

**Movement.** Minimal and functional. State transitions: 80–150ms. Type can be alive in moments of identity (header marks, empty-state hero phrases) but never in chrome.

**Provenance is visible.** Every AI-rendered string carries a thin treatment — a left rule, a small monospaced model tag, a muted color — that distinguishes it from human-authored content at a glance. This is not optional decoration; it's the rendering of the ADR 0003 separation.

**Status is visible.** Lifecycle status appears on every card and every detail view. Inbox, triaged, active, archived, retired are not hidden in dropdowns.

## 3. Navigation model

**Desktop:** A persistent left rail with seven destinations: Inbox, Archive, Collections, Campaigns, Graph, Search, Hygiene. Below: the workspace switcher (only when more than one workspace exists). The rail is narrow, type-driven, no icons-only collapsed state — labels are always visible.

The Inbox entry always shows a debt count when items have been in inbox longer than the configured threshold. The count is a quiet pressure mechanism, not a notification badge.

The Hygiene entry shows a flag count when hygiene reports have outstanding items.

The top of the screen carries a single global search trigger (cmd-K) and a capture trigger. No breadcrumbs except in deep nested routes.

**Mobile:** Bottom nav with four destinations: Inbox, Search, Capture, Graph. Collections and Campaigns are reached through Search or directly via deep link. Capture is one tap from anywhere.

## 4. Information architecture

Top-level routes:

- `/inbox` — quarantined captures, default landing on first visit of the day
- `/archive` — active items, the working surface
- `/collections` — collection index
- `/collections/:id` — single collection
- `/campaigns` — campaign index
- `/campaigns/:id` — single campaign
- `/items/:id` — full item detail (always a route, never a modal)
- `/graph` — filterable typed graph
- `/search?q=...&filters=...` — search results
- `/hygiene` — full hygiene digest
- `/settings/sources` — per-source defaults
- `/settings/banned-phrases` — anti-slop blocklist administration
- `/settings/workspaces` — workspace management

Item detail is always a route. Never a modal. Modals don't survive deep linking, browser back, or sharing. The cost of a route navigation is acceptable; the cost of opaque modal state is not.

## 5. Main views

**Home / Inbox.** Default landing. Two stacked sections: a triage column on the left showing the next ten inbox items in chronological order, and a hygiene digest on the right showing today's flags. No welcome card, no metrics, no "good morning."

**Archive.** The working surface. Masonry grid of active items. Filter rail on the left (or top, on narrower viewports). Density toggle in the header (comfortable / dense / editorial).

**Collection detail.** Are.na-influenced. Title, description (markdown supported), masonry grid of members. Editorial pacing — more whitespace than archive, larger type for the collection title.

**Campaign detail.** The most editorial surface in the product. Cover image, title, brief, phase indicator, dates. Attached assets grouped by role. KPI/post-mortem panel when phase is wrapping or post-mortem. Full event timeline at the bottom.

**Item detail.** The full provenance page. Hero rendering, metadata stack, description, tags, relationships, collections, campaign attachments, AI annotations panel, event timeline.

**Graph.** Full-window typed graph. Filter sidebar collapsible. Side panel from a clicked node shows item summary without losing the graph view.

**Search.** Results render in masonry by default; toggle to compact list. Filters in a dropdown beside the search bar. Recent and saved searches in a left rail.

**Hygiene.** A long scrolling page of report sections, each with its own count and triage actions.

## 6. Inbox triage UI

The inbox is the pivot of the system. Triage is where AI work gets reviewed, tags get applied, items advance to active.

The triage UI is split: on the left, the next inbox item rendered at full size with all its AI annotations visible inline. On the right, a triage panel containing:

- Quick-tag input with vocabulary autocomplete (approved tags only)
- Pending AI tag suggestions, each with approve / reject buttons
- AI description / summary suggestions, each with approve / reject / edit-and-approve
- Collection picker (multi-select)
- Campaign attachment picker with role selector
- Status advance button: "Promote to active"
- Skip button (defers to next session)
- Retire button (for items that should not graduate)

Keyboard navigation: J / K to move between inbox items, T to focus tag input, A to approve all AI suggestions for the current item, R to reject all, Enter to advance to active, Esc to close.

Bulk triage mode toggles to a multi-select grid where tags, collections, and status changes apply to all selected items.

The empty-inbox state is its own celebration but does not gamify. A single line: "Inbox is clear." No streak counter, no achievement, no sparkles.

## 7. Archive / gallery UI

Masonry grid of active items. Image items render their image; caption items render the caption text in a typeset block; note items render the first paragraph; link items render OG preview; campaigns render their cover.

Filter rail (left on desktop, top sheet on mobile):

- Type (image, caption, note, link, campaign)
- Status (active, archived; retired hidden by default, opt-in)
- Tag (approved tags only; pending tags reachable via search)
- Collection
- Campaign
- Source
- Date captured
- "Has pending AI annotations"
- "Used in campaign in last 30 days"
- Negative/temporal: "tagged X but not used in 60 days," "in inbox >14 days"

Sort: recently captured (default), recently used, recently modified.

Density toggle: Comfortable (3–4 columns), Dense (5–6 columns), Editorial (2–3 columns with more whitespace, magazine-like).

## 8. Item card anatomy

The card is the smallest unit of the product. Mandatory anatomy:

```
┌──────────────────────────────┐
│                              │
│      [content render]        │  ← image / caption / note / link / campaign cover
│                              │
├──────────────────────────────┤
│ ◯ image · active · pinterest │  ← signal row (always visible)
└──────────────────────────────┘
```

The signal row carries four elements:

1. **Type indicator.** A small symbol or letter (i, c, n, l, ç for campaign). Type-driven, not an icon set.
2. **Status indicator.** A small label or dot: inbox, triaged, active, archived, retired. Color-coded sparingly — retired is muted, others are neutral.
3. **Source mark.** A short text mark — `pinterest`, `arena`, `manual`, `url`, etc. Lowercase, monospaced.
4. **Optional usage badge.** "used 3×" appears when used_in count > 0. Hidden when zero.

The signal row is always visible. Never hover-revealed.

Description, tags, AI annotations are NOT on the card. They live in detail.

A pending-AI-annotations indicator may appear: a thin colored line on the card's left edge or a small `ai · pending` mark in the signal row. Never both.

The card has no soft shadow. Hover state: a single-pixel border in the structural accent color, or a subtle background shift.

## 9. Item detail anatomy

A full route, not a modal. Layout:

**Hero.** Image at large render, or caption / note typeset as editorial content, or campaign cover. Full width on desktop up to a max-width (~1200px); centered on the page.

**Metadata stack.** A right-side rail or below-hero band. Contains:

- Title (editable)
- Type, status (with advance/retire controls)
- Source (with link to source URL)
- Created at, updated at
- Privacy chip (with inheritance indicator)

**Description and summary.** Editorial type. Human-authored fields are direct. AI-suggested versions render in a separate panel below, never in the same column as canonical text.

**Tags.** Two visually distinct rows: approved tags first (chip style), pending AI-suggested tags second (dashed outline style with `pending` affix). Click an approved tag to filter archive; click a pending tag to approve / reject.

**Relationships.** A typed list. Each row: relationship type (color-coded), the other item's title and thumbnail, the relationship note (if any), asserted_by mark. Hover reveals "explain this connection" — full note plus relationship metadata.

**Collections.** Chip row of collection memberships. Click to navigate to the collection.

**Campaign attachments.** Same shape as collections, with role indicator next to each.

**AI annotations.** Collapsible panel showing all annotations on this item, grouped by field_name. Each annotation: model, version, confidence, review status, payload preview, approve / reject / supersede actions.

**Event timeline.** Chronological list at the bottom. Compact rendering: timestamp, actor, event type, brief description. Filter by event type. Defaults to most-recent-first.

**Actions.** Always visible: triage controls (when status=inbox), advance status, retire, attach to campaign, attach to collection, export, copy ID. Secondary actions (delete, hard-reset annotations) live in a small overflow menu.

## 10. Collection / board anatomy

Collections are organizational, not entities with phase or KPIs. The detail page is quiet:

**Header.** Collection name in serif display type. Description in editorial prose, markdown supported. Member count.

**Members.** Masonry grid of member items, with the same item-card anatomy as archive.

**Add affordance.** A persistent input row at the top of the grid: paste a URL, drag from anywhere, or "add from search."

**Bulk actions.** Select-multiple to remove from collection, retire, attach to campaign.

No phase indicator, no KPI panel, no timeline (the events on collection_added / collection_removed are visible at the item level, not aggregated at the collection level).

## 11. Campaign page anatomy

The most editorial surface in the product. A campaign feels like a project page in a portfolio, not a row in a project tracker.

**Hero.** Cover image (the asset attached with role=primary, if any) at large render. Campaign title in display serif. Brief in editorial type.

**Phase indicator.** A small mark near the title: planning, live, wrapping, post_mortem. Distinct from item.status — both are visible.

**Dates.** start_at and end_at, when set. Rendered as ranges in compact text.

**Attached assets.** Grouped by role:

- *Primary* — the hero assets, rendered larger
- *Supporting* — secondary visuals and copy, masonry
- *Reference* — moodboard items, smaller renders
- *Retired from* — assets that were once attached and have since been retired or replaced. Visually muted but visible. This is the "campaign memory" the product name promises.

Each group has an attach affordance. Drag-and-drop or pick from search.

**Brief panel.** Editable rich text. Markdown or BlockNote-style.

**KPI / post-mortem panel.** Visible when phase is wrapping or post_mortem. Free-form prose; the user describes what worked.

**Relationships panel.** This campaign's place in the graph: inspired_by other campaigns, references moodboards, contradicts other concepts, retired_by a successor.

**Event timeline.** Full campaign history: every asset attachment, detachment, status change, phase change, retirement.

**Actions.** Change phase, change status, attach asset (with role picker), detach asset, retire campaign, export brief, link to successor (creates retired_by relationship).

## 12. Graph view behavior

The graph is the most likely place to ship a decorative hairball. The discipline:

**Default zoom.** Show ≤30 nodes. If a query would render more, force the user to filter further. The system never auto-decimates — it tells you to filter.

**Edges are typed and color-coded.** Each relationship type has a color that is consistent across all graph views. Edge labels appear on hover. Symmetric edges render with a different stroke style (solid) than directional ones (arrowed).

**Node sizing by event count.** A node's size reflects activity — items with many events render larger. This makes the recently-engaged work visually prominent without ranking algorithms.

**Force physics off by default.** Static layout. Physics toggles on for exploration only. Stability over animation.

**Filters in a left sidebar.** By type (image / caption / note / link / campaign), by relationship type, by status, by collection, by campaign, by date range.

**Click a node** → side panel slides in from the right with item summary, key metadata, and a "open detail" link to navigate to the route. The graph stays visible.

**Click an edge** → tooltip shows the relationship type, weight, note, asserted_by, and a one-click "explain this connection" affordance.

**No 3D.** No physics-driven node bouncing. No background particle effects.

## 13. Search behavior

A single global search bar (cmd-K). Default behavior: full-text on canonical fields plus tag match, scoped to the current workspace.

Filters live in a dropdown beside the search bar, not in a separate panel:

- Type
- Status
- Tag (approved only by default; toggle to include pending)
- Collection
- Campaign
- Source
- Date range
- Has pending AI annotations
- Stale / overused / orphaned (links to hygiene-style queries)
- Negative query: "tagged X but not used in N days"

Results render in masonry by default; toggle to compact list for dense work.

"More like this" is a separate action available from any item detail, with two modes:

- *Textually similar* (semantic embedding via nomic-embed-text)
- *Visually similar* (perceptual hash + visual_dna annotation)

Recent searches and saved smart filters live in a left rail.

Search never autoplays media, never auto-advances, never injects suggestions you didn't ask for.

## 14. AI suggestions UI

AI suggestions live in three places:

**Inline on the item being triaged.** During inbox triage, the next item shows all its pending AI annotations beside the canonical fields. Each annotation is approveable / rejectable in place.

**Per-item annotations panel.** On every item detail, a collapsible "AI annotations" panel shows the full annotation history — pending, approved, rejected, superseded. Includes model, version, prompt version, confidence.

**Global suggestions queue.** Reached from the nav. Lists every pending annotation across the workspace, grouped by item or by field_name. Bulk approve / reject by run, by model, by field_name.

**Visual treatment.**

Pending annotations: dashed outline, muted color, `pending` affix near the model tag. Tags rendered with dashed border.

Approved annotations: full color, no affix. Tags chip-styled, indistinguishable from human-applied tags except for an `ai` mark on hover or in the side panel — they're searchable and trustable.

Rejected annotations: visible only in audit views, struck through, with rejection timestamp.

Superseded annotations: visible only in history views.

Promotion to canonical is always an explicit user action — never automatic. The button reads: "Promote to canonical description" not "Save."

## 15. Event / history UI

Event timelines appear in two places: per-item (the bottom of every item detail) and per-campaign (the bottom of every campaign detail).

**Compact rendering.** Each event row: timestamp (relative on hover, absolute in tooltip), actor mark, event type, one-line description. Annotations appear as events with a "view annotation" link.

**Filter by event type.** A dropdown above the timeline.

**Status changes are prominent.** A status_changed event renders larger or with a leading rule, distinct from minor events like tagged.

**Annotations cycle visibly.** annotation_added → annotation_approved or annotation_rejected → annotation_superseded events tell the story of how AI work was reviewed.

The timeline is the audit trail rendered. It is the raw material for trust — when in doubt about an item's history, the user can read it.

## 16. Workspace / privacy UI

**Workspace switcher.** Top-left, persistent only when count > 1. Single-workspace users never see it. When visible, a small dropdown with workspace name and kind (`personal` / `business`).

**Per-source settings.** A page under settings showing every source with its default_privacy_level and recent activity. Editable inline.

**Per-item privacy override.** On item detail, a privacy chip with two visual states:

- *Inheriting:* "Personal (from Pinterest source)" in muted text
- *Overridden:* "Private (overridden)" in canonical text with a small "reset to source default" link

**Privacy is advisory.** A line of help text in privacy settings reads: "Privacy levels are advisory metadata for your own organization. They are not access controls or security boundaries." This is non-negotiable copy — without it, users will assume access enforcement that doesn't exist.

**Cross-workspace sharing.** Hidden until the second workspace is created. When introduced, will appear as a relationship type — not as a permissions retrofit.

## 17. Empty states

Every empty state has three required parts: title, one-paragraph why, concrete next action. No aesthetic-only empty states.

**Empty inbox:** "Inbox is clear." / "Capture via iOS share sheet, browser extension, or paste a URL into the capture bar." / [Open capture]

**Empty archive:** "No active items yet." / "Active items appear here after you triage them out of inbox. New imports land in inbox first." / [Open inbox]

**Empty collection:** "This collection is empty." / "Add items by dragging from anywhere in the archive, pasting a URL, or using the search-and-add affordance below." / [paste field]

**Empty campaign:** "This campaign has no attached assets." / "Attach a primary asset to begin. Supporting and reference assets can be added later. As the campaign runs, retired assets will appear in the Retired-from group." / [Attach primary]

**Empty graph:** "No relationships yet." / "Relationships are added from item detail pages. Try the inspired_by, references, or used_in types to start mapping connections." / [Open archive]

**Empty search:** "No matches." / "Try removing filters, simplifying the query, or checking spelling. Saved smart filters appear in the left rail." / [Clear filters]

**Empty hygiene:** "Nothing flagged." / "Hygiene runs nightly. When items go stale, accumulate in inbox, or break lifecycle consistency, they will appear here." / [no action]

**Empty workspace (first run):** "This workspace has no items yet." / "Connect a source — Pinterest board, Are.na channel, or browser capture — and your first imports will land in inbox for triage." / [Connect a source]

## 18. Mobile priorities

Mobile is for capture and quick browse. Not for deep work.

**Capture is the primary mobile job.** iOS share sheet → app receives → confirms type and source → optional one-tap inbox tag → done in 5 seconds. The capture flow is the most polished mobile surface.

**Browse is the secondary mobile job.** Masonry grid renders fine; item detail is simplified (collapsible panels, no event timeline by default — toggle to expand). Search works with full-text only; advanced filters are a "open on desktop" prompt.

**Triage on mobile is supported but minimal.** Single-item triage is fine; bulk triage redirects to desktop. Swipe gestures for tag-and-advance are acceptable but not the only path.

**Campaign editing is read-only on mobile by default.** Phase changes, asset attachment with role, brief editing — these prompt: "Open on desktop for full editing." Read-only access is full.

**Graph is hidden on mobile.** Reachable but not optimized. The user can view a node's neighbors but not the full graph.

**No mobile-first compromises that weaken desktop.** When a tradeoff exists between mobile elegance and desktop density, desktop wins.

## 19. Desktop priorities

Desktop is the primary surface. Density wins. Multi-column layouts. Keyboard-first interaction.

**Keyboard navigation is comprehensive.** J/K through grids, /, for search, cmd-K for global search, T for tag focus, esc to close panels, enter to advance, shift-click for multi-select, cmd-click to open in new tab.

**Drag-and-drop for organization.** Drag items into collections, onto campaigns, between role groups within a campaign.

**Bulk operations.** Multi-select in archive enables batch tag, batch retire, batch attach to campaign, batch advance status.

**Multi-pane layouts.** Item detail can open in a side panel from a grid, preserving grid context. Graph stays visible while a node panel slides in. Search results can be browsed without losing the search bar focus.

**Capture on desktop.** Browser extension, paste anywhere in the app, drag from OS, command palette capture.

**Density toggles are preserved across sessions.** A user who prefers editorial density gets it on every visit.

## 20. Anti-patterns

See the anti-pattern audit in chat. Twenty patterns, each routed to its enforcement document. Summary of the rules they generate:

- No SaaS dashboards, no KPI cards, no analytics widgets
- No infinite feed, no Pinterest-clone behavior
- Tables are tools, not the home
- Status, provenance, source are always visible — never hover-only
- AI labels are specific (model, confidence, state), never vague
- No purple glow, no glassmorphism, no generic AI startup visual language
- Editorial typography, restrained palette, real lines and space
- Cards have a mandatory four-signal row
- Empty states teach a next action
- Mobile is capture-and-browse; desktop is research
- Pending tags never blend into approved
- Every component must serve a core loop verb

## 21. Component inventory

The minimum set, named for the build. Each component has a defined contract in `component-rules.md`.

**Items and grids:**
- ItemCard (with mandatory four-signal row)
- ItemCardCompact (dense list rows)
- MasonryGrid (with density toggle)
- ItemHero (large render in detail and campaign covers)

**Item detail surfaces:**
- ItemMetadataStack
- ItemDescriptionBlock (with AI-suggestion separation)
- TagRow (with approved / pending variants)
- RelationshipList
- AnnotationPanel
- AnnotationCard
- EventTimeline

**Inbox triage:**
- TriageStage (split layout)
- TriagePanel
- BulkTriageGrid

**Search:**
- SearchBar (cmd-K trigger)
- FilterDropdown
- SmartFilterRail
- ResultsGrid

**Graph:**
- GraphCanvas
- GraphFilterRail
- GraphNodePanel
- EdgeTooltip

**Collections and campaigns:**
- CollectionHeader
- CollectionMembersGrid
- CampaignHero
- CampaignAssetGroup (one per role)
- CampaignTimeline
- CampaignBriefEditor

**Hygiene and workspace:**
- HygieneDigest
- HygieneReportSection
- WorkspaceSwitcher
- SourceSettingsTable
- PrivacyChip

**Atoms:**
- TypeIndicator
- StatusIndicator
- SourceMark
- UsageBadge
- TagChip (approved / pending / rejected variants)
- ProvenanceMark (model + version + confidence)
- EmptyState (title + paragraph + action — required)

**Forbidden by name:**
- KPICard
- InsightCard
- MetricTile
- DashboardWidget
- WelcomeBanner
- AnyToastSystemForCriticalEvents
- ItemDetailModal (item detail must be a route)
