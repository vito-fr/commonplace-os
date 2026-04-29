# Schema Reference

Human-readable schema documentation. SQL lives in `migrations/`. When the two diverge, migrations win and this file is updated to match — never the reverse.

All tenant-scoped tables carry `workspace_id`. All timestamps are stored as ISO 8601 UTC. All collection IDs are PocketBase's default 15-character auto-generated format (alphanumeric, lexicographically sortable by creation time). The canonical-ordering rule for symmetric relationships (`from_id < to_id`) works on this format identically to how it would on ULID.

---

## Tenancy

### `workspaces`

Top-level tenant. Default workspace `personal` is seeded by the first migration.

| Column | Type | Notes |
|---|---|---|
| id | text PK | PocketBase 15-char auto-generated ID |
| name | text | Unique within the system |
| kind | text | `personal` \| `business` |
| created_at | text | |

### `sources`

The origin of imported items. A source is a Pinterest board, an Are.na channel, a URL domain, the local filesystem, an iOS share-sheet capture, etc. Sources carry default privacy.

| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| workspace_id | text FK | |
| kind | text | `pinterest` \| `arena` \| `url` \| `local` \| `ios_capture` \| `manual` \| ... |
| identifier | text | Board ID, channel slug, domain, etc. |
| label | text | Human-readable name |
| default_privacy_level | text | `private` \| `personal` \| `team` \| `public` |
| created_at | text | |

Index: `(workspace_id, kind, identifier)` unique.

---

## Items

### `items`

The atomic unit. Every piece of content — image, caption, note, link, campaign — is an item.

| Column | Type | Notes |
|---|---|---|
| id | text PK | PocketBase 15-char auto-generated ID |
| workspace_id | text FK | |
| type | text | `image` \| `caption` \| `note` \| `link` \| `campaign` |
| status | text | `inbox` \| `triaged` \| `active` \| `archived` \| `retired` |
| title | text | Optional; AI-suggested title proposed via annotation, not written here |
| description | text | Human-authored canonical description. AI never writes this. |
| summary | text | Human-authored canonical summary. AI never writes this. |
| source_id | text FK | Nullable — manual items have no source |
| source_external_id | text | The source's identifier for this item — Pinterest pin ID, Are.na block ID, URL hash. Used for re-import idempotency. |
| privacy_level | text | Nullable — null means inherit from `sources.default_privacy_level` |
| update_count | integer | Incremented on each successful re-import |
| created_at | text | |
| updated_at | text | |

Indexes:
- `(workspace_id, status, type)`
- `(workspace_id, source_id, source_external_id)` unique where source_id is not null
- `(workspace_id, updated_at)`

### `items_image`

Extension for `type='image'`.

| Column | Type | Notes |
|---|---|---|
| item_id | text PK FK | |
| file_ref | text | PocketBase file reference |
| mime_type | text | |
| width | integer | |
| height | integer | |
| dominant_colors | text | JSON array of hex codes |
| perceptual_hash | text | For visual dedup |
| ocr_text | text | Optional human-confirmed OCR; AI-extracted OCR lives in `ai_annotations` |

Index: `perceptual_hash`.

### `items_caption`

Extension for `type='caption'`.

| Column | Type | Notes |
|---|---|---|
| item_id | text PK FK | |
| body | text | The caption itself |
| tone | text | Human-applied; nullable |
| cta_type | text | Human-applied; nullable |
| length_chars | integer | Cached for query convenience |

### `items_note`

Extension for `type='note'`.

| Column | Type | Notes |
|---|---|---|
| item_id | text PK FK | |
| body | text | BlockNote JSON or markdown |
| format | text | `blocknote` \| `markdown` \| `plain` |

### `items_link`

Extension for `type='link'`.

| Column | Type | Notes |
|---|---|---|
| item_id | text PK FK | |
| url | text | Canonical URL |
| og_metadata | text | JSON |
| content_type | text | `article` \| `video` \| `pdf` \| `audio` \| `unknown` |
| fetched_at | text | When OG/preview was last refreshed |

### `campaign_profiles`

Extension for `type='campaign'`.

| Column | Type | Notes |
|---|---|---|
| item_id | text PK FK | |
| phase | text | `planning` \| `live` \| `wrapping` \| `post_mortem` |
| channel | text | `email` \| `social` \| `paid` \| `web` \| `multi` \| `other` |
| start_at | text | Nullable |
| end_at | text | Nullable |
| brief | text | The campaign brief — human-authored |
| kpi_summary | text | Human-authored post-mortem notes |

The campaign's lifecycle status (`inbox`, `triaged`, `active`, `archived`, `retired`) lives on `items.status`. `phase` is the campaign-specific operational state and is orthogonal to `status`.

---

## Graph

### `relationship_types`

The registry. Mirror of `docs/relationships.md`.

| Column | Type | Notes |
|---|---|---|
| type | text PK | `inspired_by`, `references`, ... |
| is_symmetric | integer | 0 or 1 |
| description | text | Human description |

### `relationships`

A single row per edge. Symmetric types use canonical ordering: `from_id < to_id` lexicographically, enforced by CHECK constraint on insert when type is symmetric.

| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| workspace_id | text FK | |
| from_id | text FK | items.id |
| to_id | text FK | items.id |
| type | text FK | relationship_types.type |
| weight | real | 0–1, nullable |
| metadata | text | JSON, type-specific. e.g. for `used_in`, `{"role": "primary"}` |
| note | text | Human-readable, optional |
| asserted_by | text | `human` \| `subagent:enrichment` \| `subagent:import` |
| created_at | text | |

CHECK: `from_id != to_id`.
CHECK: when `type` is symmetric, `from_id < to_id`.
UNIQUE: `(workspace_id, from_id, to_id, type)`.

Indexes:
- `(workspace_id, from_id, type)`
- `(workspace_id, to_id, type)`
- `(workspace_id, type)`

Reverse-direction queries use `to_id` index. Reverse edges are not materialized.

---

## Organization

### `tags`

| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| workspace_id | text FK | |
| name | text | |
| status | text | `approved` \| `pending` \| `rejected` |
| created_by | text | `human` \| `subagent:enrichment` |
| created_at | text | |

Unique: `(workspace_id, name)`.

Only `approved` tags are searchable. `pending` tags are visible in the suggestions queue.

### `item_tags`

| Column | Type | Notes |
|---|---|---|
| item_id | text FK | |
| tag_id | text FK | |
| applied_by | text | `human` \| `subagent:enrichment` |
| applied_at | text | |

PK: `(item_id, tag_id)`.

### `collections`

| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| workspace_id | text FK | |
| name | text | |
| description | text | |
| created_at | text | |

### `collection_items`

| Column | Type | Notes |
|---|---|---|
| collection_id | text FK | |
| item_id | text FK | |
| added_at | text | |
| added_by | text | |

PK: `(collection_id, item_id)`.

Note: campaign attachment is a relationship (`used_in` to a `type='campaign'` item), not a collection. Collections are organizational; campaigns are participatory.

---

## AI

### `ai_annotations`

Every AI-generated piece of metadata about an item.

| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| workspace_id | text FK | |
| item_id | text FK | |
| field_name | text | `tags`, `description`, `summary`, `visual_dna`, `ocr_text`, `color_palette`, `semantic_neighbors`, ... |
| payload | text | JSON, shape determined by `field_name` |
| model_name | text | `claude-sonnet-4`, `nomic-embed-text`, ... |
| model_version | text | |
| prompt_version | text | Hash or version ID of the prompt used |
| confidence | real | 0–1, nullable |
| review_status | text | `pending` \| `approved` \| `rejected` \| `superseded` |
| reviewed_by | text FK | Nullable |
| reviewed_at | text | Nullable |
| created_at | text | |
| superseded_at | text | Nullable; set when a newer annotation for `(item_id, field_name)` is created |

Indexes:
- `(workspace_id, item_id, field_name)`
- `(workspace_id, review_status, created_at)`

`field_name` is namespaced; new namespaces require a stop-and-ask but no schema migration.

---

## History

### `item_events`

The audit log and the foundation of hygiene queries.

| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| workspace_id | text FK | |
| item_id | text FK | |
| event_type | text | See list below |
| actor | text | `user:{id}` \| `subagent:import` \| `subagent:enrichment` \| `subagent:hygiene` \| `system` |
| metadata | text | JSON, type-specific |
| created_at | text | |

Event types:

- `imported` — `{source_id, source_external_id}`
- `status_changed` — `{from, to}`
- `collection_added` — `{collection_id}`
- `collection_removed` — `{collection_id}`
- `campaign_attached` — `{campaign_id, role}`
- `campaign_detached` — `{campaign_id}`
- `relationship_added` — `{relationship_id, type, other_item_id}`
- `relationship_removed` — `{relationship_id}`
- `annotation_added` — `{annotation_id, field_name}`
- `annotation_approved` — `{annotation_id, field_name}`
- `annotation_rejected` — `{annotation_id, field_name}`
- `annotation_superseded` — `{annotation_id, replaced_by_annotation_id}`
- `tagged` — `{tag_id, applied_by}`
- `untagged` — `{tag_id}`
- `exported` — `{destination, format}`
- `used` — `{context}` — explicit user action recording active use
- `retired` — `{replaced_by_item_id}` (optional)

Indexes:
- `(workspace_id, item_id, created_at)`
- `(workspace_id, event_type, created_at)`

---

## Hygiene

### `banned_phrases`

| Column | Type | Notes |
|---|---|---|
| phrase | text PK | Lowercased |
| added_at | text | |
| added_by | text | |
| reason | text | |

Loaded by every AI subagent at run start. See `docs/anti-slop/banned-phrases.md`.

---

## What is intentionally not in the schema

- No `is_deleted` / soft-delete column. Retirement is `status='retired'`. Deletion is real.
- No `tags` JSON column on items. Tags are normalized for searchability and vocabulary lock.
- No materialized reverse edges. Indexes on `to_id` are sufficient.
- No `parent_item_id` for hierarchies. Hierarchies are relationships (`derived_from`, `annotates`).
- No permissions table beyond workspace + privacy_level. Cross-workspace sharing is deferred and will be a relationship type when introduced.
