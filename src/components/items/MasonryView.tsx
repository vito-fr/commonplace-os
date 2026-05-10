import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { ArchiveObject } from "./ArchiveObject";
import { CollectionCard, NewCollectionCard } from "./CollectionCard";
import type { CollectionCardModel } from "./CollectionCard";
import { ItemCard, type ItemCardProps } from "./ItemCard";
import { getArchiveObjectKey, getArchiveObjectRenderSignature } from "./archiveObjectIdentity";

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
  transform: string;
  width: number;
};

type MasonryObjectContentProps = {
  mediaLoading: "eager" | "lazy";
  object: ArchiveObject;
  renderSignature: string;
};

type NaturalMediaRatioMap = Record<string, number>;

const loadingPlaceholders = Array.from({ length: 10 }, (_, index) => `masonry-loading-${index}`);
const masonryGap = 12;
const initialEntryDurationMs = 920;

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
  const measuredContainerWidth = useMasonryContainerWidth(viewRef);
  const layoutSignature = useMemo(() => objects.map(getArchiveObjectLayoutSignature).join("|"), [objects]);
  const naturalMediaRatios = useMasonryNaturalMediaRatios(viewRef, layoutSignature);
  const naturalMediaRatioSignature = useMemo(
    () => Object.entries(naturalMediaRatios).map(([key, ratio]) => `${key}:${ratio}`).join("|"),
    [naturalMediaRatios],
  );
  const layout = useMemo(
    () => buildMasonryLayout(objects, columnCount, measuredContainerWidth, naturalMediaRatios),
    [objects, columnCount, measuredContainerWidth, layoutSignature, naturalMediaRatioSignature, naturalMediaRatios],
  );
  const viewClassName = ["masonry-view", className].filter(Boolean).join(" ");
  const viewStyle: MasonryViewStyle = {
    "--masonry-columns": columnCount,
    height: layout.containerHeight,
  };
  const [entryState, setEntryState] = useState<"initial" | "settled">("initial");

  useEffect(() => {
    if (loading || objects.length === 0 || entryState === "settled") {
      return;
    }

    const timeout = window.setTimeout(() => setEntryState("settled"), initialEntryDurationMs);
    return () => window.clearTimeout(timeout);
  }, [entryState, loading, objects.length]);

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
      data-entry-state={entryState}
      style={viewStyle}
      aria-label={ariaLabel}
    >
      {layout.items.map(({ enterIndex, object, objectKey, renderSignature, width, x, y }) => {
        const mediaLoading = enterIndex < columnCount ? "eager" : "lazy";
        const itemStyle: MasonryItemStyle = {
          "--archive-card-index": enterIndex,
          transform: `translate3d(${roundLayoutPixel(x)}px, ${roundLayoutPixel(y)}px, 0)`,
          width: roundLayoutPixel(width),
        };

        return (
          <div className="masonry-view__item" data-archive-key={objectKey} key={objectKey} style={itemStyle}>
            <MasonryObjectContent mediaLoading={mediaLoading} object={object} renderSignature={renderSignature} />
          </div>
        );
      })}
    </section>
  );
}

const MasonryObjectContent = memo(function MasonryObjectContent({
  mediaLoading,
  object,
  renderSignature: _renderSignature,
}: MasonryObjectContentProps) {
  if (object.objectType === "item") {
    return <ItemCard {...object.item} mediaLoading={mediaLoading} variant="masonry" />;
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
  return previousProps.mediaLoading === nextProps.mediaLoading && previousProps.renderSignature === nextProps.renderSignature;
}

function useMasonryContainerWidth(ref: RefObject<HTMLElement | null>) {
  const [containerWidth, setContainerWidth] = useState(() => getInitialMasonryContainerWidth());

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let frame = 0;
    const updateWidth = (width: number) => {
      const roundedWidth = Math.max(1, Math.round(width));
      setContainerWidth((currentWidth) => (currentWidth === roundedWidth ? currentWidth : roundedWidth));
    };
    const scheduleWidthUpdate = (width: number) => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateWidth(width);
      });
    };

    updateWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? element.getBoundingClientRect().width;
      scheduleWidthUpdate(nextWidth);
    });
    observer.observe(element);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  }, [ref]);

  return containerWidth;
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

