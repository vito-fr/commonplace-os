# ADR 0001: Items as the Atomic Unit

**Status:** Accepted
**Date:** 2026-04-27
**Supersedes:** none

---

## Context

The archive holds heterogeneous content: images from Pinterest, captions written for campaigns, written notes, links with OG metadata, and campaigns themselves. These differ in their fields but share enormously in their behavior — every one of them participates in the graph, has a lifecycle, can be tagged, can be in a collection, and can carry AI annotations.

Three plausible architectures:

1. Separate top-level tables per content type (`images`, `captions`, `notes`, `links`, `campaigns`)
2. A single `items` table with all fields nullable
3. A single `items` table with shared fields, plus type-specific extension tables

## Decision

Adopt option 3. A single `items` table holds the shared concerns (workspace, type, status, source, title, description, summary, privacy, timestamps). Type-specific fields live in extension tables keyed by `item_id`: `items_image`, `items_caption`, `items_note`, `items_link`, `campaign_profiles`.

The `type` column on `items` is the discriminator. Adding a new type requires a new extension table, a registry entry, and a stop-and-ask.

## Consequences

**Positive:**

- The graph is uniform. A relationship from a caption to a campaign is the same query shape as a relationship from an image to a moodboard.
- Lifecycle, events, tags, collections, and AI annotations all reference `items.id` without caring about type.
- Search and indexing are unified — one full-text index, one embedding index, one event log.
- Onboarding new types is mechanical: one extension table, one registry update.

**Negative:**

- Joins are required to render a fully-detailed item. Acceptable: at solo and small-team scale, the join cost is negligible against SQLite's performance; at scale, materialized views are an option.
- Some fields might tempt being shared at `items` level when they belong only to one type. The discipline is: if it's shared by more than one type, it goes on `items`; if not, it goes in the extension. The boundary is enforced by code review and the stop-and-ask on schema changes.
- Nullable shared fields (e.g., `description` is meaningful for some types and not for others) are accepted as a tradeoff.

## Alternatives considered

**Separate top-level tables.** Cleanest per-type schema, but every cross-type query becomes a UNION. Relationships, events, and AI annotations would need a polymorphic foreign key (`item_type`, `item_id`) that defeats foreign-key integrity. Rejected.

**Single table with all fields nullable.** Simplest reads, worst writes — fields drift in meaning, no real schema enforcement, no boundary between types. Rejected.

## Reversibility

Hard. Splitting a unified `items` table back into per-type tables would require re-keying every relationship, event, annotation, tag, and collection membership. Treat this decision as foundational.
