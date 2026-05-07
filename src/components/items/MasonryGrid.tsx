import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import type { ArchiveObject } from "./ArchiveObject";
import { CollectionCard, NewCollectionCard } from "./CollectionCard";
import { ItemCard } from "./ItemCard";
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

const loadingPlaceholders = Array.from({ length: 6 }, (_, index) => `loading-${index}`);

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
  const layoutSignature = useMemo(
    () => [columns, density, hasLeadingTile ? "leading" : "none", objects.map(getArchiveObjectKey).join("|")].join("::"),
    [columns, density, hasLeadingTile, objects],
  );

  useGridFlipAnimation(gridRef, layoutSignature);

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
    <section ref={gridRef} className={gridClassName} style={gridStyle} aria-label={ariaLabel}>
      {leadingTile ? (
        <div
          className="masonry-grid__item masonry-grid__item--leading"
          data-archive-key="collection:leading"
          style={{ "--archive-card-index": 0 } as CardEnterStyle}
        >
          {leadingTile}
        </div>
      ) : null}
      {objects.map((object, index) => (
        <div
          className="masonry-grid__item"
          data-archive-key={getArchiveObjectKey(object)}
          key={getArchiveObjectKey(object)}
          style={{ "--archive-card-index": leadingTile ? index + 1 : index } as CardEnterStyle}
        >
          {object.objectType === "item" ? (
            <ItemCard {...object.item} />
          ) : object.objectType === "collection" ? (
            <CollectionCard collection={object.collection} />
          ) : (
            <NewCollectionCard disabled={object.disabled} onCreate={object.onCreateCollection} />
          )}
        </div>
      ))}
      {objects.length === 0 && emptyState ? <div className="masonry-grid__empty masonry-grid__empty--inline">{emptyState}</div> : null}
    </section>
  );
}

function getArchiveObjectKey(object: ArchiveObject) {
  if (object.objectType === "item") {
    return `item:${object.item.id}`;
  }

  if (object.objectType === "collection") {
    return `collection:${object.collection.id}`;
  }

  return "collection:create";
}
