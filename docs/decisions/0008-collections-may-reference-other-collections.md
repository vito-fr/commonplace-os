# ADR 0008: Collections May Reference Other Collections

**Status:** Accepted
**Date:** 2026-05-14
**Amends:** SCHEMA organization model after documentation sync

---

## Context

The archive currently models collections as flat groupings of items. That is the right default for browse, search, and reuse: an item can belong to many collections, and the home/archive surface should remain masonry-first rather than folder-first.

Are.na channels introduce a different requirement. A channel may contain blocks and may also contain other channels. The first Are.na import slice preserved nested channel provenance by falling back to `type='link'` items that point to the nested Are.na channel URL. That avoided data loss, but it misrepresented the source structure. A nested channel is a container, not a normal link. Treating it as a link makes imported channel hierarchies hard to inspect, hard to navigate in-app, and hard for future agents to reason about.

Users also naturally want some local grouping inside collections: sections, sub-collections, or references to related working sets. The product should support that without turning the primary archive identity into an infinite folder tree.

## Decision

Collections may reference other collections through a new `collection_relationships` table.

The relationship is a directed edge from a parent collection to a child collection. A child collection may be referenced by more than one parent. This preserves Are.na-style multi-membership and avoids forcing a single canonical parent onto a collection.

The default archive remains masonry-flat. Nesting is visible only when the user is inside a collection view. Inside a collection, child collections render as collection cards alongside that collection's item cards. Clicking a collection card navigates to the child collection route.

The data model permits arbitrary graph depth, but application code is responsible for bounded traversal. Importers must use a depth cap and visited-set cycle detection. The UI must not recursively materialize full nested trees by default.

## Schema Shape

Add `collection_relationships`:

- `id`
- `workspace_id`
- `parent_collection_id`
- `child_collection_id`
- `position`
- `added_at`
- `added_by`

Constraints:

- primary key on `id`
- foreign keys to `workspaces` and `collections`
- unique `(workspace_id, parent_collection_id, child_collection_id)`
- check `parent_collection_id != child_collection_id`

Indexes support parent-detail reads and reverse child lookup.

## Consequences

**Positive:**

- Are.na nested channels can become local collections instead of fake link items.
- Parent collections can show nested working sets without flattening everything into one item list.
- Child collections can belong to multiple parents, matching Are.na's channel model and the archive's multi-membership item model.
- The UI can reuse the existing collection-card primitive and existing collection routes.

**Negative:**

- Multi-hop cycles cannot be prevented by the simple schema and must be handled in application code.
- Collection detail reads now need to return both item membership and child collection membership.
- Importer summaries and cleanup workflows become more complex because nested channel imports create collections and edges, not only items.

**Neutral:**

- This does not create a separate sections model.
- This does not add drag-to-nest or drag-to-reorder UI.
- This does not change item collection membership semantics.
- This does not make nested collection traversal part of the default archive page.

## Alternatives Rejected

### Keep collections flat and add a separate sections concept

Rejected for this slice. Sections may still be useful later as layout groups inside one collection, but they do not represent imported Are.na channels. A section is local presentation; an Are.na nested channel is a reusable collection-like source object with its own membership, source identity, and route.

### Add `parent_collection_id` to `collections`

Rejected because it forces single-parent hierarchy. Are.na channels can be connected to multiple channels, and local collections should be able to appear in multiple working contexts. A parent column would also make cycle prevention look simpler than it is while breaking multi-membership.

### Flatten nested channel contents into the parent collection

Rejected because it erases source structure, makes re-import idempotency harder to reason about, and prevents users from entering a nested channel as its own local working set.

## Reversibility

Medium.

The table can be dropped if no UI or importer depends on it. After imported data exists, reversal means deleting collection-to-collection edges and choosing whether to keep the child collections as standalone collections. No item data is destroyed by removing the relationship table.

## Implementation Notes

1. Add `collection_relationships` in a new migration. Do not rebuild existing tables.
2. Update `SCHEMA.md` to describe the new organization edge.
3. Update the Are.na importer so `Channel` blocks create child collections and parent-child edges.
4. Add a CLI/import depth cap with default depth `1`.
5. Use visited Are.na channel IDs during import to avoid recursive loops.
6. Update collection detail reads to return child collections in a collection-card-compatible shape.
7. Render child collection cards as terminal tiles in the parent collection view.
