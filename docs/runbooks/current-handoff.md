# Current Handoff

Last updated: 2026-05-04

## Current Phase

Personal archive v0.1 is past the initial schema/seed boundary and is now in live UI/product-surface plus Track 2 import iteration.

The app has a working PocketBase-backed archive read path, item detail path, core write paths, first collection view, Austen/Ridgeway-inspired archive UI shell, and first real local image import path.

## Latest Accepted Result

- Latest import checkpoint:
  - Commit: `553df61 Implement first local image import path`
- Latest UI checkpoint:
  - Commit: `172afbf Checkpoint archive UI polish`
- Prior nav checkpoint:
  - Commit: `8e07f8d Refine Austen-style archive navigation`
- Current archive surface includes:
  - centered fixed pill navigation with live dot, Index, Views, Filters, Info, and Settings shell
  - centered secondary pill row for Index/View/Filter/Info/Settings choices
  - Gallery grid with `2-8` column controls
  - Spotlight-style bottom search/import dock
  - simplified archive cards with equal preview rhythm and hover-only action affordances
- Product Sans is wired through local `@font-face` URLs, but the actual font files are not present yet:
  - `src/assets/fonts/ProductSans-Regular.woff2`
  - `src/assets/fonts/ProductSans-Bold.woff2`
- Current Spotlight import support:
  - URL capture creates live `link` records through `/api/vita/item-capture`
  - note capture creates live `note` records through `/api/vita/item-capture`
  - local image upload creates live `image` records with `items_image.file_ref`
  - PDF, video, audio, and other file types are still staged as unsupported

## Verified Runtime Notes

- `node --check pocketbase/pb_hooks/item_capture.pb.js` passed after the image import checkpoint.
- `npm run typecheck` passed after the image import checkpoint.
- `npm run build` passed after the image import checkpoint.
- `http://127.0.0.1:5173/` returned `200`.
- `http://127.0.0.1:5173/?type=image` returned `200`.
- `GET /api/vita/item-cards?workspace_id=seed:ws001&type=image` returned `200`.
- `GET /api/vita/item-detail?workspace_id=seed:ws001&item_id=<imported-image-id>` returned `200`.
- `GET /api/vita/imported-file?key=<items_image.file_ref>` returned `200 image/png`.
- Duplicate URL capture returned `200`.
- Duplicate image capture returned `200` with `created: false`.
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

Continue Track 2 import with the next file-ingestion slice.

Recommended next slice:

- design the PDF/media import backend path now that local image import works
- decide whether PDF/media belong in the existing item-type tables or need a new asset/file model
- keep URL, note, and local image import behavior unchanged
- avoid schema changes unless a concrete ingestion incompatibility is proven

## In-Scope Files For Next Slice

- `src/components/spotlight/SpotlightDock.tsx`
- `src/App.tsx`
- `src/data/pocketBaseItemCapture.ts`
- `pocketbase/pb_hooks/item_capture.pb.js`
- `SCHEMA.md` and migration files only if PDF/media support proves a concrete schema gap
- `README.md` and/or `docs/runbooks/current-handoff.md` only if workflow docs need alignment

## Out-Of-Scope Files For Next Slice

- schema and migration files unless a concrete runtime blocker is proven
- seed fixture content
- existing item-detail behavior
- CollectionView behavior
- unrelated nav/card polish
- URL, note, and local image import rewrites
- `.DS_Store` files and `.claude/`

## Done-When Criteria

The next Track 2 planning/implementation slice is done when:

- PDF/media import is either implemented narrowly or blocked by a documented schema decision
- URL, note, and local image capture continue to work in live PocketBase mode
- source metadata behavior is explicit for any newly supported input type
- `npm run typecheck` and `npm run build` pass
- live-mode startup and verification steps are documented if they change
