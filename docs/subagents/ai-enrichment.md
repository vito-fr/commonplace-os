# Subagent: ai-enrichment

**Status:** In scope, active
**Last updated:** 2026-04-27

---

## Purpose

Generate AI metadata for items and write it to `ai_annotations` with full provenance. Never writes canonical fields. Anti-slop filtered.

## When invoked

- After an import batch completes (operates on the newly imported `inbox` items)
- On user demand for a specific item or batch ("enrich this," "regenerate annotations")
- Scheduled nightly pass over `inbox` items that have not yet been enriched
- Future: nightly synthesis pass for the curator layer (Sprint 11+)

The subagent is invoked with an explicit scope: a list of `item_id`s and a list of `field_name`s to populate. It does not autonomously decide what to enrich.

## Files it can read

- `items` and all type extensions
- `ai_annotations` (for prior annotations on the same items, to avoid redundant generation)
- `tags` (full vocabulary, including pending and rejected, to drive vocabulary lock)
- `banned_phrases` (loaded at run start; mandatory)
- `relationship_types` (when generating relationship suggestions)
- `relationships` (existing edges, to avoid suggesting duplicates)

## Files it can write

- `ai_annotations` — INSERT new annotations
- `tags` — INSERT new tags with `status='pending'` and `created_by='subagent:enrichment'`. Cannot promote pending tags to approved.
- `item_events` — `annotation_added` event per annotation; `annotation_superseded` when a prior annotation for the same `(item_id, field_name)` is replaced

## Inbox vs. non-inbox

| Item status | Annotation behavior |
|---|---|
| `inbox` | Annotations may be inserted with `review_status='approved'` directly. The item is quarantined; AI auto-approval is acceptable here because the user reviews everything during triage. |
| `triaged`, `active`, `archived`, `retired` | Annotations are inserted with `review_status='pending'` only. Auto-approval is forbidden. The user reviews via the suggestions queue. |

The subagent reads `items.status` before deciding the `review_status` for each annotation. There are no exceptions.

## Files it cannot write

- Any canonical field on `items` or extension tables. Never. No exceptions.
- `relationships` — relationships are proposed via `ai_annotations.field_name='relationship_suggestion'` with payload describing the proposed edge. Materialization into the relationships table requires user approval and is a separate user action.
- `collections`, `collection_items` — organizational decisions are human-only.
- `campaign_profiles` — campaign authorship is human-only.
- `banned_phrases` — only humans extend the blocklist.
- `tags` with `status='approved'` — only humans approve tags.

## Decisions it is forbidden to make

- Cannot promote any annotation to canonical, even with confidence 1.0.
- Cannot decide that a tag is good enough to be approved.
- Cannot extend the banned phrase list.
- Cannot author captions, marketing copy, or any human-voice creative content. The system has no caption-generation subagent for a reason.
- Cannot merge items, delete items, change item types, or change item status.
- Cannot generate annotations for `field_name`s outside the registered set without a stop-and-ask.

## Run-start preconditions (mandatory)

Every run must, before generating any output:

1. Load `banned_phrases` for the workspace and merge with the global default list.
2. Load the approved tag vocabulary for the workspace (`tags WHERE status='approved'`).
3. Load existing `ai_annotations` for the target items (to identify supersession candidates).
4. Confirm the model name, model version, and prompt version it will record.

If any precondition fails, the run aborts. No partial output.

## Anti-slop filters

Output passes through filters in order before insertion:

1. **Banned phrase scan.** Lowercase substring match against `banned_phrases` over all string fields in the payload. On match: regenerate up to 2 times. On third failure: skip that field for that item, log to errors.
2. **Tag vocabulary.** When `field_name='tags'`, split tags into approved (existing in `tags WHERE status='approved'`) and new. New tags are inserted into `tags` with `status='pending'`. Both sets are recorded in the annotation payload.
3. **Length cap.** `description` payload capped at 140 chars; `summary` at 280. Over-cap content is regenerated, not truncated.

A failed filter triggers regeneration. Stripping banned phrases and submitting the rest is forbidden.

## Supersession

When a new annotation is inserted for an existing `(item_id, field_name)` whose prior annotation was `pending` or `approved`:

1. The prior annotation's `review_status` is set to `superseded`, `superseded_at` is timestamped.
2. An `annotation_superseded` event is logged on the item.
3. The new annotation enters with the appropriate `review_status` (`approved` for inbox items, `pending` otherwise).

Rejected annotations are never superseded — they remain rejected for audit.

## Output format

```
{
  "run_id": "...",
  "model_name": "...",
  "model_version": "...",
  "prompt_version": "...",
  "items_processed": [item_id, ...],
  "annotations_created": [annotation_id, ...],
  "annotations_superseded": [annotation_id, ...],
  "tags_proposed_pending": [tag_id, ...],
  "filter_failures": [{item_id, field_name, reason}, ...],
  "errors": [{item_id, error}, ...]
}
```

## Field-name registry

Initial `field_name` namespaces:

- `tags` — payload: `{"approved": [...], "pending": [...]}`
- `description` — payload: `{"text": "..."}`, capped at 140 chars
- `summary` — payload: `{"text": "..."}`, capped at 280 chars
- `visual_dna` — payload: `{"composition": "...", "palette_summary": "...", "subject_matter": "..."}`
- `ocr_text` — payload: `{"text": "...", "regions": [...]}`
- `color_palette` — payload: `{"hex_codes": [...], "named_colors": [...]}`
- `semantic_neighbors` — payload: `{"item_ids": [...], "similarity_scores": [...]}`
- `relationship_suggestion` — payload: `{"to_item_id": "...", "type": "...", "weight": ..., "rationale": "..."}`

Adding a new `field_name` is a stop-and-ask.

## Failure modes

- Model unreachable → abort run; report in errors.
- All filters fail for a field after retries → skip that field for that item; report in `filter_failures`. Other fields proceed.
- Prompt version not provided → abort; provenance integrity is mandatory.
- Attempt to write canonical → impossible if the data layer is correctly scoped; if it occurs, the subagent's authority is broken and that is a bug.
