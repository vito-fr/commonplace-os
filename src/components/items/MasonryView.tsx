import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { ArchiveObject } from "./ArchiveObject";
import { CollectionCard, NewCollectionCard } from "./CollectionCard";
import type { CollectionCardModel } from "./CollectionCard";
import { ItemCard, type ItemCardProps } from "./ItemCard";
import { getArchiveObjectKey, getArchiveObjectRenderSignature } from "./archiveObjectIdentity";
import { useGridFlipAnimation } from "./useGridFlip";

export type MasonryViewProps = {
  objects: ArchiveObject[];
  columns?: number;
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
  ariaLabel?: string;
};

type MasonryViewStyle = CSSProperties & {
  "--masonry-columns": number;
  height?: number;
};

type MasonryItemStyle = CSSProperties & {
  "--archive-card-index": number;
  "--masonry-media-height": string;
  height: number;
  left: number;
  top: number;
  width: number;
};

type MasonryObjectContentProps = {
  mediaLoading: "eager" | "lazy";
  measuredAspectRatio: number | null;
  object: ArchiveObject;
  onMediaAspectRatio: (id: string, aspectRatio: number, sourceUrl: string | null) => void;
  renderSignature: string;
};

const loadingPlaceholders = Array.from({ length: 10 }, (_, index) => `masonry-loading-${index}`);
const masonryGap = 12;
const masonryMediaRatioStorageKey = "vita:masonry-media-ratios:v1";
const masonryMediaRatioCacheLimit = 500;
const masonryIntroAnimationNames = new Set([
  "masonry-view-card-enter",
  "masonry-view-card-enter-no-scale",
]);

