# Item Detail Side Panel IA Proposal

## Scope

This proposal covers the information architecture and interaction model for the item-detail right side panel. It does not prescribe implementation code and does not change card hover behavior, masonry/grid layout, Settings, card collection popovers, loading behavior, or data storage.

The goal is to make the side panel feel like an inspection rail for a visual archive item: source, status, collection context, and reusable actions should be immediately understandable, while backend identifiers and raw payloads should move behind a calmer technical layer.

## Current Problems

Based on the review screenshots and current component structure, the side panel has these issues:

- The panel reads as a long administrative drawer instead of an item context panel.
- The left edge/inner slab effect makes the panel look visually split from itself.
- Source is duplicated: source appears in the primary source section and again in lower action buttons.
- "Open source" currently behaves like a generic action button instead of making the actual URL the interactive object.
- Source labels such as `ca.pinterest.com` are too raw when they could communicate provider identity.
- Collection state is not actionable enough when empty: "Not collected yet" plus a lower "Add to collection" action feels disconnected.
- Existing memberships, add-to-collection, and remove-from-collection are not presented as one coherent collection management module.
- Lower buttons such as "Copy reference" are not clearly user-facing and compete with more important actions.
- Technical fields like item id, source id, raw JSON, format, rights, and source external id are mixed into the same flow as human-facing information.
- Delete is tucked into a cluster of secondary controls instead of being isolated as a destructive action.
- The panel toggle is conceptually useful but should feel like a stable rail control, not a moving part of the content.
- Previous/next item navigation exists but is not visually integrated with the item-detail inspection workflow.

## Design Principles

- **Inspect first.** The panel should answer: what is this, where did it come from, what state is it in, and where is it used?
- **Source is an object.** The URL/provider should be directly readable and clickable, not hidden behind a redundant button.
- **Collections are context, not metadata.** Collection membership should be prominent because it describes how the item participates in the archive.
- **Technical data is available, not primary.** IDs, raw JSON, MIME values, source external IDs, and event history belong in a technical/details drawer.
- **Destructive actions are isolated.** Delete and irreversible operations should be separated from routine inspect/connect actions.
- **No fake controls.** If an action does not have a clear user-facing outcome, it should not be visible.

## Proposed Information Hierarchy

### 1. Identity Header

Primary fields:

- Source-derived title or best human-readable title
- File name or stored asset name, only when different from the title
- Type
- Source/provider
- Status with a visible status dot
- Collection count
- Captured/imported date

The title should prefer source metadata in this order:

1. Human-authored title if present
2. OpenGraph/oEmbed/source title
3. Source description trimmed into a title-like line
4. File name
5. Domain/type fallback

File name should be its own secondary line, not the item title unless it is the only useful label.

### 2. Source

Primary fields:

- Provider identity: Pinterest, YouTube, Are.na, local file, manual note, website, PDF
- Actual source URL as the clickable object
- Captured/imported date
- Provider-specific source context when available, such as pin ID, video channel, Are.na block/channel, domain, or local file origin

The source URL should be rendered as a truncated readable link:

- Show domain plus meaningful path, not only the domain.
- Hover/focus forms a smooth pill around the link.
- Include the external arrow icon on hover/focus or always at low emphasis if discoverability needs it.
- Use `target="_blank"` only for external source opening.

Provider identity treatment:

- Pinterest: red-tinted dot or favicon if available.
- YouTube: red provider mark or favicon.
- Are.na: neutral provider wordmark treatment or favicon.
- Local: disk/import indicator.
- Manual: note/text indicator.
- Generic website: favicon plus domain.

Empty source state:

- If no source URL exists, show "No external source" plus a small explanation such as "Created manually in the archive."
- Do not render disabled "Open source" buttons.

### 3. Collections

Primary fields:

- Current collection memberships with preview thumbnails or initials.
- Add-to-collection control inside the same module.
- Remove/uncollect per membership.
- Empty state that teaches the action.

Recommended structure:

- Header: "Collections" plus count.
- If memberships exist, render compact rows with:
  - collection preview
  - collection name
  - added date or item count
  - open affordance
  - remove affordance
- If no memberships exist, render a short empty state:
  - "Not in a collection yet."
  - "Collections group related material for retrieval and reuse."
  - visible "Add to collection" picker row.
- Add to collection should open an inline compact picker, using the same picker language as the card popover.

Avoid:

- Hiding add-to-collection below unrelated actions.
- Presenting "not collected" as a dead end.
- Large aggressive selected states.
- Duplicate "Open source" or "Copy reference" controls inside this module.

### 4. Context

Primary fields:

- Caption
- Note body
- Description
- Summary
- OCR text
- AI-generated annotations only if clearly labeled as AI/provenance data

Context empty state:

- If no description, note, caption, or OCR exists, either hide the section or show a compact "No notes or extracted text" state with an edit/add affordance if editing exists.

### 5. Primary Actions

Primary actions are visible near the top or first screen of the rail:

- Open source, but expressed through the source URL itself.
- Download, when a download target exists.
- Add to collection, inside Collections.
- Toggle active/archive status, likely near the status token or in a lifecycle row.

Download should be visible as a compact action with `D` shortcut context when supported.

### 6. Secondary Actions

Secondary actions belong in a "More actions" or "Utilities" drawer:

