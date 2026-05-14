# Schema Reference

Human-readable schema documentation. The source of truth is `pocketbase/pb_migrations/`, currently through `pocketbase/pb_migrations/0004_item_asset_thumbnails.js`. When this file and the migrations diverge, migrations win and this file is updated to match.

Tenant scope is stored directly on root tables such as `items`, `sources`, `relationships`, `tags`, `collections`, `ai_annotations`, and `item_events`; extension and junction tables inherit tenant scope through their item, tag, or collection foreign keys. All timestamps are stored as ISO 8601 UTC text. Collection IDs are text IDs; records inserted through PocketBase use PocketBase's generated ID format, while seed data may use explicit `seed:*` IDs.

Foreign keys use SQLite's default actions (`NO ACTION`) unless a later migration explicitly says otherwise.

M0.1 runtime verification used PocketBase v0.36.9. Under PocketBase, `PRAGMA foreign_keys` returned `1` and `PRAGMA trusted_schema` returned `1`. The local macOS `sqlite3` CLI may default `trusted_schema` to `0`; CLI-only checks that fire `items_fts` triggers should enable `PRAGMA trusted_schema=ON` for that verification session.

---

## Tenancy

### `workspaces`

Top-level tenant. The default `personal` workspace is seeded by the loader, not by the migration.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| name | TEXT NOT NULL | Unique across the system |
| kind | TEXT NOT NULL | CHECK(kind IN ('personal', 'business')) |
| created_at | TEXT NOT NULL | ISO 8601 UTC |

Constraints:
- PRIMARY KEY (`id`)
- UNIQUE (`name`)

### `sources`

Origin of imported or manually captured items.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| workspace_id | TEXT NOT NULL | FK -> workspaces(id) |
| kind | TEXT NOT NULL | CHECK(kind IN ('pinterest', 'arena', 'url', 'local', 'ios_capture', 'manual')) |
| identifier | TEXT NOT NULL | Board ID, channel slug, domain, or other stable source key |
| label | TEXT NOT NULL | Human-readable name |
| default_privacy_level | TEXT NOT NULL | CHECK(default_privacy_level IN ('private', 'personal', 'team', 'public')) |
| created_at | TEXT NOT NULL | ISO 8601 UTC |

Constraints:
- PRIMARY KEY (`id`)
- UNIQUE (`workspace_id`, `kind`, `identifier`)

---

## Items

### `items`

The atomic unit. Every piece of content is an item, distinguished by `type` and extended by a type-specific table.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| workspace_id | TEXT NOT NULL | FK -> workspaces(id) |
| type | TEXT NOT NULL | CHECK(type IN ('image', 'caption', 'note', 'link')) |
| status | TEXT NOT NULL | CHECK(status IN ('active', 'archived')) |
| title | TEXT | Nullable. Human-authored canonical title |
| description | TEXT | Nullable canonical description |
| summary | TEXT | Nullable canonical summary |
| source_id | TEXT | Nullable FK -> sources(id) |
| source_external_id | TEXT | Nullable. Source's identifier for this item, used for re-import idempotency |
| privacy_level | TEXT | Nullable. CHECK(privacy_level IS NULL OR privacy_level IN ('private', 'personal', 'team', 'public')) |
| rights_status | TEXT NOT NULL | DEFAULT 'unknown'. CHECK(rights_status IN ('unknown', 'reference_only', 'approved_for_internal_use', 'approved_for_external_use', 'restricted', 'expired')) |
| rights_note | TEXT | Nullable. Free-form license URL, photographer credit, agreement reference, or restriction reason |
| rights_reviewed_at | TEXT | Nullable. ISO 8601 UTC timestamp for last rights review |
| update_count | INTEGER NOT NULL | DEFAULT 0. Incremented on each successful re-import |
| created_at | TEXT NOT NULL | ISO 8601 UTC |
| updated_at | TEXT NOT NULL | ISO 8601 UTC |

Constraints:
- PRIMARY KEY (`id`)