export function MasonryView({
  ariaLabel = "masonry archive objects",
  className = "",
  columns: controlledColumns,
  emptyState = null,
  loading = false,
  objects,
}: MasonryViewProps) {
  const responsiveColumns = useResponsiveMasonryColumns({
    includeDefaultCount: controlledColumns == null,
  });
  const requestedColumnCount = controlledColumns ?? responsiveColumns.columnCount;
  const columnCount = Math.max(1, Math.min(requestedColumnCount, responsiveColumns.columnCap));
  const viewRef = useRef<HTMLElement | null>(null);
  const {
    containerWidth: measuredContainerWidth,
    introViewportBottom,
    isResizing,
  } = useMasonryContainerWidth(viewRef);
  const cachedMediaRatios = useMemo(() => readCachedMasonryMediaRatios(objects), [objects]);
  const runtimeMediaRatios = cachedMediaRatios;
  const layoutSignature = useMemo(
    () => objects.map((object) => getArchiveObjectLayoutSignature(object, runtimeMediaRatios)).join("|"),
    [objects, runtimeMediaRatios],
  );
  const layout = useMemo(
    () => buildMasonryLayout(objects, columnCount, measuredContainerWidth, runtimeMediaRatios),
    [objects, columnCount, measuredContainerWidth, layoutSignature, runtimeMediaRatios],
  );
  const viewClassName = ["masonry-view", className].filter(Boolean).join(" ");
  const viewStyle: MasonryViewStyle = {
    "--masonry-columns": columnCount,
    height: roundLayoutPixel(layout.containerHeight),
  };
  const introOrderByKey = useMemo(
    () => buildInitialIntroOrder(layout.items, introViewportBottom),
    [introViewportBottom, layout.items],
  );
  const flipSignature = useMemo(
    () =>
      layout.items
        .map(({ height, objectKey, width, x, y }) =>
          `${objectKey}:${roundLayoutPixel(x)}:${roundLayoutPixel(y)}:${roundLayoutPixel(width)}:${roundLayoutPixel(height)}`,
        )
        .join("|"),
    [layout.items],
  );
  useGridFlipAnimation(viewRef, flipSignature, { disabled: isResizing });

  const handleMediaAspectRatio = useCallback((id: string, aspectRatio: number, sourceUrl: string | null) => {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      return;
    }

    const safeAspectRatio = roundRatio(aspectRatio);
    writeCachedMasonryMediaRatio(id, safeAspectRatio, sourceUrl);
  }, []);
  const settleIntroMotion = useCallback((event: AnimationEvent<HTMLElement>) => {
    if (!masonryIntroAnimationNames.has(event.animationName)) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("masonry-view__motion")) {
      return;
    }

    target.dataset.introState = "settled";
  }, []);

  if (loading) {
    return (
      <section
        ref={viewRef}
        className={`${viewClassName} masonry-view--loading`}
        style={{ "--masonry-columns": columnCount } as MasonryViewStyle}
        aria-label={ariaLabel}
        aria-busy="true"
      >
        {buildPlaceholderColumns(columnCount).map((column, columnIndex) => (
          <div className="masonry-view__column" key={`placeholder-column-${columnIndex}`}>
            {column.map((id, itemIndex) => (
              <div className="masonry-view__placeholder" data-size={(itemIndex + columnIndex) % 3} key={id} />
            ))}
          </div>
        ))}
      </section>
    );
  }

  if (objects.length === 0) {
    return emptyState ? (
      <section className="masonry-view__empty" aria-label={ariaLabel}>
        {emptyState}
      </section>
    ) : null;
  }

  return (
    <section
      ref={viewRef}
      className={viewClassName}
      data-resizing={isResizing ? "true" : undefined}
      onAnimationEnd={settleIntroMotion}
      style={viewStyle}
      aria-label={ariaLabel}
    >
      {layout.items.map(({ enterIndex, height, mediaHeight, object, objectKey, renderSignature, width, x, y }) => {
        const mediaLoading = enterIndex < Math.max(8, columnCount) ? "eager" : "lazy";
        const introIndex = introOrderByKey.get(objectKey);
        const isIntroEntry = introIndex != null;
        const measuredAspectRatio =
          object.objectType === "item" ? runtimeMediaRatios[object.item.id] ?? null : null;
        const itemStyle: MasonryItemStyle = {
          "--archive-card-index": introIndex ?? enterIndex,
          "--masonry-media-height": `${roundLayoutPixel(mediaHeight)}px`,
          height: roundLayoutPixel(height),
          left: roundLayoutPixel(x),
          top: roundLayoutPixel(y),
          width: roundLayoutPixel(width),
        };

        return (
          <div
            className="masonry-view__item"
            data-archive-key={objectKey}
            data-entry-card={isIntroEntry ? "intro" : undefined}
            key={objectKey}
            style={itemStyle}
          >
            <div
              className="masonry-view__motion"
              data-entry-card={isIntroEntry ? "intro" : undefined}
              data-intro-state={isIntroEntry ? "active" : undefined}
            >
              <MasonryObjectContent
                mediaLoading={mediaLoading}
                measuredAspectRatio={measuredAspectRatio}
                object={object}
                onMediaAspectRatio={handleMediaAspectRatio}
                renderSignature={renderSignature}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

const MasonryObjectContent = memo(function MasonryObjectContent({
  mediaLoading,
  measuredAspectRatio,
  object,
  onMediaAspectRatio,
  renderSignature: _renderSignature,
}: MasonryObjectContentProps) {
  if (object.objectType === "item") {
    return (
      <ItemCard
        {...object.item}
        measuredAspectRatio={measuredAspectRatio}
        mediaLoading={mediaLoading}
        onMediaAspectRatio={onMediaAspectRatio}
        variant="masonry"
      />
    );
  }

  if (object.objectType === "collection") {
    return <CollectionCard collection={object.collection} mediaLoading={mediaLoading} />;
  }

  return <NewCollectionCard disabled={object.disabled} onCreate={object.onCreateCollection} />;
}, areMasonryObjectContentPropsEqual);

function areMasonryObjectContentPropsEqual(
  previousProps: MasonryObjectContentProps,
  nextProps: MasonryObjectContentProps,
) {
  return (
    previousProps.mediaLoading === nextProps.mediaLoading &&
    previousProps.measuredAspectRatio === nextProps.measuredAspectRatio &&
    previousProps.renderSignature === nextProps.renderSignature
  );
}

type MasonryLayout = ReturnType<typeof buildMasonryLayout>;

function buildInitialIntroOrder(items: MasonryLayout["items"], introViewportBottom: number) {
  const introOrder = new Map<string, number>();
  items
    .filter((item) => item.y < introViewportBottom && item.y + item.height > -80)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.enterIndex - b.enterIndex)
    .forEach((item, index) => {
      introOrder.set(item.objectKey, index);
    });

  return introOrder;
}

function useMasonryContainerWidth(ref: RefObject<HTMLElement | null>) {
  const [containerState, setContainerState] = useState(() => ({
    containerWidth: getInitialMasonryContainerWidth(),
    introViewportBottom: getInitialMasonryIntroViewportBottom(),
    isResizing: false,
  }));

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let frame = 0;
    let settleTimeout = 0;
    let lastObservedWidth = Math.max(1, Math.round(element.getBoundingClientRect().width));
    const setResizeSettled = () => {
      settleTimeout = 0;
      setContainerState((currentState) =>
        currentState.isResizing ? { ...currentState, isResizing: false } : currentState,
      );
    };
    const updateWidth = (width: number, isResizing: boolean) => {
      const roundedWidth = Math.max(1, Math.round(width));
      lastObservedWidth = roundedWidth;
      const nextIntroViewportBottom = getMasonryIntroViewportBottom(element);
      setContainerState((currentState) =>
        currentState.containerWidth === roundedWidth &&
        currentState.introViewportBottom === nextIntroViewportBottom &&
        currentState.isResizing === isResizing
          ? currentState
          : {
              containerWidth: roundedWidth,
              introViewportBottom: nextIntroViewportBottom,
              isResizing,
            },
      );

      if (isResizing) {
        if (settleTimeout) {
          window.clearTimeout(settleTimeout);
        }
        settleTimeout = window.setTimeout(setResizeSettled, 180);
      }
    };
    const scheduleWidthUpdate = (width: number) => {
      const roundedWidth = Math.max(1, Math.round(width));
      const isWidthResize = Math.abs(roundedWidth - lastObservedWidth) > 1;

      if (!isWidthResize) {
        updateWidth(width, false);
        return;
      }

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateWidth(width, true);
      });
    };

    updateWidth(element.getBoundingClientRect().width, false);

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? element.getBoundingClientRect().width;
      scheduleWidthUpdate(nextWidth);
    });
    observer.observe(element);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      if (settleTimeout) {
        window.clearTimeout(settleTimeout);
      }
      observer.disconnect();
    };
  }, [ref]);

  return containerState;
}