- Copy source URL
- Copy internal link
- Copy item ID
- Copy payload for text/caption/note/link
- Copy raw JSON
- Connect manually, if relationship creation remains a power-user tool

Remove or demote:

- "Copy reference" as a primary action. It is too vague unless renamed and scoped, for example "Copy markdown reference."
- Duplicate "Open source" outside the Source section.

### 7. Technical Details

Move these fields to a collapsed technical/details drawer:

- Item ID
- Source ID
- Source external ID
- MIME type
- Raw format
- File size
- Asset URL/internal file reference
- Aspect ratio/dimensions, unless useful beside media preview
- Raw JSON
- Event history
- AI annotation payloads
- Relationship IDs

Technical details should remain available for debugging and advanced archive maintenance, but they should not be mixed with the primary item narrative.

### 8. Danger Zone

Danger actions should be visually isolated at the bottom:

- Delete item
- Possibly "Retire permanently" if that lifecycle exists later

Delete should not live in the same visual cluster as copy/add/connect actions. It should have a confirmation state and should continue to respect the undo-delete window if that behavior exists.

## Suggested Component Zones

Recommended conceptual zones:

1. `DetailRailHeader`
   - title, filename, type/source/status/collection grammar
2. `DetailSourceCard`
   - provider identity, readable source link, capture/import timestamp
3. `DetailLifecycleRow`
   - active/archived status and lifecycle action
4. `DetailCollectionsModule`
   - memberships, add picker, empty state
5. `DetailContextModule`
   - caption/note/description/OCR/summary
6. `DetailPrimaryActions`
   - download and other direct user actions not already embedded in modules
7. `DetailMoreDrawer`
   - copy utilities, manual connection, technical details, history
8. `DetailDangerZone`
   - delete/destructive actions only

## Recommended Layout Direction

Use a single right rail with a stable top toggle and stacked modules:

1. Rail toggle remains pinned to the top edge of the rail, not displaced by content.
2. Identity header is always visible when the rail is open.
3. Source and Collections are expanded by default.
4. Context is expanded only when meaningful content exists.
5. More/Technical is collapsed by default.
6. Danger Zone is collapsed or separated at the bottom.

The visual model should be "editorial inspection label" rather than "settings drawer":

- quiet dividers
- compact section headers
- pill controls only for actions/chips
- readable rows over button clusters
- provider/source identity with small visual marks
- no repeated full-width action pills where text links or rows are more appropriate

## Empty States

### Source

- No URL: "No external source."
- Local file: "Imported file" with filename and imported date.
- Manual note: "Created in archive."

### Collections

- No memberships: "Not in a collection yet."
- Include one clear add affordance immediately inside the module.
- If no collections exist globally: "Create a collection to group related material."

### Context

- No description/note/OCR: hide the module by default, or show a compact line only if there is an edit affordance.

### Technical

- Missing optional technical fields should simply not render.
- If the whole drawer has no useful technical data, hide it.

## Action Priority

Primary:

- Source URL open
- Download when supported
- Add/remove collection membership
- Status active/archive toggle

Secondary:

- Copy source URL
- Copy internal link
- Copy markdown/reference
- Copy item ID
- Copy raw JSON
- Connect manually

Danger:

- Delete

## Risks

- The side panel could become too tall if every module is expanded by default.
- Provider identity requires reliable favicon/provider mapping, or the UI may look inconsistent.
- If source metadata quality is poor, the title strategy may still produce weak labels.
- Moving technical details too far down may frustrate debugging unless the drawer is easy to reach.
- Collection add/remove controls need to stay consistent with the new card collection picker without duplicating too much UI.
- Status/lifecycle controls must avoid accidental archive/unarchive actions.

## Open Questions

- Should status changes be immediate, or should archive/unarchive require confirmation for certain item types?
- Should "Copy reference" become "Copy markdown reference," "Copy source citation," or be removed?
- Should source provider color come from favicons, a controlled provider map, or both?
- Should the rail remember open/closed section states per user?
- Should item-detail previous/next navigation be considered part of the rail, or remain a separate bottom-centered navigator?
- Should OCR and AI annotation content be primary for some item types, or always secondary/provenance-labeled?

## Implementation Phases

### Phase 1: IA Cleanup

- Remove duplicate source actions outside the Source section.
- Move IDs/raw JSON/event history into Technical details.
- Separate Delete into a Danger Zone.
- Rename ambiguous actions.

### Phase 2: Source Module

- Make the actual source URL the link.
- Add provider identity treatment.
- Add source empty states.
- Clarify title vs filename behavior.

### Phase 3: Collections Module

- Replace current add drawer with a cohesive membership plus picker module.
- Add collection previews.
- Add remove/uncollect controls per membership.
- Add strong empty state.

### Phase 4: Technical/More Drawer

- Consolidate copy utilities, raw JSON, IDs, manual connections, AI annotations, and history.
- Keep it collapsed by default.

### Phase 5: Visual/Interaction Polish

- Stabilize rail toggle.
- Tune spacing, dividers, and section rhythm.
- Verify keyboard navigation, focus states, and Safari raster stability.
- Verify source link hover pill and provider badges.

## Non-Goals For This Proposal

- No React implementation.
- No CSS implementation.
- No database changes.
- No capture pipeline changes.
- No item-detail media layout changes.
- No card hover, grid, Settings, or collection popover changes.