Indexes:
- `idx_items_workspace_status_type` on (`workspace_id`, `status`, `type`)
- `idx_items_workspace_updated_at` on (`workspace_id`, `updated_at`)
- `unq_items_workspace_source_external` unique on (`workspace_id`, `source_id`, `source_external_id`) WHERE `source_id IS NOT NULL`

### `items_image`

Extension for `type='image'`.

| Column | Type | Notes |
|---|---|---|
| item_id | TEXT NOT NULL | Primary key. FK -> items(id) |
| file_ref | TEXT | Nullable PocketBase-managed file reference |
| mime_type | TEXT | Nullable |
| width | INTEGER | Nullable pixel width |
| height | INTEGER | Nullable pixel height |
| dominant_colors | TEXT | Nullable JSON array of hex colors |
| perceptual_hash | TEXT | Nullable. Used for visual dedup |
| ocr_text | TEXT | Nullable human-confirmed OCR; AI OCR lives in `ai_annotations` |

Indexes:
- `idx_items_image_perceptual_hash` on (`perceptual_hash`)

### `items_caption`

Extension for `type='caption'`.

| Column | Type | Notes |
|---|---|---|
| item_id | TEXT NOT NULL | Primary key. FK -> items(id) |
| body | TEXT NOT NULL | Caption text |
| tone | TEXT | Nullable human-applied tone |
| cta_type | TEXT | Nullable human-applied CTA type |
| length_chars | INTEGER | Nullable cached character count |

### `items_note`

Extension for `type='note'`.

| Column | Type | Notes |
|---|---|---|
| item_id | TEXT NOT NULL | Primary key. FK -> items(id) |
| body | TEXT NOT NULL | BlockNote JSON or markdown/plain text |
| format | TEXT NOT NULL | DEFAULT 'blocknote'. CHECK(format IN ('blocknote', 'markdown', 'plain')) |

### `items_link`

Extension for `type='link'`.

| Column | Type | Notes |
|---|---|---|
| item_id | TEXT NOT NULL | Primary key. FK -> items(id) |
| url | TEXT NOT NULL | Canonical URL |
| og_metadata | TEXT | Nullable JSON object |
| content_type | TEXT | Nullable. CHECK(content_type IS NULL OR content_type IN ('article', 'video', 'pdf', 'audio', 'unknown')) |
| fetched_at | TEXT | Nullable ISO 8601 UTC timestamp |

### `item_assets`

Stored files attached to an item. v0.1 uses this for local PDF source files while keeping the item itself as `type='link'` with `items_link.content_type='pdf'`, and for client-generated thumbnail files.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| workspace_id | TEXT NOT NULL | FK -> workspaces(id) |
| item_id | TEXT NOT NULL | FK -> items(id) |
| role | TEXT NOT NULL | CHECK(role IN ('source_file', 'thumbnail')) |
| file_ref | TEXT NOT NULL | PocketBase filesystem key |
| original_name | TEXT NOT NULL | Original uploaded filename |
| mime_type | TEXT NOT NULL | Uploaded file MIME type |
| size_bytes | INTEGER | Nullable uploaded file size |
| created_at | TEXT NOT NULL | ISO 8601 UTC |

Constraints:
- PRIMARY KEY (`id`)
- UNIQUE (`item_id`, `role`)

Indexes:
- `idx_item_assets_workspace_item` on (`workspace_id`, `item_id`)

### Removed by migration `0002_personal_archive_pivot.js`

The current schema no longer includes:

- `type='campaign'`
- `status IN ('inbox', 'triaged', 'retired')`
- `campaign_profiles`
- `relationship_types.type='retired_by'`

---

## Graph

### `relationship_types`

Registry of valid relationship types. Seeded by the loader; the migration creates the table empty.

| Column | Type | Notes |
|---|---|---|
| type | TEXT NOT NULL | Primary key |
| is_symmetric | INTEGER NOT NULL | CHECK(is_symmetric IN (0, 1)) |
| description | TEXT NOT NULL | Human description |

### `relationships`

