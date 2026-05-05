import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { ArchiveObject } from "./ArchiveObject";
import type { CollectionCardModel } from "./CollectionCard";
import type { ItemCardProps } from "./ItemCard";

export type MasonryViewProps = {
  objects: ArchiveObject[];
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
  ariaLabel?: string;
};

type MasonryColumn = ArchiveObject[];
type MasonryVisual = {
  kind: "image" | "pdf" | "text" | "placeholder";
  label: string;
  url: string | null;
};
type MasonryVisualStyle = CSSProperties & {
  "--masonry-ratio": string;
};
type MasonryViewStyle = CSSProperties & {
  "--masonry-columns": number;
};

const loadingPlaceholders = Array.from({ length: 10 }, (_, index) => `masonry-loading-${index}`);

export function MasonryView({
  ariaLabel = "masonry archive objects",
  className = "",
  emptyState = null,
  loading = false,
  objects,
}: MasonryViewProps) {
  const columnCount = useResponsiveMasonryColumns();
  const columns = useMemo(() => assignMasonryColumns(objects, columnCount), [columnCount, objects]);
  const viewClassName = ["masonry-view", className].filter(Boolean).join(" ");
  const viewStyle: MasonryViewStyle = { "--masonry-columns": columnCount };

  if (loading) {
    return (
      <section className={viewClassName} style={viewStyle} aria-label={ariaLabel} aria-busy="true">
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
    <section className={viewClassName} style={viewStyle} aria-label={ariaLabel}>
      {columns.map((column, columnIndex) => (
        <div className="masonry-view__column" key={`masonry-column-${columnIndex}`}>
          {column.map((object) =>
            object.objectType === "item" ? (
              <MasonryItemCard item={object.item} key={`item:${object.item.id}`} />
            ) : (
              <MasonryCollectionCard collection={object.collection} key={`collection:${object.collection.id}`} />
            ),
          )}
        </div>
      ))}
    </section>
  );
}

function MasonryItemCard({ item }: { item: ItemCardProps }) {
  const href = item.detailHref ?? `/items/${encodeURIComponent(item.id)}`;
  const label = getItemLabel(item);
  const visual = getItemVisual(item);
  const ratio = getItemRatio(item);
  const visualStyle: MasonryVisualStyle = {
    "--masonry-ratio": ratio,
  };

  const openItem = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !item.onNavigate ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    item.onNavigate(item.id);
  };
  const toggleSelection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    item.onSelectToggle?.(item.id);
  };

  return (
    <article className={`masonry-card masonry-card--item${item.isSelected ? " masonry-card--selected" : ""}`} data-type={item.type}>
      <a className="masonry-card__link" href={href} onClick={openItem} aria-label={`Open ${label}`}>
        <div className={`masonry-card__visual masonry-card__visual--${visual.kind}`} style={visualStyle}>
          {visual.kind === "image" && visual.url ? (
            <img src={visual.url} alt={item.title ?? item.ogTitle ?? ""} loading="lazy" decoding="async" />
          ) : visual.kind === "pdf" && visual.url ? (
            <iframe
              className="masonry-card__pdf-frame"
              src={buildPdfPreviewUrl(visual.url, label)}
              title={label}
              tabIndex={-1}
              scrolling="no"
            />
          ) : visual.kind === "text" ? (
            <p>{getItemTextPreview(item)}</p>
          ) : (
            <span>{visual.label}</span>
          )}
          <span className="masonry-card__badge">{visual.label}</span>
        </div>
        <div className="masonry-card__meta">
          <strong>{label}</strong>
          <span>{formatSource(item.source)} · {formatItemKind(item)}</span>
        </div>
      </a>
      {item.onSelectToggle ? (
        <button
          className="masonry-card__select"
          type="button"
          aria-label={`${item.isSelected ? "Deselect" : "Select"} ${label}`}
          aria-pressed={item.isSelected}
          onClick={toggleSelection}
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
    </article>
  );
}

function MasonryCollectionCard({ collection }: { collection: CollectionCardModel }) {
  const href = collection.href ?? `/collections/${encodeURIComponent(collection.id)}`;
  const ratio = getCollectionRatio(collection);
  const visualStyle: MasonryVisualStyle = {
    "--masonry-ratio": ratio,
  };

  const openCollection = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !collection.onNavigate ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    collection.onNavigate(collection.id);
  };

  return (
    <article className="masonry-card masonry-card--collection">
      <a className="masonry-card__link" href={href} onClick={openCollection} aria-label={`Open ${collection.name}`}>
        <div className="masonry-card__collection-cover" data-empty={collection.previewItems.length === 0 ? "true" : "false"} style={visualStyle}>
          {collection.previewItems.length === 0 ? (
            <span className="masonry-card__collection-empty">
              <strong>{getCollectionInitials(collection.name)}</strong>
              <small>empty collection</small>
            </span>
          ) : (
            collection.previewItems.slice(0, 4).map((preview, index) => {
              const imageUrl = preview.thumbnailUrl || preview.imageUrl || preview.ogImageUrl || preview.videoPosterUrl;
              return imageUrl ? (
                <span className="masonry-card__collection-tile masonry-card__collection-tile--image" key={`${preview.id}:${index}`}>
                  <img src={imageUrl} alt="" loading="lazy" decoding="async" />
                </span>
              ) : (
                <span
                  className="masonry-card__collection-tile masonry-card__collection-tile--text"
                  data-kind={preview.format || preview.kind}
                  key={`${preview.id}:${index}`}
                >
                  <strong>{getPreviewKindLabel(preview.kind, preview.format)}</strong>
                  <small>{preview.title || preview.textPreview || preview.sourceUrl || preview.kind}</small>
                </span>
              );
            })
          )}
          <span className="masonry-card__badge">collection</span>
        </div>
        <div className="masonry-card__meta">
          <strong>{collection.name}</strong>
          {collection.description ? <p>{collection.description}</p> : null}
          <span>{collection.pieceCount} items · {collection.kindSummary} · {formatDate(collection.lastUpdatedAt)}</span>
        </div>
      </a>
    </article>
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

function assignMasonryColumns(objects: ArchiveObject[], columnCount: number): MasonryColumn[] {
  const safeColumnCount = Math.max(1, columnCount);
  const columns = Array.from({ length: safeColumnCount }, () => [] as ArchiveObject[]);
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0);

  for (const object of objects) {
    const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
    columns[shortestColumnIndex].push(object);
    columnHeights[shortestColumnIndex] += estimateObjectHeight(object);
  }

  return columns;
}

function estimateObjectHeight(object: ArchiveObject) {
  if (object.objectType === "collection") {
    return Number.parseFloat(getCollectionRatio(object.collection).split("/")[1] ?? "1") * 220 + 118;
  }

  const item = object.item;
  const ratio = getItemRatio(item).split("/").map((part) => Number.parseFloat(part.trim()));
  const width = Number.isFinite(ratio[0]) && ratio[0] > 0 ? ratio[0] : 1;
  const height = Number.isFinite(ratio[1]) && ratio[1] > 0 ? ratio[1] : 1;
  const textBonus = item.type === "caption" || item.type === "note" ? Math.min(140, getItemTextPreview(item).length * 0.75) : 52;
  return (height / width) * 220 + textBonus;
}

function buildPlaceholderColumns(columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => [] as string[]);
  loadingPlaceholders.forEach((id, index) => columns[index % columnCount].push(id));
  return columns;
}

