# ADR 0007: Video as a First-Class Item Type

**Status:** Accepted
**Date:** 2026-05-14
**Amends:** ADR 0001 (Items as the Atomic Unit), CONSTITUTION sections 2-4 after documentation sync

---

## Context

The archive currently treats externally hosted video URLs as `type='link'` rows with `items_link.content_type='video'`. That works for YouTube, Vimeo, and other remote sources because the canonical object being captured is a URL plus Open Graph metadata.

Local video uploads are different. A local video file has file-level metadata that is not link metadata: video file reference, MIME type, intrinsic width, intrinsic height, duration, poster frame, aspect ratio, dominant colors, and poster hash. It also needs item-card rendering, item-detail playback, upload validation, file serving behavior, and autoplay performance rules that belong to the captured media object itself.

Two plausible models:

1. Add `video` to `items.type` and create an `items_video` extension table.
2. Keep videos as `type='link'`, set `items_link.content_type='video'`, and extend `item_assets` roles to carry the video source file and poster frame.

The archive's atomic-unit model says anything that can participate in graph, collections, search, status, and detail views should be an `items` row with a type discriminator and a type-specific extension table when it has type-specific fields.

## Decision

Adopt option 1: **video is a first-class item type**.

Add `video` to the `items.type` discriminator and add an `items_video` extension table keyed by `item_id`.

The `items_video` table owns local video fields:

- `item_id`
- `file_ref`
- `mime_type`
- `width`
- `height`
- `duration_ms`
- `poster_file_ref`
- `dominant_colors`
- `perceptual_hash`
- `aspect_ratio`

Production behavior must preserve arbitrary source aspect ratios. Portrait phone recordings, landscape clips, square clips, and vertical 9:16 videos all keep their native ratio. Masonry and detail rendering size by stored `aspect_ratio`; neither storage nor rendering normalizes, crops, or letterboxes video content as a data-model rule.

Remote hosted videos remain links: `type='link'` with `items_link.content_type='video'`. This ADR only changes local uploaded video files.

No transcoding is introduced. Accepted codecs and containers are an upload-validation concern, not a schema abstraction.

## Consequences

**Positive:**

- Video joins the same graph, collection, status, source, event, and search model as images, notes, captions, and links.
- Local uploaded video metadata has a clear extension table instead of overloading link metadata.
- The item-card and item-detail surfaces can render uploaded video directly without treating a file as a fake URL capture.
- Aspect ratio is cached for masonry layout, matching the existing image layout strategy.

**Negative:**

- Adding the type requires rebuilding the `items.type` CHECK constraint in SQLite.
- Every hardcoded type union and filter must be updated.
- The archive now has two video concepts: uploaded video items and remote video links. The UI must distinguish them by item type and format without confusing users.
- Video playback introduces file-serving requirements that still need implementation: HTTP Range support, cache headers, poster serving, and bounded autoplay.

**Neutral:**

- `item_assets` still carries generic stored files such as source PDFs and thumbnails. It is not the canonical home for uploaded video-specific metadata.
- Existing URL-based YouTube/Vimeo captures keep their current storage model.
- `items_link.content_type='video'` remains valid for remote links.

## Alternative Rejected

**Keep video uploads as links with `content_type='video'` and extend `item_assets` roles.**

Rejected because local video is not a link. Modeling it as one would force `items_link.url` to hold an internal file reference or pseudo-URL, then scatter video metadata across `item_assets` roles and client code. That weakens the item-type boundary, makes detail rendering branch on asset roles instead of item type, and turns a type-specific media object into a special case of link rendering.

The extended-asset approach would also make local uploaded videos and remote video links look identical at the top-level type layer even though their retrieval, playback, metadata, and upload behavior are different.

## Reversibility

Medium.

The schema can be migrated back by converting uploaded `video` items into `link` items with asset rows, then dropping `items_video` and rebuilding the type CHECK constraint again. The data is recoverable if file references are preserved, but the conversion would be noisy because video-specific fields would need to move into JSON or asset metadata.

## Implementation Notes

The implementation slice following this ADR must:

1. Add the schema migration for `items_video` and the `video` item type.
2. Extend capture/upload handling for validated local video files and poster files.
3. Preserve `status='active'` for imports and uploads under the current personal archive lifecycle.
4. Keep remote video URLs as `type='link'`.
5. Render videos using stored aspect ratio, with no crop or letterbox behavior imposed by the model.
6. Use native browser APIs only; no new dependency, no ffmpeg, and no transcoding.