One row per graph edge. Symmetric relationship types are stored once with canonical ordering.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| workspace_id | TEXT NOT NULL | FK -> workspaces(id) |
| from_id | TEXT NOT NULL | FK -> items(id) |
| to_id | TEXT NOT NULL | FK -> items(id) |
| type | TEXT NOT NULL | FK -> relationship_types(type) |
| weight | REAL | Nullable. CHECK(weight IS NULL OR (weight >= 0 AND weight <= 1)) |
| metadata | TEXT | Nullable JSON |
| note | TEXT | Nullable human-readable annotation |
| asserted_by | TEXT NOT NULL | CHECK(asserted_by IN ('human', 'subagent:enrichment', 'subagent:import')) |
| created_at | TEXT NOT NULL | ISO 8601 UTC |

Constraints:
- PRIMARY KEY (`id`)
- CHECK (`from_id != to_id`)
- UNIQUE (`workspace_id`, `from_id`, `to_id`, `type`)

Trigger:
- `trg_relationships_symmetric_ordering` BEFORE INSERT ON `relationships`
- If `NEW.type` points to `relationship_types.is_symmetric = 1` and `NEW.from_id > NEW.to_id`, the trigger aborts with: `symmetric relationships must use canonical ordering: from_id < to_id`

Indexes:
- `idx_relationships_workspace_from_type` on (`workspace_id`, `from_id`, `type`)
- `idx_relationships_workspace_to_type` on (`workspace_id`, `to_id`, `type`)
- `idx_relationships_workspace_type` on (`workspace_id`, `type`)

Reverse-direction queries use the `to_id` index. Reverse edges are not materialized.

---

## Organization

### `tags`

Approved and pending tag vocabulary.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| workspace_id | TEXT NOT NULL | FK -> workspaces(id) |
| name | TEXT NOT NULL | Lowercase/hyphen format enforced by application code |
| status | TEXT NOT NULL | DEFAULT 'pending'. CHECK(status IN ('approved', 'pending', 'rejected')) |
| created_by | TEXT NOT NULL | CHECK(created_by IN ('human', 'subagent:enrichment')) |
| created_at | TEXT NOT NULL | ISO 8601 UTC |

Constraints:
- PRIMARY KEY (`id`)
- UNIQUE (`workspace_id`, `name`)

### `item_tags`

Many-to-many junction between items and tags.

| Column | Type | Notes |
|---|---|---|
| item_id | TEXT NOT NULL | FK -> items(id) |
| tag_id | TEXT NOT NULL | FK -> tags(id) |
| applied_by | TEXT NOT NULL | CHECK(applied_by IN ('human', 'subagent:enrichment')) |
| applied_at | TEXT NOT NULL | ISO 8601 UTC |

Constraints:
- PRIMARY KEY (`item_id`, `tag_id`)

### `collections`

Organizational groupings of items, orthogonal to item status.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| workspace_id | TEXT NOT NULL | FK -> workspaces(id) |
| name | TEXT NOT NULL | Free-form |
| description | TEXT | Nullable markdown |
| created_at | TEXT NOT NULL | ISO 8601 UTC |

### `collection_items`

Many-to-many junction between collections and items.

| Column | Type | Notes |
|---|---|---|
| collection_id | TEXT NOT NULL | FK -> collections(id) |
| item_id | TEXT NOT NULL | FK -> items(id) |
| added_at | TEXT NOT NULL | ISO 8601 UTC |
| added_by | TEXT NOT NULL | Actor string |

Constraints:
- PRIMARY KEY (`collection_id`, `item_id`)

Collections are flat groups. Reuse history is represented by relationships such as `used_in`, not by collection membership.

---

## AI

### `ai_annotations`

Every AI-generated metadata observation about an item. Annotation rows default to `review_status='pending'` and remain pending until human review.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| workspace_id | TEXT NOT NULL | FK -> workspaces(id) |
| item_id | TEXT NOT NULL | FK -> items(id) |
| field_name | TEXT NOT NULL | Namespace for the annotation |
| payload | TEXT NOT NULL | JSON |
| model_name | TEXT NOT NULL | Model identifier |
| model_version | TEXT | Nullable |
| prompt_version | TEXT | Nullable prompt hash/version |
| confidence | REAL | Nullable. CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)) |
| review_status | TEXT NOT NULL | DEFAULT 'pending'. CHECK(review_status IN ('pending', 'approved', 'rejected', 'superseded')) |
| reviewed_by | TEXT | Nullable PocketBase user ID text reference; no FK |
| reviewed_at | TEXT | Nullable ISO 8601 UTC |
| created_at | TEXT NOT NULL | ISO 8601 UTC |
| superseded_at | TEXT | Nullable ISO 8601 UTC |