function useResponsiveMasonryColumns({ includeDefaultCount }: { includeDefaultCount: boolean }) {
  const [responsiveColumns, setResponsiveColumns] = useState(() =>
    getResponsiveMasonryColumns(includeDefaultCount),
  );

  useEffect(() => {
    let frame = 0;
    const updateColumns = () => {
      frame = 0;
      const nextColumns = getResponsiveMasonryColumns(includeDefaultCount);
      setResponsiveColumns((currentColumns) =>
        currentColumns.columnCount === nextColumns.columnCount &&
        currentColumns.columnCap === nextColumns.columnCap
          ? currentColumns
          : nextColumns,
      );
    };
    const scheduleUpdate = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(updateColumns);
    };

    updateColumns();
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [includeDefaultCount]);

  return responsiveColumns;
}

function getResponsiveMasonryColumns(includeDefaultCount: boolean) {
  return {
    columnCap: getResponsiveMasonryColumnCap(),
    columnCount: includeDefaultCount ? getResponsiveMasonryColumnCount() : 1,
  };
}

function getResponsiveMasonryColumnCount() {
  if (typeof window === "undefined") {
    return 4;
  }

  const width = window.innerWidth;
  if (width >= 1440) {
    return 5;
  }
  if (width >= 980) {
    return 4;
  }
  if (width >= 680) {
    return 3;
  }
  return 2;
}

