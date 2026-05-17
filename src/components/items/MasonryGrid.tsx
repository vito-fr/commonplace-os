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
import { animateGridFlipFromRects, captureGridFlipRects, type GridFlipSnapshot } from "./useGridFlip";
import { useGridIntroMotion } from "./useGridIntroMotion";

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
  mediaFetchPriority: "high" | "low" | "auto";
  mediaLoading: "eager" | "lazy";
  object: ArchiveObject;
  renderSignature: string;
};

const loadingPlaceholders = Array.from({ length: 6 }, (_, index) => `loading-${index}`);
const gridInitialEntryDurationMs = 980;
const galleryResizeSettleMs = 160;
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
  const [entryState, setEntryState] = useState<"initial" | "settled">("initial");
  const [settledIntroKeys, setSettledIntroKeys] = useState<Set<string>>(() => new Set());
  const committedColumns = useSettledGalleryLayout(gridRef, columns);
  const entryCardLimit = Math.max(minGridEntryCards, committedColumns * 3);
  const gridStyle: GalleryGridStyle = {
    "--gallery-columns": committedColumns,
  };
  const introMotionSignature = useMemo(
    () =>
      [
        entryState,
        hasLeadingTile ? "leading" : "none",
        objects.slice(0, minGridEntryCards).map(getArchiveObjectKey).join("|"),
      ].join(":"),
    [entryState, hasLeadingTile, objects],
  );

  useGridIntroMotion(gridRef, {
    enabled: !loading && entryState === "initial",
    selector: '.masonry-grid__motion[data-entry-card="intro"][data-intro-state="active"]',
    signature: introMotionSignature,
    y: 10,
  });

  const settleIntroCard = useCallback((event: AnimationEvent<HTMLElement>) => {
    if (!gridIntroAnimationNames.has(event.animationName)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("masonry-grid__motion")) {
      return;
    }

    const item = target.closest<HTMLElement>(".masonry-grid__item[data-archive-key]");
    const objectKey = item?.dataset.archiveKey;
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
          style={{ "--archive-card-index": 0 } as CardEnterStyle}
        >
          <div
            className="masonry-grid__motion"
            data-entry-card="intro"
            data-intro-state={entryState === "initial" && !settledIntroKeys.has("collection:leading") ? "active" : "settled"}
          >
            {leadingTile}
          </div>
        </div>
      ) : null}
      {objects.map((object, index) => {
        const objectKey = getArchiveObjectKey(object);
        const entryIndex = leadingTile ? index + 1 : index;
        const mediaFetchPriority = "auto";
        const mediaLoading = index < Math.max(2, committedColumns) ? "eager" : "lazy";
        const isIntroEntry = entryIndex < entryCardLimit;
        const introState =
          isIntroEntry && entryState === "initial" && !settledIntroKeys.has(objectKey) ? "active" : "settled";

        return (
          <div
            className="masonry-grid__item"
            data-archive-key={objectKey}
            key={objectKey}
            style={{ "--archive-card-index": entryIndex } as CardEnterStyle}
          >
            <div
              className="masonry-grid__motion"
              data-entry-card={isIntroEntry ? "intro" : undefined}
              data-intro-state={isIntroEntry ? introState : undefined}
            >
              <GridObjectContent
                mediaFetchPriority={mediaFetchPriority}
                mediaLoading={mediaLoading}
                object={object}
                renderSignature={getArchiveObjectRenderSignature(object)}
              />
            </div>
          </div>
        );
      })}
      {objects.length === 0 && emptyState ? <div className="masonry-grid__empty masonry-grid__empty--inline">{emptyState}</div> : null}
    </section>
  );
}

const GridObjectContent = memo(function GridObjectContent({
  mediaFetchPriority,
  mediaLoading,
  object,
  renderSignature: _renderSignature,
}: GridObjectContentProps) {
  if (object.objectType === "item") {
    return <ItemCard {...object.item} mediaFetchPriority={mediaFetchPriority} mediaLoading={mediaLoading} />;
  }

  if (object.objectType === "collection") {
    return <CollectionCard collection={object.collection} mediaFetchPriority={mediaFetchPriority} mediaLoading={mediaLoading} />;
  }

  return <NewCollectionCard disabled={object.disabled} onCreate={object.onCreateCollection} />;
}, areGridObjectContentPropsEqual);

