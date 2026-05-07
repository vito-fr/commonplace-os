import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ArchiveObject } from "./ArchiveObject";
import { CollectionCard, NewCollectionCard } from "./CollectionCard";
import type { CollectionCardModel } from "./CollectionCard";
import { ItemCard, type ItemCardProps } from "./ItemCard";
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
};

type MasonryItemStyle = CSSProperties & {
  "--archive-card-index": number;
};

const loadingPlaceholders = Array.from({ length: 10 }, (_, index) => `masonry-loading-${index}`);

export function MasonryView({
  ariaLabel = "masonry archive objects",
  className = "",
  columns: controlledColumns,
  emptyState = null,
  loading = false,
  objects,
}: MasonryViewProps) {
  const responsiveColumnCount = useResponsiveMasonryColumns();
  const responsiveColumnCap = useResponsiveMasonryColumnCap();
  const requestedColumnCount = controlledColumns ?? responsiveColumnCount;
  const columnCount = Math.max(1, Math.min(requestedColumnCount, responsiveColumnCap));
  const layoutSignature = useMemo(() => objects.map(getArchiveObjectLayoutSignature).join("|"), [objects]);
  const objectByKey = useMemo(() => {
    const map = new Map<string, ArchiveObject>();
    objects.forEach((object) => map.set(getArchiveObjectKey(object), object));
    return map;
  }, [objects]);
  const enterIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    objects.forEach((object, index) => map.set(getArchiveObjectKey(object), index));
    return map;
  }, [layoutSignature]);
  const columnKeys = useMemo(() => assignMasonryColumnKeys(objects, columnCount), [columnCount, layoutSignature]);
  const columns = useMemo(
    () =>
      columnKeys.map((column) =>
        column.flatMap((key) => {
          const object = objectByKey.get(key);
          return object ? [object] : [];
        }),
      ),
    [columnKeys, objectByKey],
  );
  const viewClassName = ["masonry-view", className].filter(Boolean).join(" ");
  const viewStyle: MasonryViewStyle = { "--masonry-columns": columnCount };
  const viewRef = useRef<HTMLElement | null>(null);
  const flipSignature = `${columnCount}::${layoutSignature}`;

  useGridFlipAnimation(viewRef, flipSignature);

  if (loading) {
    return (
      <section ref={viewRef} className={viewClassName} style={viewStyle} aria-label={ariaLabel} aria-busy="true">
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
    <section ref={viewRef} className={viewClassName} style={viewStyle} aria-label={ariaLabel}>
      {columns.map((column, columnIndex) => (
        <div className="masonry-view__column" key={`masonry-column-${columnIndex}`}>
          {column.map((object) => {
            const objectKey = getArchiveObjectKey(object);
            const enterIndex = enterIndexByKey.get(objectKey) ?? 0;

            return (
              <div
                className="masonry-view__item"
                data-archive-key={objectKey}
                key={objectKey}
                style={{ "--archive-card-index": enterIndex } as MasonryItemStyle}
              >
                {object.objectType === "item" ? (
                  <ItemCard {...object.item} variant="masonry" />
                ) : object.objectType === "collection" ? (
                  <CollectionCard collection={object.collection} />
                ) : (
                  <NewCollectionCard disabled={object.disabled} onCreate={object.onCreateCollection} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}

function useResponsiveMasonryColumns() {
  const [columnCount, setColumnCount] = useState(() => getResponsiveMasonryColumnCount());

  useEffect(() => {
    const updateColumnCount = () => setColumnCount(getResponsiveMasonryColumnCount());
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  return columnCount;
}

function useResponsiveMasonryColumnCap() {
  const [columnCap, setColumnCap] = useState(() => getResponsiveMasonryColumnCap());

  useEffect(() => {
    const updateColumnCap = () => setColumnCap(getResponsiveMasonryColumnCap());
    window.addEventListener("resize", updateColumnCap);
    return () => window.removeEventListener("resize", updateColumnCap);
  }, []);

  return columnCap;
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

function assignMasonryColumnKeys(objects: ArchiveObject[], columnCount: number): string[][] {
  const safeColumnCount = Math.max(1, columnCount);
  const columns = Array.from({ length: safeColumnCount }, () => [] as string[]);
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0);

  for (const object of objects) {
    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
    columns[shortestColumnIndex].push(getArchiveObjectKey(object));
    columnHeights[shortestColumnIndex] += estimateObjectHeight(object);
  }

  return columns;
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

function estimateObjectHeight(object: ArchiveObject) {
  if (object.objectType === "collection-create") {
    return 338;
  }

  if (object.objectType === "collection") {
    const [width = 4, height = 3] = getRatioParts(getCollectionRatio(object.collection));
    return (height / width) * 220 + 64;
  }

  const item = object.item;
  const [width, height] = getRatioParts(getItemEstimatedRatio(item));
  const textBonus = item.type === "caption" || item.type === "note" ? Math.min(140, getItemTextPreview(item).length * 0.75) : 52;
  return (height / width) * 220 + textBonus;
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