function useMasonryNaturalMediaRatios(ref: RefObject<HTMLElement | null>, objectSignature: string) {
  const [naturalMediaRatios, setNaturalMediaRatios] = useState<NaturalMediaRatioMap>({});

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let frame = 0;
    const scheduleRatioRead = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const nextRatios: NaturalMediaRatioMap = {};

        element.querySelectorAll<HTMLElement>(".masonry-view__item[data-archive-key]").forEach((itemElement) => {
          const key = itemElement.dataset.archiveKey;
          const image = itemElement.querySelector<HTMLImageElement>("img.item-card__image");
          if (!key || !image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
            return;
          }

          nextRatios[key] = roundRatio(image.naturalWidth / image.naturalHeight);
        });

        setNaturalMediaRatios((currentRatios) => {
          let didChange = false;
          const mergedRatios = { ...currentRatios };

          for (const [key, ratio] of Object.entries(nextRatios)) {
            if (Math.abs((mergedRatios[key] ?? 0) - ratio) > 0.001) {
              mergedRatios[key] = ratio;
              didChange = true;
            }
          }

          return didChange ? mergedRatios : currentRatios;
        });
      });
    };

    const images = Array.from(element.querySelectorAll<HTMLImageElement>(".masonry-view__item img.item-card__image"));
    images.forEach((image) => {
      image.addEventListener("load", scheduleRatioRead);
      image.addEventListener("error", scheduleRatioRead);
    });
    scheduleRatioRead();

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      images.forEach((image) => {
        image.removeEventListener("load", scheduleRatioRead);
        image.removeEventListener("error", scheduleRatioRead);
      });
    };
  }, [ref, objectSignature]);

  return naturalMediaRatios;
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
  naturalMediaRatios: NaturalMediaRatioMap = {},
) {
  const safeColumnCount = Math.max(1, columnCount);
  const safeContainerWidth = Math.max(1, containerWidth);
  const columnWidth = Math.max(1, (safeContainerWidth - masonryGap * (safeColumnCount - 1)) / safeColumnCount);
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0);
  const items = objects.map((object, enterIndex) => {
    const columnIndex = getShortestColumnIndex(columnHeights);
    const x = columnIndex * (columnWidth + masonryGap);
    const y = columnHeights[columnIndex];
    const objectKey = getArchiveObjectKey(object);
    const estimatedHeight = estimateObjectHeight(object, columnWidth, naturalMediaRatios[objectKey]);

    columnHeights[columnIndex] += estimatedHeight + masonryGap;

    return {
      enterIndex,
      object,
      objectKey,
      renderSignature: getArchiveObjectRenderSignature(object),
      width: columnWidth,
      x,
      y,
    };
  });
  const containerHeight = Math.max(0, ...columnHeights.map((height) => height - masonryGap));

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

function getArchiveObjectLayoutSignature(object: ArchiveObject) {
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
    getItemEstimatedRatio(item),
    getTextLengthBucket(getItemTextPreview(item)),
    getItemPreviewUrl(item) ? "preview" : "",
    getItemMediaAspectRatio(item) ? "measured" : "",
  ].join(":");
}

function estimateObjectHeight(object: ArchiveObject, columnWidth = 220, naturalMediaRatio?: number) {
  if (object.objectType === "collection-create") {
    return columnWidth + 44;
  }

  if (object.objectType === "collection") {
    const [width = 4, height = 3] = getRatioParts(getCollectionRatio(object.collection));
    return (height / width) * columnWidth + 38;
  }

  const item = object.item;
  const [width, height] =
    naturalMediaRatio && Number.isFinite(naturalMediaRatio) && naturalMediaRatio > 0
      ? [naturalMediaRatio, 1]
      : getRatioParts(getItemEstimatedRatio(item));
  const labelHeight = item.type === "caption" || item.type === "note" ? 38 : 31;
  return (height / width) * columnWidth + labelHeight;
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

function getItemEstimatedRatio(item: ItemCardProps) {
  const mediaAspectRatio = getItemMediaAspectRatio(item);
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

function getItemMediaAspectRatio(item: ItemCardProps) {
  const preview = item.mediaPreview;
  const aspectRatio = preview?.aspectRatio ?? item.aspectRatio ?? ratioFromDimensions(preview?.width, preview?.height) ?? ratioFromDimensions(item.imageWidth, item.imageHeight);
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
  return Math.round(value * 100) / 100;
}

function getInitialMasonryContainerWidth() {
  if (typeof window === "undefined") {
    return 1;
  }

  const desktopGutter = window.innerWidth >= 720 ? 160 : 36;
  return Math.max(1, Math.min(1920, window.innerWidth - desktopGutter));
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