function getItemVisual(item: ItemCardProps): MasonryVisual {
  if (item.type === "image") {
    return item.imageUrl
      ? { kind: "image", label: "image", url: item.imageUrl }
      : { kind: "placeholder", label: "image pending", url: null };
  }

  if (item.type === "caption" || item.type === "note") {
    return { kind: "text", label: item.type, url: null };
  }

  if (item.linkContentType === "pdf" && item.assetFileUrl) {
    return { kind: "pdf", label: "PDF", url: item.assetFileUrl };
  }

  const previewImage = item.ogImageUrl || (isDirectImageUrl(item.url) ? item.url : null);
  if (previewImage) {
    return { kind: "image", label: formatItemKind(item), url: previewImage };
  }

  return { kind: "placeholder", label: formatItemKind(item), url: null };
}

function getItemRatio(item: ItemCardProps) {
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

function getCollectionRatio(collection: CollectionCardModel) {
  if (collection.previewItems.length === 0) {
    return "1 / 1";
  }

  const visualCount = collection.previewItems.filter((item) => item.thumbnailUrl || item.imageUrl || item.ogImageUrl || item.videoPosterUrl).length;
  return visualCount >= 3 ? "1 / 1.08" : "4 / 3";
}

function getItemLabel(item: ItemCardProps) {
  if (item.title) {
    return item.title;
  }
  if (item.ogTitle) {
    return item.ogTitle;
  }
  if (item.type === "link") {
    return getDomain(item.url) ?? "link";
  }
  return formatSource(item.type);
}

function getItemTextPreview(item: ItemCardProps) {
  return item.captionText || item.noteParagraph || item.ogTitle || item.title || item.url || formatItemKind(item);
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

function getPreviewKindLabel(kind: string, format?: string | null) {
  if (format === "pdf") {
    return "PDF";
  }
  if (format === "video") {
    return "video";
  }
  if (format === "website") {
    return "web";
  }
  return kind;
}

function formatSource(source: string) {
  return source.replace(/_/g, " ");
}

function formatDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function getCollectionInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "C";
}

function buildPdfPreviewUrl(src: string, name: string) {
  const searchParams = new URLSearchParams();
  searchParams.set("src", src);
  searchParams.set("name", name);
  searchParams.set("surface", "card");
  return `/pdf-preview?${searchParams.toString()}`;
}

function getDomain(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
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
