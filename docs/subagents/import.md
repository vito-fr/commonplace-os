# Subagent: import

**Status:** In scope, active
**Last updated:** 2026-04-27

---

## Purpose

Fetch items from external and local sources and write them into the archive as `inbox`-status items, idempotently and with provenance.

## When invoked

- User triggers a manual import (Pinterest board, Are.na channel, URL list, file upload, iOS share-sheet capture)
- Scheduled background job (e.g., re-poll a Pinterest board, refresh a watched RSS feed)
- Browser extension capture event

The subagent is never invoked autonomously without a user-initiated source. There is no "go find interesting things" mode.

## Files it can read

- `sources` table — to resolve source defaults
- `items` table — to check for existing rows by `(workspace_id, source_id, source_external_id)`
- `items_image`, `items_caption`, `items_note`, `items_link` — for re-import diffing
- The source itself (Pinterest API, Are.na API, URL fetch, local filesystem)

## Files it can write

- `items` — INSERT new rows with `status='inbox'`; UPDATE existing rows on re-import
- `items_image`, `items_caption`, `items_note`, `items_link` — corresponding extension rows
- `sources` — UPSERT a source row if one does not exist for the import target
- `item_events` — `imported` event per row created or updated

## Files it cannot write

- `relationships` — except for the `annotates` relationship that pairs an imported caption with its image when both are imported in the same operation
- `tags`, `item_tags`, `collections`, `collection_items`, `campaign_profiles`
- `ai_annotations` — that's the enrichment subagent's job
- Canonical fields beyond what the source provides (no inference, no synthesis)

## Decisions it is forbidden to make

- Cannot promote items beyond `status='inbox'`. Triage is a human action.
- Cannot generate descriptions, summaries, or tags. Source-provided text is preserved verbatim; AI inference is the enrichment subagent's responsibility.
- Cannot deduplicate against existing items by content similarity. Identity is `(source_type, source_external_id)` only. Cross-source duplicates are reported by the hygiene subagent.
- Cannot delete or overwrite human-modified canonical fields on re-import. If a re-import's source value differs from the current canonical value AND the canonical value differs from the previously-imported value, the import is a stop-and-ask: the user has edited the field and the import should not silently overwrite.

## Idempotency

Identity for imported items: `(workspace_id, source_id, source_external_id)`. The unique index enforces this.

On re-import:

1. Look up existing item by the identity tuple.
2. If not found: INSERT with `status='inbox'`, log `imported` event.
3. If found and source content unchanged: increment `update_count`, no event log.
4. If found and source content changed but canonical unchanged: UPDATE source-derived fields, increment `update_count`, log `imported` event with `metadata.change_summary`.
5. If found and canonical has been edited by the user: stop-and-ask before overwriting.

## Privacy on import

Imported items inherit `sources.default_privacy_level`. The import subagent does not set `items.privacy_level` directly; it leaves it null so resolution falls through to source default. User overrides are user actions.

## Source-specific behavior

- **Pinterest** — `source_external_id` is the pin ID. Imports always create `type='image'` items. Pin descriptions are stored in `items.description`. Pin URLs go to `items_image.file_ref` after fetching.
- **Are.na** — `source_external_id` is the block ID. Block type maps to item type: image → `image`, text → `note`, link → `link`. Channel membership is preserved via collection membership (creates a collection per channel on first import).
- **URL** — `source_external_id` is a normalized URL hash. Item type is `link`; OG metadata fills `items_link.og_metadata`.
- **Local file** — `source_external_id` is a content hash (SHA-256). Item type derives from MIME.
- **iOS share-sheet** — `source_external_id` is a capture-time PocketBase-generated ID. Item type derives from payload.

Adding a new source type or changing source-specific behavior is a stop-and-ask.

## Output format

The import subagent produces an `ImportResult` per run:

```
{
  "source_id": "...",
  "items_created": [item_id, ...],
  "items_updated": [item_id, ...],
  "items_skipped": [{item_id, reason}, ...],
  "stop_and_ask_required": [{item_id, reason}, ...],
  "errors": [{source_external_id, error}, ...]
}
```

Stop-and-ask cases pause the import; user resolves; the subagent resumes from where it stopped.

## Failure modes

- Network failure during fetch → retry with exponential backoff up to 3 attempts; report in `errors`.
- Source returns malformed data → skip the item, report in `errors`. Never partially insert.
- Canonical field collision → stop-and-ask. Never overwrite silently.
- Duplicate identity tuple violation → impossible if the unique index is in place; if it occurs, the index is broken and that is a bug, not a runtime condition.
