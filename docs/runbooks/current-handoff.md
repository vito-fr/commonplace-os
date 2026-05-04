# Current Handoff

Last updated: 2026-05-04

## Current Phase

Personal archive v0.1 is past the initial schema/seed boundary and is now in live UI/product-surface iteration.

The app has a working PocketBase-backed archive read path, item detail path, core write paths, first collection view, and the first Austen/Ridgeway-inspired archive UI shell. The current UI checkpoint is committed.

## Latest Accepted Result

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

## Verified Runtime Notes

- `npm run typecheck` passed after the UI checkpoint.
- `npm run build` passed after the UI checkpoint.
- `http://127.0.0.1:5173/` returned `200`.
- `http://127.0.0.1:5173/?type=image` returned `200`.
- Build currently warns that Product Sans font URLs do not resolve at build time; this is expected until local font files are supplied.
- Live backend mode still requires PocketBase first, then Vite live mode:
  - `npm run pb:serve`
  - `npm run dev:live`
- Without `VITE_ITEM_CARD_READER=pocketbase`, the frontend uses fixture mode and write/import surfaces remain limited.

## Current Dirty Worktree Notes

The UI checkpoint intentionally excluded unrelated dirty files:

- `.DS_Store`
- `docs/.DS_Store`
- `.claude/`
- `README.md`
- `package.json`
- `seed/README.md`
- `seed/load.js`

Do not sweep these into UI commits. Review them separately before staging.

## Next Task

Start Track 2 import as a separate planned slice.

Recommended next slice:

- design the unified import surface and backend ingestion path for URL, text note, local image/file, PDF, Pinterest, Are.na, and YouTube
- keep the first implementation local/manual-first
- preserve the existing `/api/vita/item-capture` path for text and URL
- avoid schema changes unless a concrete ingestion incompatibility is proven

## In-Scope Files For Next Slice

- `src/components/spotlight/SpotlightDock.tsx`
- `src/App.tsx`
- `src/data/pocketBaseItemCapture.ts`
- `pocketbase/pb_hooks/item_capture.pb.js`
- `README.md` and/or `docs/runbooks/current-handoff.md` only if workflow docs need alignment

## Out-Of-Scope Files For Next Slice

- schema and migration files unless a concrete runtime blocker is proven
- seed fixture content
- existing item-detail behavior
- CollectionView behavior
- unrelated nav/card polish
- `.DS_Store` files and `.claude/`

## Done-When Criteria

The next Track 2 planning/implementation slice is done when:

- the import UX has one clear entry point from the Spotlight dock
- text and URL capture continue to work in live PocketBase mode
- file/media/PDF import is either implemented narrowly or clearly staged as unsupported
- source metadata behavior is explicit for each supported input type
- `npm run typecheck` and `npm run build` pass
- live-mode startup and verification steps are documented if they change