function getResponsiveMasonryColumnCap() {
  if (typeof window === "undefined") {
    return 8;
  }

  const width = window.innerWidth;
  if (width >= 1440) {
    return 8;
  }
  if (width >= 1180) {
    return 7;
  }
  if (width >= 980) {
    return 6;
  }
  if (width >= 680) {
    return 4;
  }
  return 2;
}

function buildMasonryLayout(
  objects: ArchiveObject[],
  columnCount: number,
  containerWidth: number,
  mediaRatios: Record<string, number>,
) {
  const safeColumnCount = Math.max(1, columnCount);
  const safeContainerWidth = Math.max(1, containerWidth);
  const columnWidth = roundLayoutPixel(
    Math.max(1, (safeContainerWidth - masonryGap * (safeColumnCount - 1)) / safeColumnCount),
  );
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0);
  const items = objects.map((object, enterIndex) => {
    const columnIndex = getShortestColumnIndex(columnHeights);
    const x = roundLayoutPixel(columnIndex * (columnWidth + masonryGap));
    const y = roundLayoutPixel(columnHeights[columnIndex]);
    const objectKey = getArchiveObjectKey(object);
    const metrics = estimateObjectLayoutMetrics(object, columnWidth, mediaRatios);
    const estimatedHeight = roundLayoutPixel(metrics.height);

    columnHeights[columnIndex] = roundLayoutPixel(y + estimatedHeight + masonryGap);

    return {
      enterIndex,
      height: estimatedHeight,
      mediaHeight: roundLayoutPixel(metrics.mediaHeight),
      object,
      objectKey,
      renderSignature: getArchiveObjectRenderSignature(object),
      width: columnWidth,
      x,
      y,
    };
  });
  const containerHeight = roundLayoutPixel(Math.max(0, ...columnHeights.map((height) => height - masonryGap)));

  return { containerHeight, items };
}

function getShortestColumnIndex(columnHeights: number[]) {
  let shortestIndex = 0;
  let shortestHeight = columnHeights[0] ?? 0;

  for (let index = 1; index < columnHeights.length; index += 1) {
    const height = columnHeights[index] ?? 0;
    if (height < shortestHeight) {
      shortestHeight = height;
      shortestIndex = index;
    }
  }

  return shortestIndex;
}

function getArchiveObjectLayoutSignature(object: ArchiveObject, mediaRatios: Record<string, number>) {
  if (object.objectType === "collection-create") {
    return getArchiveObjectKey(object);
  }

  if (object.objectType === "collection") {
    const collection = object.collection;
    const visualCount = collection.previewItems.filter(hasPreviewVisual).length;
    return [
      getArchiveObjectKey(object),
      collection.previewItems.length,
      visualCount,
      collection.pieceCount,
      getCollectionRatio(collection),
    ].join(":");
  }

  const item = object.item;
  return [
    getArchiveObjectKey(object),
    item.type,
    item.linkContentType ?? "",
    getItemEstimatedRatio(item, mediaRatios[item.id] ?? null),
    getTextLengthBucket(getItemTextPreview(item)),
    getItemPreviewUrl(item) ? "preview" : "",
    getItemMediaAspectRatio(item, mediaRatios[item.id] ?? null) ? "measured" : "",
  ].join(":");
}

function estimateObjectLayoutMetrics(object: ArchiveObject, columnWidth = 220, mediaRatios: Record<string, number>) {
  if (object.objectType === "collection-create") {
    return {
      height: columnWidth + 44,
      mediaHeight: columnWidth,
    };
  }

  if (object.objectType === "collection") {
    const [width = 4, height = 3] = getRatioParts(getCollectionRatio(object.collection));
    const mediaHeight = (height / width) * columnWidth;
    return {
      height: mediaHeight + 38,
      mediaHeight,
    };
  }

  const item = object.item;
  const [width, height] = getRatioParts(getItemEstimatedRatio(item, mediaRatios[item.id] ?? null));
  const labelHeight = item.type === "caption" || item.type === "note" ? 38 : 31;
  const mediaHeight = (height / width) * columnWidth;
  return {
    height: mediaHeight + labelHeight,
    mediaHeight,
  };
}

