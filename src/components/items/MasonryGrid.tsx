import type { CSSProperties, ReactNode } from "react";
import { ItemCard, type ItemCardProps } from "./ItemCard";

export type MasonryDensity = "comfortable" | "dense" | "editorial";

export interface MasonryGridProps {
  items: ItemCardProps[];
  density: MasonryDensity;
  emptyState?: ReactNode;
  loading?: boolean;
  columns?: number;
  className?: string;
  ariaLabel?: string;
}

type GalleryGridStyle = CSSProperties & {
  "--gallery-columns": number;
};

const loadingPlaceholders = Array.from({ length: 6 }, (_, index) => `loading-${index}`);

export function MasonryGrid({
  items,
  density,
  emptyState = null,
  loading = false,
  columns = 4,
  className = "",
  ariaLabel = "items grid",
}: MasonryGridProps) {
  const gridClassName = ["masonry-grid", `masonry-grid--${density}`, className]
    .filter(Boolean)
    .join(" ");
  const gridStyle: GalleryGridStyle = { "--gallery-columns": columns };

  if (loading) {
    return (
      <section className={gridClassName} style={gridStyle} aria-label={ariaLabel} aria-busy="true">
        {loadingPlaceholders.map((id) => (
          <div className="masonry-grid__item" key={id}>
            <div className="masonry-grid__placeholder" />
          </div>
        ))}
      </section>
    );
  }

  if (items.length === 0) {
    return emptyState ? (
      <section className="masonry-grid__empty" aria-label={ariaLabel}>
        {emptyState}
      </section>
    ) : null;
  }

  return (
    <section className={gridClassName} style={gridStyle} aria-label={ariaLabel}>
      {items.map((item) => (
        <div className="masonry-grid__item" key={item.id}>
          <ItemCard {...item} />
        </div>
      ))}
    </section>
  );
}