Indexes:
- `idx_ai_annotations_workspace_item_field` on (`workspace_id`, `item_id`, `field_name`)
- `idx_ai_annotations_workspace_review_status_created` on (`workspace_id`, `review_status`, `created_at`)

Registered v1 namespaces are documented outside the schema. Adding a new namespace is a stop-and-ask but does not require a migration.

---

## History

### `item_events`

Append-only audit log for consequential state changes.

| Column | Type | Notes |
|---|---|---|
| id | TEXT NOT NULL | Primary key |
| workspace_id | TEXT NOT NULL | FK -> workspaces(id) |
| item_id | TEXT NOT NULL | FK -> items(id) |
| event_type | TEXT NOT NULL | Event type string; not CHECK-constrained |
| actor | TEXT NOT NULL | `user:{id}` \| `subagent:import` \| `subagent:enrichment` \| `subagent:hygiene` \| `system` |
| metadata | TEXT | Nullable JSON |
| created_at | TEXT NOT NULL | ISO 8601 UTC |

Indexes:
- `idx_item_events_workspace_item_created` on (`workspace_id`, `item_id`, `created_at`)
- `idx_item_events_workspace_event_type_created` on (`workspace_id`, `event_type`, `created_at`)

Event types are defined by convention in the governance docs so new event types do not require a schema migration.

---

## Hygiene

### `banned_phrases`

Anti-slop blocklist loaded by every AI subagent at run start.

| Column | Type | Notes |
|---|---|---|
| phrase | TEXT NOT NULL | Primary key. Lowercase |
| added_at | TEXT NOT NULL | ISO 8601 UTC |
| added_by | TEXT NOT NULL | Actor string |
| reason | TEXT NOT NULL | Reason/category |

---

## Search

### `embeddings`

Scaffolded vector table, empty in v0.1 and v1. No v1 query path uses this table.

| Column | Type | Notes |
|---|---|---|
| item_id | TEXT NOT NULL | FK -> items(id) |
| field_name | TEXT NOT NULL | Embedded field namespace |
| model_name | TEXT NOT NULL | Embedding model |
| model_version | TEXT NOT NULL | Embedding model version |
| vector | BLOB NOT NULL | Placeholder storage type until v1.5 vector-query scope |

Constraints:
- PRIMARY KEY (`item_id`, `field_name`, `model_name`, `model_version`)

### `items_fts`

FTS5 virtual table for canonical item text.

Definition:

```sql
CREATE VIRTUAL TABLE items_fts USING fts5(
  title,
  description,
  summary,
  content='',
  tokenize='porter ascii'
)
```

Indexed columns:
- `title`
- `description`
- `summary`

The FTS rowid corresponds to the SQLite internal integer `rowid` of the `items` table row. Structured filters such as type, status, source, tags, and collections are handled through normal tables and indexes, not by FTS columns.

Triggers:
- `trg_items_fts_after_insert` AFTER INSERT ON `items`: inserts `NEW.rowid`, title, description, summary into `items_fts`
- `trg_items_fts_after_update` AFTER UPDATE OF title, description, summary ON `items`: deletes the old FTS row and inserts the new one
- `trg_items_fts_before_delete` BEFORE DELETE ON `items`: deletes the FTS row before the item row is removed

---

## What Is Intentionally Not In The Schema

- No `is_deleted` / soft-delete column. Archiving is `status='archived'`; deletion is real.
- No `tags` JSON column on items. Tags are normalized for searchability and vocabulary lock.
- No materialized reverse edges. Indexes on `to_id` are sufficient.
- No `parent_item_id` for hierarchies. Hierarchies are relationships (`derived_from`, `annotates`).
- No permissions table beyond workspace + privacy level. Cross-workspace sharing is deferred and will be a relationship type when introduced.