function getRatioParts(value: string): [number, number] {
  const [rawWidth, rawHeight] = value.split("/").map((part) => Number.parseFloat(part.trim()));
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1;
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 1;

  return [width, height];
}

function buildPlaceholderColumns(columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => [] as string[]);
  loadingPlaceholders.forEach((id, index) => columns[index % columnCount].push(id));
  return columns;
}

function getItemEstimatedRatio(item: ItemCardProps, measuredAspectRatio: number | null = null) {
  const mediaAspectRatio = getItemMediaAspectRatio(item, measuredAspectRatio);
  if (mediaAspectRatio) {
    return `${mediaAspectRatio} / 1`;
  }

  return getItemFallbackRatio(item);
}

function getItemFallbackRatio(item: ItemCardProps) {
  if (item.type === "caption" || item.type === "note") {
    const previewLength = getItemTextPreview(item).length;
    if (previewLength > 420) {
      return "1 / 1.45";
    }
    if (previewLength > 220) {
      return "1 / 1.28";
    }
  }
  if (item.type === "caption") {
    return "1 / 1.12";
  }
  if (item.type === "note") {
    return "1 / 1.24";
  }
  if (item.type === "video") {
    return "16 / 9";
  }
  if (item.linkContentType === "pdf") {
    return "3 / 4";
  }
  if (item.linkContentType === "video") {
    return "16 / 9";
  }
  if (item.type === "link" && isDirectImageUrl(item.url)) {
    return "4 / 5";
  }
  if (item.ogImageUrl || item.linkContentType === "website") {
    return "1.2 / 1";
  }
  return "4 / 5";
}

function getItemMediaAspectRatio(item: ItemCardProps, measuredAspectRatio: number | null = null) {
  const preview = item.mediaPreview;
  const aspectRatio =
    preview?.aspectRatio ??
    item.aspectRatio ??
    ratioFromDimensions(preview?.width, preview?.height) ??
    ratioFromDimensions(item.imageWidth, item.imageHeight) ??
    measuredAspectRatio;
  return Number.isFinite(aspectRatio) && aspectRatio && aspectRatio > 0 ? roundRatio(aspectRatio) : null;
}

function ratioFromDimensions(width: number | null | undefined, height: number | null | undefined) {
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}

function roundRatio(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundLayoutPixel(value: number) {
  return Math.round(value);
}

function getInitialMasonryContainerWidth() {
  if (typeof window === "undefined") {
    return 1;
  }

  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const archiveGutter = getInitialArchivePageGutter(viewportWidth);
  return Math.max(1, Math.min(1760, 1920, viewportWidth - archiveGutter * 2));
}

function getInitialArchivePageGutter(viewportWidth: number) {
  if (viewportWidth >= 1800) {
    return 32;
  }

  if (viewportWidth >= 1280) {
    return 28;
  }

  if (viewportWidth >= 980) {
    return 24;
  }

  return 20;
}

function getInitialMasonryIntroViewportBottom() {
  if (typeof window === "undefined") {
    return 900;
  }

  return Math.max(320, Math.ceil(window.innerHeight - 112 + 128));
}

function getMasonryIntroViewportBottom(element: HTMLElement) {
  if (typeof window === "undefined") {
    return 900;
  }

  const rect = element.getBoundingClientRect();
  return Math.max(320, Math.ceil(window.innerHeight - rect.top + 128));
}

function readCachedMasonryMediaRatios(objects: ArchiveObject[]) {
  const cache = readMasonryMediaRatioCache();
  if (!cache) {
    return {};
  }

  return objects.reduce<Record<string, number>>((ratios, object) => {
    if (object.objectType !== "item") {
      return ratios;
    }

    const item = object.item;
    if (getItemMediaAspectRatio(item)) {
      return ratios;
    }

    const sourceUrl = getItemPreviewUrl(item);
    const cachedRatio = readCachedMasonryMediaRatio(cache, item.id, sourceUrl);
    if (cachedRatio) {
      ratios[item.id] = cachedRatio;
    }

    return ratios;
  }, {});
}

type MasonryMediaRatioCacheEntry = {
  aspectRatio: number;
  measuredAt: number;
  sourceUrl: string | null;
};

function readMasonryMediaRatioCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawCache = window.localStorage.getItem(masonryMediaRatioStorageKey);
    if (!rawCache) {
      return null;
    }

    const parsedCache = JSON.parse(rawCache) as Record<string, MasonryMediaRatioCacheEntry>;
    return parsedCache && typeof parsedCache === "object" ? parsedCache : null;
  } catch {
    return null;
  }
}

