import type { MouseEvent } from "react";

export type CollectionCardModel = {
  id: string;
  name: string;
  description: string | null;
  pieceCount: number;
  kindSummary: string;
  lastUpdatedAt: string;
  previewItems: CollectionCardPreviewItem[];
  href?: string;
  onNavigate?: (collectionId: string) => void;
};

export type CollectionCardPreviewItem = {
  id: string;
  title?: string | null;
  kind: string;
  format?: string | null;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  ogImageUrl?: string | null;
  videoPosterUrl?: string | null;
  textPreview?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
};

export type CollectionCardProps = {
  collection: CollectionCardModel;
};

export function CollectionCard({ collection }: CollectionCardProps) {
  const href = collection.href ?? `/collections/${encodeURIComponent(collection.id)}`;
  const updatedLabel = formatCollectionUpdated(collection.lastUpdatedAt);

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
    <article className="collection-card">
      <a className="collection-card__link" href={href} onClick={openCollection} aria-label={`Open ${collection.name}`}>
        <div className="collection-card__cover" aria-hidden="true" data-empty={collection.previewItems.length === 0 ? "true" : "false"}>
          {renderCoverTiles(collection)}
          <span className="collection-card__badge">collection</span>
        </div>
        <div className="collection-card__body">
          <h2>{collection.name}</h2>
          {collection.description ? <p>{collection.description}</p> : null}
          <dl>
            <div>
              <dt>pieces</dt>
              <dd>{collection.pieceCount}</dd>
            </div>
            <div>
              <dt>kind</dt>
              <dd>{collection.kindSummary}</dd>
            </div>
            <div>
              <dt>updated</dt>
              <dd>{updatedLabel}</dd>
            </div>
          </dl>
        </div>
      </a>
    </article>
  );
}

function renderCoverTiles(collection: CollectionCardModel) {
  if (collection.previewItems.length === 0) {
    return (
      <span className="collection-card__cover-empty">
        <strong>{getCoverLabel(collection.name)}</strong>
        <small>empty collection</small>
      </span>
    );
  }

  const slots = collection.previewItems.slice(0, 4);
  while (slots.length < 4) {
    slots.push({
      id: `empty-slot-${slots.length}`,
      kind: "empty",
      textPreview: "",
    });
  }

  return slots.map((item, index) => {
    const imageUrl = item.thumbnailUrl || item.imageUrl || item.ogImageUrl || item.videoPosterUrl || null;
    const label = getPreviewKindLabel(item);

    if (imageUrl) {
      return (
        <span className="collection-card__preview-tile collection-card__preview-tile--visual" key={`${item.id}:${index}`}>
          <img src={imageUrl} alt="" />
          <small>{label}</small>
        </span>
      );
    }

    if (item.kind === "empty") {
      return <span className="collection-card__preview-tile collection-card__preview-tile--ghost" key={item.id} />;
    }

    return (
      <span
        className="collection-card__preview-tile collection-card__preview-tile--text"
        data-kind={item.format || item.kind}
        key={`${item.id}:${index}`}
      >
        <strong>{label}</strong>
        <small>{getPreviewText(item)}</small>
      </span>
    );
  });
}

function getPreviewKindLabel(item: CollectionCardPreviewItem) {
  if (item.format === "pdf") {
    return "PDF";
  }

  if (item.format === "video") {
    return "video";
  }

  if (item.format === "website") {
    return "web";
  }

  return item.kind === "empty" ? "" : item.kind;
}

function getPreviewText(item: CollectionCardPreviewItem) {
  const text = item.title || item.textPreview || getDomain(item.sourceUrl) || item.kind;
  return text.trim() || item.kind;
}

function getCoverLabel(name: string) {
  const letters = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return letters || "C";
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

function formatCollectionUpdated(lastUpdatedAt: string) {
  const timestamp = Date.parse(lastUpdatedAt);
  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}
