import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
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
  "--gallery-column-width"?: string;
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
const gridInitialEntryDurationMs = 980;
const minGridEntryCards = 12;
const gridIntroAnimationNames = new Set([
  "archive-card-enter",
  "archive-card-enter-no-scale",
  "archive-card-enter-opacity",
]);

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
  const gridRef = useRef<HTMLElement | null>(null);
  const hasLeadingTile = Boolean(leadingTile);
  const entryCardLimit = Math.max(minGridEntryCards, columns * 3);
  const [entryState, setEntryState] = useState<"initial" | "settled">("initial");
  const [settledIntroKeys, setSettledIntroKeys] = useState<Set<string>>(() => new Set());
  const layoutSignature = useMemo(
    () => [columns, density, hasLeadingTile ? "leading" : "none", objects.map(getArchiveObjectKey).join("|")].join("::"),
    [columns, density, hasLeadingTile, objects],
  );
  const roundedTrackWidth = useRoundedGalleryTrackWidth(gridRef, columns, layoutSignature);
  const gridStyle: GalleryGridStyle = {
    "--gallery-columns": columns,
    ...(roundedTrackWidth ? { "--gallery-column-width": `${roundedTrackWidth}px` } : {}),
  };

  useGridFlipAnimation(gridRef, layoutSignature);

  const settleIntroCard = useCallback((event: AnimationEvent<HTMLElement>) => {
    if (!gridIntroAnimationNames.has(event.animationName)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("masonry-grid__item")) {
      return;
    }

    const objectKey = target.dataset.archiveKey;
    if (!objectKey) {
      return;
    }

    setSettledIntroKeys((currentKeys) => {
      if (currentKeys.has(objectKey)) {
        return currentKeys;
      }

      const nextKeys = new Set(currentKeys);
      nextKeys.add(objectKey);
      return nextKeys;
    });
  }, []);

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
    <section
      ref={gridRef}
      className={gridClassName}
      data-entry-state={entryState}
      onAnimationEnd={settleIntroCard}
      style={gridStyle}
      aria-label={ariaLabel}
    >
      {leadingTile ? (
        <div
          className="masonry-grid__item masonry-grid__item--leading"
          data-archive-key="collection:leading"
          data-entry-card="intro"
          data-intro-state={entryState === "initial" && !settledIntroKeys.has("collection:leading") ? "active" : "settled"}
          style={{ "--archive-card-index": 0 } as CardEnterStyle}
        >
          {leadingTile}
        </div>
      ) : null}
      {objects.map((object, index) => {
        const objectKey = getArchiveObjectKey(object);
        const entryIndex = leadingTile ? index + 1 : index;
        const isIntroEntry = entryIndex < entryCardLimit;
        const introState =
          isIntroEntry && entryState === "initial" && !settledIntroKeys.has(objectKey) ? "active" : "settled";

        return (
          <div
            className="masonry-grid__item"
            data-archive-key={objectKey}
            data-entry-card={isIntroEntry ? "intro" : undefined}
            data-intro-state={isIntroEntry ? introState : undefined}
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

function useRoundedGalleryTrackWidth(containerRef: RefObject<HTMLElement | null>, columns: number, measureKey: string) {
  const [trackWidth, setTrackWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let frame = 0;
    const measureTrackWidth = () => {
      frame = 0;
      const styles = window.getComputedStyle(container);
      const gap = parseFloat(styles.columnGap || styles.gap) || 0;
      const containerWidth = container.getBoundingClientRect().width;
      const safeColumns = Math.max(1, columns);
      const nextTrackWidth = Math.max(1, Math.floor((containerWidth - gap * (safeColumns - 1)) / safeColumns));

      setTrackWidth((currentTrackWidth) => (currentTrackWidth === nextTrackWidth ? currentTrackWidth : nextTrackWidth));
    };
    const scheduleTrackWidth = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(measureTrackWidth);
    };

    measureTrackWidth();

    const observer = new ResizeObserver(scheduleTrackWidth);
    observer.observe(container);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  }, [columns, containerRef, measureKey]);

  return trackWidth;
}