function readCachedMasonryMediaRatio(
  cache: Record<string, MasonryMediaRatioCacheEntry>,
  itemId: string,
  sourceUrl: string | null,
) {
  const entry = cache[itemId];
  if (!entry || entry.sourceUrl !== sourceUrl) {
    return null;
  }

  const aspectRatio = entry.aspectRatio;
  return Number.isFinite(aspectRatio) && aspectRatio > 0 ? roundRatio(aspectRatio) : null;
}

function writeCachedMasonryMediaRatio(itemId: string, aspectRatio: number, sourceUrl: string | null) {
  if (typeof window === "undefined" || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return;
  }

  try {
    const cache = readMasonryMediaRatioCache() ?? {};
    cache[itemId] = {
      aspectRatio: roundRatio(aspectRatio),
      measuredAt: Date.now(),
      sourceUrl,
    };

    const entries = Object.entries(cache)
      .sort(([, left], [, right]) => right.measuredAt - left.measuredAt)
      .slice(0, masonryMediaRatioCacheLimit);

    window.localStorage.setItem(masonryMediaRatioStorageKey, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Runtime media ratios are an optimization; layout remains stable without storage.
  }
}

function getCollectionRatio(_collection: CollectionCardModel) {
  return "1 / 1";
}

function hasPreviewVisual(item: CollectionCardModel["previewItems"][number]) {
  return Boolean(item.thumbnailUrl || item.imageUrl || item.ogImageUrl || item.videoPosterUrl);
}

function getTextLengthBucket(value: string) {
  const length = value.length;
  if (length > 420) {
    return "long";
  }
  if (length > 220) {
    return "medium";
  }
  return "short";
}

function getItemTextPreview(item: ItemCardProps) {
  return item.captionText || item.noteParagraph || item.ogTitle || item.title || item.url || formatItemKind(item);
}

function getItemPreviewUrl(item: ItemCardProps) {
  return (
    item.mediaPreview?.previewUrl ||
    item.mediaPreview?.imageUrl ||
    item.mediaPreview?.thumbnailUrl ||
    item.mediaPreview?.videoPosterUrl ||
    item.videoPosterUrl ||
    item.previewUrl ||
    item.imageUrl ||
    item.thumbnailUrl ||
    item.ogImageUrl ||
    item.assetFileUrl ||
    null
  );
}

function formatItemKind(item: ItemCardProps) {
  if (item.linkContentType === "pdf") {
    return "PDF";
  }
  if (item.linkContentType === "video") {
    return "video";
  }
  if (item.type === "link") {
    return "website";
  }
  return formatSource(item.type);
}

function formatSource(source: string) {
  return source.replace(/_/g, " ");
}

function isDirectImageUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname.toLowerCase();

    return (
      parsedUrl.hostname === "i.pinimg.com" ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".png") ||
      path.endsWith(".webp") ||
      path.endsWith(".gif") ||
      path.endsWith(".avif")
    );
  } catch {
    return false;
  }
}
