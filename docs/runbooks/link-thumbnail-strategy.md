# Link Thumbnail Strategy

## Current behavior

URL capture stores the canonical URL and fills `items_link.og_metadata` from HTML metadata plus provider fallbacks. Pinterest and YouTube links can receive oEmbed thumbnails, and generic websites use OpenGraph or Twitter image metadata when present. Card rendering currently prefers local thumbnails/assets first, then remote OpenGraph media as the visual fallback.

This means webpage thumbnails are not Are.na-style screenshots yet. They depend on the source page exposing usable social metadata, and Safari/Chrome can differ if a remote image is blocked, cached differently, or served in a browser-sensitive format.

## Target behavior

For normal webpage links, the archive should prefer a rendered screenshot thumbnail of the page and keep OpenGraph images as fallback metadata. This matches the product model we want from Are.na-like link blocks: the saved object should visually represent the captured page, not only the page's social sharing image.

## Implementation direction

- Add a local/server screenshot thumbnail pipeline using Playwright or an equivalent renderer.
- Store the generated screenshot as an `item_assets` row with `role = 'thumbnail'`.
- Make link card readers prefer that local thumbnail before `og_metadata.image`.
- Keep provider thumbnails for Pinterest/YouTube as fallbacks when screenshot capture fails or is intentionally skipped.
- Do not capture authenticated, private, local, or sensitive URLs without explicit user confirmation.

The existing `/api/vita/item-thumbnail` endpoint is currently image-item focused, so link screenshots need either a generalized thumbnail endpoint or a link-specific thumbnail endpoint. No schema migration appears necessary because `item_assets` already supports thumbnail assets.