function areGridObjectContentPropsEqual(previousProps: GridObjectContentProps, nextProps: GridObjectContentProps) {
  return (
    previousProps.mediaFetchPriority === nextProps.mediaFetchPriority &&
    previousProps.mediaLoading === nextProps.mediaLoading &&
    previousProps.renderSignature === nextProps.renderSignature
  );
}

function useSettledGalleryLayout(
  containerRef: RefObject<HTMLElement | null>,
  requestedColumns: number,
) {
  const [committedColumns, setCommittedColumns] = useState(requestedColumns);
  const [layoutToken, setLayoutToken] = useState(0);
  const committedColumnsRef = useRef(requestedColumns);
  const pendingFlipRectsRef = useRef<GridFlipSnapshot | null>(null);
  const trackWidthRef = useRef(0);

  useLayoutEffect(() => {
    committedColumnsRef.current = committedColumns;
  }, [committedColumns]);

  const commitGalleryLayout = useCallback((nextColumns: number) => {
    const container = containerRef.current;
    if (!container) {
      setCommittedColumns(nextColumns);
      return;
    }

    const nextTrackWidth = measureGalleryTrackWidth(container, nextColumns);
    const columnsChanged = committedColumnsRef.current !== nextColumns;
    const widthChanged = Math.abs(trackWidthRef.current - nextTrackWidth) > 0.1;

    if (trackWidthRef.current <= 0 && !columnsChanged) {
      trackWidthRef.current = nextTrackWidth;
      container.style.setProperty("--gallery-column-width", `${formatGridTrackWidth(nextTrackWidth)}px`);
      return;
    }

    if (!columnsChanged && !widthChanged) {
      return;
    }

    pendingFlipRectsRef.current = captureGridFlipRects(container);
    trackWidthRef.current = nextTrackWidth;
    committedColumnsRef.current = nextColumns;
    setCommittedColumns(nextColumns);
    setLayoutToken((currentToken) => currentToken + 1);
  }, [containerRef]);

  useLayoutEffect(() => {
    commitGalleryLayout(requestedColumns);
  }, [commitGalleryLayout, requestedColumns]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const nextTrackWidth = trackWidthRef.current || measureGalleryTrackWidth(container, committedColumns);
    trackWidthRef.current = nextTrackWidth;
    container.style.setProperty("--gallery-column-width", `${formatGridTrackWidth(nextTrackWidth)}px`);

    const previousRects = pendingFlipRectsRef.current;
    pendingFlipRectsRef.current = null;
    if (!previousRects) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      animateGridFlipFromRects(container, previousRects, {
        maxResizeItems: 90,
        motionChildSelector: ".masonry-grid__motion",
        reason: "resize",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [committedColumns, containerRef, layoutToken]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let settleTimeout = 0;
    const commitSettledWidth = () => {
      settleTimeout = 0;
      commitGalleryLayout(committedColumnsRef.current);
    };
    const scheduleSettledCommit = () => {
      if (settleTimeout) {
        window.clearTimeout(settleTimeout);
      }
      settleTimeout = window.setTimeout(commitSettledWidth, galleryResizeSettleMs);
    };

    trackWidthRef.current = measureGalleryTrackWidth(container, committedColumnsRef.current);
    container.style.setProperty("--gallery-column-width", `${formatGridTrackWidth(trackWidthRef.current)}px`);

    const observer = new ResizeObserver(scheduleSettledCommit);
    observer.observe(container);
    window.addEventListener("resize", scheduleSettledCommit);
    window.visualViewport?.addEventListener("resize", scheduleSettledCommit);

    return () => {
      if (settleTimeout) {
        window.clearTimeout(settleTimeout);
      }
      observer.disconnect();
      window.removeEventListener("resize", scheduleSettledCommit);
      window.visualViewport?.removeEventListener("resize", scheduleSettledCommit);
    };
  }, [commitGalleryLayout, containerRef]);

  return committedColumns;
}

function measureGalleryTrackWidth(container: HTMLElement, columns: number) {
  const styles = window.getComputedStyle(container);
  const gap = parseFloat(styles.columnGap || styles.gap) || 0;
  const containerWidth = container.getBoundingClientRect().width;
  const safeColumns = Math.max(1, columns);
  return Math.max(1, (containerWidth - gap * (safeColumns - 1)) / safeColumns);
}

function formatGridTrackWidth(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
