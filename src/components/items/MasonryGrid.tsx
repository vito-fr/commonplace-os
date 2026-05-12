import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ArchiveObject } from "./ArchiveObject";
import { CollectionCard, NewCollectionCard } from "./CollectionCard";
import { ItemCard } from "./ItemCard";
import { getArchiveObjectKey, getArchiveObjectRenderSignature } from "./archiveObjectIdentity";
import { useGridFlipAnimation } from "./useGridFlip";

export type MasonryDensity = "comfortable" | "dense" | "editorial";

export interface MasonryGridProps {
  objects: ArchiveObject[];
  density: MasonryDensity;
  emptyState?: ReactNode;
  loading?: boolean;
  columns?: number;
  className?: string;
  ariaLabel?: string;
  leadingTile?: ReactNode;
}

type GalleryGridStyle = CSSProperties & {
  "--gallery-columns": number;
};

type CardEnterStyle = CSSProperties & {
  "--archive-card-index": number;
};

type GridObjectContentProps = {
  mediaLoading: "eager" | "lazy";
  object: ArchiveObject;
  renderSignature: string;
};

const loadingPlaceholders = Array.from({ length: 6 }, (_, index) => `loading-${index}`);
const gridInitialEntryDurationMs = 900;
const minGridEntryCards = 12;

export function MasonryGrid({
  objects,
  density,
  emptyState = null,
  loading = false,
  columns = 4,
  className = "",
  ariaLabel = "items grid",
  leadingTile = null,
}: MasonryGridProps) {
  const gridClassName = ["masonry-grid", `masonry-grid--${density}`, className]
    .filter(Boolean)
    .join(" ");
  const gridStyle: GalleryGridStyle = { "--gallery-columns": columns };
  const gridRef = useRef<HTMLElement | null>(null);
  const hasLeadingTile = Boolean(leadingTile);
  const entryCardLimit = Math.max(minGridEntryCards, columns * 3);
  const [entryState, setEntryState] = useState<"initial" | "settled">("initial");
  const layoutSignature = useMemo(
    () => [columns, density, hasLeadingTile ? "leading" : "none", objects.map(getArchiveObjectKey).join("|")].join("::"),
    [columns, density, hasLeadingTile, objects],
  );

  useGridFlipAnimation(gridRef, layoutSignature);

  useEffect(() => {
    const hasRenderableContent = objects.length > 0 || hasLeadingTile;
    if (loading || !hasRenderableContent || entryState === "settled") {
      return;
    }

    const timeout = window.setTimeout(() => setEntryState("settled"), gridInitialEntryDurationMs);
    return () => window.clearTimeout(timeout);
  }, [entryState, loading, objects.length, hasLeadingTile]);

  if (loading) {
    return (
      <section ref={gridRef} className={gridClassName} style={gridStyle} aria-label={ariaLabel} aria-busy="true">
        {loadingPlaceholders.map((id) => (
          <div className="masonry-grid__item" key={id}>
            <div className="masonry-grid__placeholder" />
          </div>
        ))}
      </section>
    );
  }

  if (objects.length === 0 && !leadingTile) {
    return emptyState ? (
      <section className="masonry-grid__empty" aria-label={ariaLabel}>
        {emptyState}
      </section>
    ) : null;
  }

  return (
    <section ref={gridRef} className={gridClassName} data-entry-state={entryState} style={gridStyle} aria-label={ariaLabel}>
      {leadingTile ? (
        <div
          className="masonry-grid__item masonry-grid__item--leading"
          data-archive-key="collection:leading"
          data-entry-card="intro"
          style={{ "--archive-card-index": 0 } as CardEnterStyle}
        >
          {leadingTile}
        </div>
      ) : null}
      {objects.map((object, index) => {
        const objectKey = getArchiveObjectKey(object);
        const entryIndex = leadingTile ? index + 1 : index;
        const isIntroEntry = entryIndex < entryCardLimit;

        return (
          <div
            className="masonry-grid__item"
            data-archive-key={objectKey}
            data-entry-card={isIntroEntry ? "intro" : undefined}
            key={objectKey}
            style={{ "--archive-card-index": entryIndex } as CardEnterStyle}
          >
            <GridObjectContent
              mediaLoading={index < Math.max(8, columns) ? "eager" : "lazy"}
              object={object}
              renderSignature={getArchiveObjectRenderSignature(object)}
            />
          </div>
        );
      })}
      {objects.length === 0 && emptyState ? <div className="masonry-grid__empty masonry-grid__empty--inline">{emptyState}</div> : null}
    </section>
  );
}

const GridObjectContent = memo(function GridObjectContent({
  mediaLoading,
  object,
  renderSignature: _renderSignature,
}: GridObjectContentProps) {
  if (object.objectType === "item") {
    return <ItemCard {...object.item} mediaLoading={mediaLoading} />;
  }

  if (object.objectType === "collection") {
    return <CollectionCard collection={object.collection} mediaLoading={mediaLoading} />;
  }

  return <NewCollectionCard disabled={object.disabled} onCreate={object.onCreateCollection} />;
}, areGridObjectContentPropsEqual);

function areGridObjectContentPropsEqual(previousProps: GridObjectContentProps, nextProps: GridObjectContentProps) {
  return previousProps.mediaLoading === nextProps.mediaLoading && previousProps.renderSignature === nextProps.renderSignature;
}
