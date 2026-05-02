# Relationship Type Registry

This file is the human-readable mirror of the `relationship_types` table. When the two diverge, the table wins and this file is updated to match.

Adding, removing, or modifying a type requires a stop-and-ask and an ADR.

---

## Semantics

Relationships are stored as a single row per edge. Symmetric types are stored once with canonical ordering: `from_id < to_id` lexicographically. Reverse-direction queries use the index on `to_id`. Reverse edges are not materialized.

A relationship row may carry:

- `weight` (0–1) — strength or confidence of the link
- `metadata` (JSON) — type-specific structured data (e.g., role for `used_in`)
- `note` (text) — human-readable annotation explaining the link
- `asserted_by` — who or what created the relationship

---

## Types

### `inspired_by` — directional

`X inspired_by Y` means X drew from Y as a source of inspiration.

- Use when: a moodboard draws on a referenced artwork; a campaign concept descends from an earlier campaign
- Metadata: optional
- Asserted by: usually human; AI may suggest via `ai_annotations`

### `references` — directional

`X references Y` means X cites or points to Y as evidence, source, or example.

- Use when: a note cites a source; a caption references a visual
- Distinct from `inspired_by`: references are factual, inspirations are creative

### `derived_from` — directional

`X derived_from Y` means X is a derivative or transformation of Y.

- Use when: an image was edited from another image; a caption is a variant of another caption; a slide was extracted from a deck
- The system does not enforce that `derived_from` chains are acyclic, but cycles are a hygiene flag

### `annotates` — directional

`X annotates Y` means X is metadata, commentary, or caption for Y.

- Use when: a caption is paired with an image; a note explains a link; a sticky-note comment hangs off an asset
- Captions of type `caption` paired with images of type `image` are the canonical case

### `used_in` — directional

`X used_in Y` means asset X was deployed in container Y.

- Use when: an image is reused in a note; a caption is incorporated into a writeup
- Metadata: optional
- Logged event: `used`
- The earlier campaign-attachment semantics (with `role` metadata) were removed in ADR 0006 along with the `campaign` item type. `used_in` now describes general reuse, not campaign membership.

### `contradicts` — symmetric

`X contradicts Y` means X and Y are mutually exclusive, conflicting, or compete for the same role.

- Use when: two campaign concepts cannot ship together; two notes hold opposing positions
- Symmetric: stored once with `from_id < to_id`

### `visually_similar_to` — symmetric

`X visually_similar_to Y` means X and Y share visual DNA.

- Use when: surfaced by perceptual hash, embedding similarity, or human judgment
- Symmetric: stored once with `from_id < to_id`
- Often AI-asserted. High-confidence matches may auto-create with `asserted_by='subagent:enrichment'` per the AI write rules in CONSTITUTION section 8.

---

## Reserved for future use — do not implement without ADR

- `precedes` / `follows` — temporal sequencing within a narrative
- `responds_to` — for tracking conversation chains
- `cross_workspace_reference` — when business workspace arrives

---

## Removed in ADR 0006

- `retired_by` — the asymmetric "X is superseded by Y" type. Removed when the `retired` lifecycle status was retired in favour of hard delete.

---

## Rules

1. A relationship's `type` must exist in the registry. Foreign-keyed.
2. Symmetric types insert once. The database trigger `trg_relationships_symmetric_ordering` enforces `from_id < to_id` for rows whose type is registered as symmetric.
3. `from_id != to_id` always. Self-relationships are not modeled.
4. AI-asserted relationships (`asserted_by` starts with `subagent:`) follow the canonical-write rules in CONSTITUTION section 8: high confidence may auto-create the edge; below threshold the AI proposes via `ai_annotations` with `field_name='relationship_suggestion'`.
5. Removing a relationship logs a `relationship_removed` event on both endpoints.
