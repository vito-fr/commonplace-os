# ADR 0004: One Row Per Relationship, Canonical Ordering for Symmetric Types

**Status:** Accepted
**Date:** 2026-04-27
**Supersedes:** an earlier draft that proposed storing symmetric relationships as two directional rows

---

## Context

The graph supports both directional relationships (`inspired_by`, `references`, `derived_from`, `annotates`, `used_in`, `retired_by`) and symmetric ones (`contradicts`, `visually_similar_to`). Two storage strategies are plausible for symmetric types:

1. **Two-row storage** — for every symmetric edge, insert two directional rows (A→B and B→A). Queries treat all edges as directional.
2. **One-row storage** — for every edge, regardless of symmetry, insert one row. Symmetric types use canonical ordering to prevent direction duplicates. Queries that need either-direction lookup use two indexes.

An earlier draft proposed two-row storage on the grounds that "all relationships from X is one query, not a UNION." This was rejected on consistency grounds: with two rows, the system must keep their `weight`, `metadata`, `note`, and timestamps in sync. Any code path that updates one half and not the other corrupts the graph silently.

## Decision

A single row per edge in the `relationships` table. For symmetric types, a CHECK constraint enforces `from_id < to_id` lexicographically. This canonicalizes the storage so the same edge cannot be inserted in both directions.

Composite indexes on `(workspace_id, from_id, type)` and `(workspace_id, to_id, type)` support fast lookup in either direction.

Reverse edges are not materialized.

## Query patterns

**All directional outbound from X:**

```sql
SELECT * FROM relationships
WHERE workspace_id = ? AND from_id = ?
  AND type IN ('inspired_by', 'references', ...);
```

**All inbound directional toward X:**

```sql
SELECT * FROM relationships
WHERE workspace_id = ? AND to_id = ?
  AND type IN ('inspired_by', 'references', ...);
```

**All edges involving X (any direction, any type):**

```sql
SELECT * FROM relationships
WHERE workspace_id = ? AND (from_id = ? OR to_id = ?);
```

**Symmetric similarity neighbors of X:**

```sql
SELECT *,
  CASE WHEN from_id = ? THEN to_id ELSE from_id END AS neighbor_id
FROM relationships
WHERE workspace_id = ? AND type = 'visually_similar_to'
  AND (from_id = ? OR to_id = ?);
```

The OR clause is fine — each side hits its own index.

## When to materialize reverse edges

Never as the source of truth. If profiling reveals a real performance problem on a hot reverse-direction query path, options in order of preference:

1. Confirm the index on `to_id` is being used. If not, fix the query.
2. Add a covering index that includes the columns the query selects.
3. Build a denormalized view (SQL view, no extra table).
4. Only as a last resort: materialize a denormalized edges table, populated by triggers, with the `relationships` table remaining canonical.

We do not anticipate getting past step 1 at the foreseeable scale of this archive.

## Consequences

**Positive:**

- One write per edge. No two-row consistency drift.
- One delete per edge. No half-deletions.
- Updates to weight, metadata, note are atomic.
- The CHECK constraint prevents accidental duplicate-direction inserts at the database level.

**Negative:**

- Either-direction queries use OR or UNION ALL. Indexes make this cheap, but it is more code than `WHERE from_id = ?`.
- The application must compute "the other endpoint" when rendering symmetric edges. Trivial CASE expression.

## Alternatives considered

**Two-row storage for symmetric types.** Rejected — see Context. Consistency drift is the canonical bug for two-row symmetric storage; it cannot be prevented at the schema level without triggers, and triggers are their own complexity.

**Per-type tables.** A `directional_relationships` table and a `symmetric_relationships` table. Forces every cross-type query into UNION. Rejected.

**Always materialize reverse edges via trigger.** Triggers introduce silent state and complicate debugging. Rejected as default; preserved as a last-resort optimization if profiling demands it.

## Reversibility

Easy in either direction. The schema can grow a denormalized table later if needed, and the canonical ordering rule can be relaxed if symmetric types ever need to carry direction-specific metadata (which would imply they are not actually symmetric).
