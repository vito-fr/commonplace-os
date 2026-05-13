# Safari Jitter + Card Motion Handoff

Date: 2026-05-13  
Repo: `/Users/vito/Desktop/vita-brain`  
Current branch when written: `design/item-detail-rail-phase-5-polish`

## User Goal

Fix the remaining Safari-only pixel jitter / shimmer on home masonry cards and collection pages without regressing the product's card animations.

The user explicitly rejected the last approach because it removed too much card hover animation. Do not solve this by globally disabling transitions or flattening the card interaction system.

## Current User Constraints

- Do not remove masonry/card density animations.
- Do not globally disable transitions.
- Do not add blanket `translate3d`, `translateZ`, `backface-visibility`, or `will-change` hacks.
- Do not touch Settings, item-detail IA, add-to-collection popover, delete/download behavior, backend, PocketBase schema, or live-mode behavior while working on this bug.
- Do not claim Safari jitter is fixed from SafariDriver only.
- Real Safari manual verification is required, especially page zoom or trackpad pinch zoom plus hover.
- Preserve the existing animation feel on item cards and collection cards.

## What The User Observes

- Safari shows small 1px horizontal lines or shimmer around some cards.
- Chrome and the Codex in-app browser mostly do not show the issue.
- Screenshotting can temporarily change or hide the artifact.
- The issue appears on both home pages and collection pages.
- It is more visible when zoomed/pinch-zoomed.
- Hovering card controls can trigger the shimmer.
- Previous broad CSS attempts made the UI feel worse by removing animations.

## Important Prior Findings

- Earlier probes showed card/media geometry is usually stable. This points toward a Safari/WebKit raster/compositor artifact rather than React state moving elements.
- Safari is sensitive to combinations of:
  - fractional text/media rects
  - rounded clipping
  - overflow hidden
  - transformed children
  - opacity/transform hover layers
  - SVG/icon layers
  - animated media/card surfaces
- Safari card intro scale was previously found to create fractional media rects inside rounded/overflow-hidden cards. Safari intro should stay opacity plus integer `translateY`, with no scale.
- Card SVGs were previously stabilized by using larger integer icon boxes and removing SVG transforms/vector-effect in card glyph paths.

## Rejected Patch To Avoid

A patch was briefly applied and then reverted. It did this in `src/styles.css`:

- Safari-only disabled transitions on item and collection card controls.
- Safari-only removed motion from frame tags.
- Safari-only removed motion from item label/title date swaps.
- Safari-only used `visibility` or `display` behavior to avoid animating tag pills.

The user rejected this because it removed the intended animations. Do not reapply that strategy.

## Files To Inspect First

- `src/styles.css`
- `src/components/items/ItemCard.tsx`
- `src/components/items/CollectionCard.tsx`
- `src/components/items/CardActions.tsx`
- `src/components/items/MasonryGrid.tsx`
- `src/components/items/MasonryView.tsx`
- `src/components/items/useGridFlip.ts`
- `src/components/debug/SafariRasterOverlay.tsx`
- `scripts/safari-card-interaction-probe.mjs`
- `scripts/safari-rendering-probe.mjs`
- `scripts/safari-pixel-stability-probe.mjs`

## Current Relevant CSS Areas

In `src/styles.css`, inspect:

- `.item-card__frame-tags`
- `.item-card__frame-tag`
- `.item-card__actions`
- `.item-card__select`
- `.item-card__action-cell`
- `.item-card__more-control`
- `.item-card__label-text`
- `.item-card__label-time`
- `.collection-card__frame-tags`
- `.collection-card__frame-tag`
- `.collection-card__actions`
- `.collection-card__title-text`
- `.collection-card__title-time`
- Safari-specific section near the `:root[data-browser-safari]` rules.

## Known Probe Evidence

The Safari interaction probe has been useful but insufficient:

```bash
VITA_SAFARI_INTERACTION_OUT='screenshots/current/card-hover-stability-after-stable-tag-geometry' node scripts/safari-card-interaction-probe.mjs
```

It reported card/media rect deltas of zero across hover, selected, selected-hover, menu-open, and collection-hover states. However, that does not prove real Safari pinch/page zoom is stable.

The probe also showed expected fractional text widths on tag/title text, for example frame tag widths like `57.5px` or `42.781px`. Fractional font metrics alone are not necessarily a bug. The bug is when Safari re-rasterizes them visibly during hover/zoom.

## Recording

The user supplied:

`/Users/vito/Desktop/Screen Recording 2026-05-13 at 12.56.24 PM.mov`

Programmatic frame extraction may fail depending on local codecs. If needed, use QuickTime manually or Safari/Web Inspector directly instead of relying only on automated frame extraction.

## Best Next Diagnostic Step

Use real Safari Web Inspector or Safari Develop tooling, not only SafariDriver.

Suggested manual path:

1. Open `http://127.0.0.1:5173/?mode=items&view=masonry` in Safari.
2. Enable Safari Develop tools.
3. Use Web Inspector layer/compositing/repaint visualization if available.
4. Hover a card and watch which exact layers repaint or pulse.
5. Repeat on a collection page.
6. Repeat with page zoom and/or trackpad pinch zoom.
7. Capture the element/class causing repaint before patching.

The target is to identify a specific layer such as:

- card media clip
- hover action island
- tag pill text
- SVG icon
- menu popover
- collection card title swap
- card cover image

## Preferred Fix Direction

Do not remove animations broadly. Instead:

1. Keep the visible hover animation, but move it to the safest layer.
2. Avoid transforming rounded clipping layers or media children.
3. Avoid animating inner SVGs.
4. Prefer animating an outer non-clipped wrapper if movement is necessary.
5. Keep Safari motion to opacity plus integer `translateY` or `translateX`.
6. If a text pill is the culprit, consider keeping its motion but snapping the wrapper position or giving it a stable layout box before hover.
7. If SVG shimmer is the culprit, keep button animation on wrapper only and keep SVG static.
8. If media clip is the culprit, make the clipping layer static and isolated:

```css
.item-card__media,
.collection-card__cover {
  position: relative;
  z-index: 0;
  isolation: isolate;
}
```

Only keep this if Safari visual evidence proves it helps.

## Acceptance Criteria

- Item and collection card hover animations still feel alive.
- Density/layout animation is not removed or degraded.
- Card controls do not shift between idle, hover, selected, and menu-open states.
- No native video controls appear in grid cards.
- Real Safari manual check passes for:
  - image-card hover
  - video-card hover
  - collection-card hover
  - menu-open state
  - density change
  - viewport resize
  - page zoom / pinch zoom
- `npm run typecheck` passes.
- `npm run build` passes.
- `git diff --check` passes.

## Useful Commands

Start live app:

```bash
npm run pb:serve
npm run dev:live -- --host 127.0.0.1 --port 5173 --strictPort
```

Run checks:

```bash
npm run typecheck
npm run build
git diff --check
```

Run Safari probes:

```bash
node scripts/safari-rendering-probe.mjs
node scripts/safari-card-interaction-probe.mjs
node scripts/safari-pixel-stability-probe.mjs
```

## Handoff Prompt For New Session

Work only on the remaining Safari card/collection raster instability. Do not remove animations. Do not broadly suppress transitions. Inspect the real Safari layer/repaint behavior first, identify the exact repainting element, then apply the smallest Safari-specific CSS fix that preserves item-card and collection-card hover motion. Validate with real Safari hover and page/pinch zoom, plus `npm run typecheck`, `npm run build`, and `git diff --check`.
