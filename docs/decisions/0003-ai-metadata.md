# ADR 0003: AI Metadata via Annotations, Not Doubled Columns

**Status:** Accepted
**Date:** 2026-04-27
**Supersedes:** an earlier draft that proposed `tags_human`/`tags_ai` doubled columns

---

## Context

The archive will accumulate AI-generated metadata over years: tags, descriptions, summaries, OCR extractions, color palettes, visual DNA, semantic neighbors, and enrichment types not yet imagined. Three concerns must be solved:

1. **Provenance.** Which model produced this? With which prompt? At what confidence? When was it reviewed?
2. **Reversibility.** Can the user reject AI output without losing it? Can it be superseded by a newer pass?
3. **Extensibility.** Can a new enrichment type be added without a schema migration?

An earlier draft proposed doubled columns: `tags_human`/`tags_ai`, `description_human`/`description_ai`, `summary_human`/`summary_ai`. This was rejected for three reasons:

- It does not capture model name, prompt version, or confidence.
- It hardcodes which fields AI may write to — adding visual DNA or color palettes requires a schema change.
- It conflates two questions: "what is the canonical value" and "what did AI say about this."

## Decision

Canonical fields on `items` and extension tables are **human-authored only**. AI subagents never write to canonical fields under any circumstance.

AI output lives in a single `ai_annotations` table:

| Column | Purpose |
|---|---|
| `id`, `workspace_id`, `item_id` | identity |
| `field_name` | namespace: `tags`, `description`, `summary`, `visual_dna`, `ocr_text`, `color_palette`, `semantic_neighbors`, `relationship_suggestion`, ... |
| `payload` | JSON, shape determined by `field_name` |
| `model_name`, `model_version`, `prompt_version` | provenance |
| `confidence` | 0–1, nullable |
| `review_status` | `pending` \| `approved` \| `rejected` \| `superseded` |
| `reviewed_by`, `reviewed_at` | review trail |
| `created_at`, `superseded_at` | history |

`field_name` is the namespace that determines payload shape. Payload schemas per namespace are defined in implementation and may evolve, but adding a new `field_name` requires a stop-and-ask.

## Lifecycle of an annotation

1. AI subagent generates output → row inserted with `review_status='pending'`.
2. User reviews — single annotation, batch, or via "approve all from this run."
3. On approval: `review_status='approved'`. Annotation may be promoted to canonical only by an explicit user action that creates a corresponding human-authored value.
4. On rejection: `review_status='rejected'`. Row is preserved for audit.
5. When a new annotation is created for the same `(item_id, field_name)` and the prior annotation was `approved` or `pending`, the prior is marked `superseded` with `superseded_at` set. The replacement is the active annotation for that field.

## What "promotion to canonical" means

Approving an annotation does not automatically write to canonical. The user (or a UI affordance) decides whether the annotation graduates. Promotion is recorded as:

- A canonical write to the relevant field on `items` or extension table
- An `annotation_approved` event on `item_events`
- A `promoted_to_canonical_at` timestamp on the annotation (added to schema if needed; deferred for now)

The annotation row is never deleted. The audit trail survives.

## Inbox exception

For items with `status='inbox'`, AI subagents may directly populate annotations and may auto-approve their own annotations. Inbox items are quarantined; they do not surface in main views; their AI metadata cannot pollute curated content. The user reviews AI work as part of the triage step that promotes items out of inbox.

For all non-inbox items, AI annotations enter as `pending` and require explicit human review.

## Anti-slop layer

AI output must pass three filters before insertion:

1. **Banned phrases** — enforced by `docs/anti-slop/banned-phrases.md` and the `banned_phrases` table. Loaded by every AI subagent at run start.
2. **Tag vocabulary lock** — when `field_name='tags'`, AI may freely apply tags with `status='approved'`. New tags enter as `status='pending'` and are not searchable.
3. **Length cap** — payloads for `description` are capped at 140 chars; `summary` at 280.

Filters operate at the subagent level, not at the database level. A failed filter triggers regeneration, not silent stripping.

## Consequences

**Positive:**

- New enrichment types add a `field_name` value; no schema migration.
- Full provenance per annotation, including model, prompt, and confidence.
- Canonical fields stay clean. Taste cannot be silently corrupted.
- Audit trail survives rejection and supersession.

**Negative:**

- Reading an item with full AI context requires a join. Acceptable.
- The user accumulates a review queue. This is a feature, not a bug — review is the gate that makes the system trustworthy.

## Alternatives considered

**Doubled columns.** Rejected — see Context.

**Provenance column per field.** Adds a `provenance` column next to each AI-affected field. Lighter than doubled columns but still hardcodes which fields are AI-eligible, and provides no place to store model name, prompt version, or confidence. Rejected.

**AI writes directly to canonical, with an `ai_history` table for audit.** Fast, but corrupts canonical with every model update or prompt change. The audit table only tells you what was overwritten, not what is currently AI-generated. Rejected.

## Reversibility

Medium. The annotations table can be reshaped or partially absorbed into canonical later, but the model/prompt/confidence triple is hard to reconstruct after the fact. Commit to this now.
