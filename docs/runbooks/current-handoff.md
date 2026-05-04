# Current Handoff

Last updated: 2026-05-04

## Current Phase

Personal archive v0.1 is past the initial schema/seed boundary and is now in live UI/product-surface plus Track 2 import iteration.

The app has a working PocketBase-backed archive read path, item detail path, core write paths, first collection view, Austen/Ridgeway-inspired archive UI shell, local image/PDF import, and archive-card collection attach/create workflow.

## Latest Accepted Result

- Latest import/filter checkpoint:
  - Commit: `6cb8f67 Improve Spotlight import and archive filters`
- Latest card add-to-collection checkpoint:
  - Commit: `3ab6afb Implement card add-to-collection workflow`
- Prior nav/settings/search dock checkpoint:
  - Commit: `4e58bc0 Polish nav settings and search dock`
- Latest PDF import/reader checkpoint:
  - Commit: `90f1802 Implement local PDF import and reader`
- Prior archive card/search/nav polish checkpoint:
  - Commit: `06de7d6 Polish archive card metadata and controls`
- Prior image import checkpoint:
  - Commit: `553df61 Implement first local image import path`
- Latest UI checkpoint:
  - Commit: `172afbf Checkpoint archive UI polish`
- Prior nav checkpoint:
  - Commit: `8e07f8d Refine Austen-style archive navigation`
- Current archive surface includes:
  - centered fixed pill navigation with live dot, Index, Views, Filters, and Settings shell
  - centered secondary pill row for Index/View/Filter choices
  - Gallery grid with `2-8` column controls
  - Spotlight-style bottom search/import dock
  - simplified archive cards with equal preview rhythm, below-thumbnail truncated labels, and hover-only action affordances
  - card hover/focus metadata tags inside the preview frame for source, kind, upload/local status, rights warning, and collection count
  - card hover/focus label swap from title/filename to `added ... ago` when `createdAt` is available
  - card `+` opens an archive-level collection island anchored to the clicked card action
  - collection island can attach to existing collections or create a new collection and attach immediately
  - PDF link cards can render a same-origin first-page preview shell when an asset file is available
- Current item-card read model includes:
  - `createdAt`
  - `collectionCount`
  - PDF link asset fields for local PDF card previews
- Current search/nav polish includes:
  - bottom search placeholder: `Search archive`
  - nav pill text reveal refined to slide/blur inside the pill mask
  - one continuous blurred secondary-row membrane around split filter groups
  - Settings shortcut fields are editable locally and persisted in `localStorage`
- Product Sans is wired through local `@font-face` URLs, but the actual font files are not present yet:
  - `src/assets/fonts/ProductSans-Regular.woff2`
  - `src/assets/fonts/ProductSans-Bold.woff2`
- Current Spotlight import support:
  - bottom Import panel is organized as `Paste / Files / Sources`
  - Paste mode accepts URLs or note text and previews the detected capture type
  - Files mode stages multi-file batches, with a 20-file limit and 25MB-per-file limit
  - Sources mode documents current platform behavior without requiring API setup
  - URL capture creates live `link` records through `/api/vita/item-capture`
  - pasted Pinterest URLs are classified as `source.kind='pinterest'`
  - pasted Are.na URLs are classified as `source.kind='arena'`
  - YouTube/Vimeo URLs remain URL-source links and are stored with `items_link.content_type='video'`
  - note capture creates live `note` records through `/api/vita/item-capture`
  - local image upload creates live `image` records with `items_image.file_ref`
  - local PDF upload creates live `link` records with `items_link.content_type='pdf'` plus `item_assets.role='source_file'`
  - video, audio, and other file types are still staged as unsupported
- Current archive filters:
  - State, Kind, Origin, text query, and Format are wired through the live item-card endpoint
  - Origin exposes active stored source kinds: `local`, `manual`, `url`, `pinterest`, and `arena`
  - Format exposes `PDF`, `Video`, and `Website`; Website maps to the existing `items_link.content_type='unknown'` storage value

## Verified Runtime Notes

- `node --check pocketbase/pb_hooks/item_capture.pb.js` passed after the import/filter checkpoint.
- `node --check pocketbase/pb_hooks/item_cards.pb.js` passed after the import/filter checkpoint.
- `npm run typecheck` passed after the import/filter checkpoint.
- `npm run build` passed after the import/filter checkpoint.
- `http://127.0.0.1:5173/?format=pdf` returned `200`.
- `http://127.0.0.1:5173/?source=arena` returned `200`.
- `GET /api/vita/item-cards?workspace_id=seed:ws001&source=pinterest&q=vita-import-classification-test` returned `200` with `source: pinterest`.
- `GET /api/vita/item-cards?workspace_id=seed:ws001&source=arena&q=vita` returned `200` with `source: arena`.
- `GET /api/vita/item-cards?workspace_id=seed:ws001&format=video&q=vitaImportClassificationTest` returned `200` with `linkContentType: video`.
- `GET /api/vita/item-cards?workspace_id=seed:ws001&format=pdf` returned `200`.
- `node --check pocketbase/pb_migrations/0003_item_assets.js` passed after the PDF checkpoint.
- `node --check pocketbase/pb_hooks/item_capture.pb.js` passed after the PDF checkpoint.
- `node --check pocketbase/pb_hooks/item_detail.pb.js` passed after the PDF checkpoint.
- `node --check pocketbase/pb_hooks/item_delete.pb.js` passed after the PDF checkpoint.
- `node --check pocketbase/pb_hooks/item_collection.pb.js` passed after the card collection checkpoint.
- `npm run typecheck` passed after the latest card collection checkpoint.
- `npm run build` passed after the latest card collection checkpoint.
- `http://127.0.0.1:5173/` returned `200`.
- `http://127.0.0.1:5173/?type=image` returned `200`.
- `http://127.0.0.1:5173/pdf-preview?...` returned `200` for the same-origin PDF preview route.
- `GET /api/vita/item-cards?workspace_id=seed:ws001&type=image` returned `200` and includes `createdAt` plus `collectionCount`.
- `GET /api/vita/item-detail?workspace_id=seed:ws001&item_id=<imported-image-id>` returned `200`.
- `GET /api/vita/imported-file?key=<items_image.file_ref>` returned `200 image/png`.
- Duplicate URL capture returned `200` with `created: false`.
- Duplicate image capture returned `200` with `created: false`.
- Note capture returned `200`.
- `GET /api/vita/collection-options?workspace_id=seed:ws001&item_id=<item-id>` returned `200`.
- `POST /api/vita/collection-create` returned a new collection, membership, and `collection_added` event.
- Duplicate collection attach returned `400`.
- Browser check confirmed card `+` opens the anchored collection island and card body still opens item detail.
- Build currently warns that Product Sans font URLs do not resolve at build time; this is expected until local font files are supplied.
- Live backend mode still requires PocketBase first, then Vite live mode:
  - `npm run pb:serve`
  - `npm run dev:live`
- Without `VITE_ITEM_CARD_READER=pocketbase`, the frontend uses fixture mode and write/import surfaces remain limited.

## Current Dirty Worktree Notes

The latest UI/import checkpoints intentionally excluded unrelated dirty files:

- `.DS_Store`
- `docs/.DS_Store`
- `.claude/`
- `README.md`
- `package.json`
- `seed/README.md`
- `seed/load.js`

Do not sweep these into UI commits. Review them separately before staging.

## Next Task

Implement the first collection management/index slice.

Recommended next slice:

- expose Collections from the existing `Index` top-nav surface
- list existing collections with counts and concise metadata
- route collection rows/cards to the existing `/collections/:collectionId` surface
- keep rename/delete/deeper collection management out of this slice

## In-Scope Files For Next Slice

- `src/App.tsx`
- `src/data/pocketBaseItemCollection.ts`
- `pocketbase/pb_hooks/item_collection.pb.js`
- `src/components/nav/PillNav.tsx` if Index needs a collection entry/control
- `src/styles.css` for the narrow collection index surface styling

## Out-Of-Scope Files For Next Slice

- schema and migration files unless a concrete runtime blocker is proven
- seed fixture content
- existing item-detail behavior
- existing CollectionView behavior beyond routing entry points
- unrelated nav/card polish
- URL, note, local image, and local PDF import rewrites
- `.DS_Store` files and `.claude/`

## Done-When Criteria

The next collection index slice is done when:

- Index exposes a Collections entry or mode
- existing collections are visible with enough metadata to choose one
- selecting a collection opens `/collections/:collectionId`
- current card add-to-collection and item-detail collection behavior still work
- `npm run typecheck` and `npm run build` pass
- live-mode verification covers collection listing and collection navigation
