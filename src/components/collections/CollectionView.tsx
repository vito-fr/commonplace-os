import type { MouseEvent } from "react";
import type { CollectionDetail, CollectionDetailItem } from "../../data/pocketBaseItemCollection";

export type CollectionViewProps = {
  collection: CollectionDetail | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onOpenItem?: (itemId: string, collectionId: string) => void;
};

type SequenceEntry =
  | {
      kind: "single";
      item: CollectionDetailItem;
      index: number;
    }
  | {
      kind: "pair";
      items: [CollectionDetailItem, CollectionDetailItem];
      indexes: [number, number];
    };

export function CollectionView({
  collection,
  loading,
  error,
  onBack,
  onOpenItem,
}: CollectionViewProps) {
  if (loading) {
    return (
      <section className="collection-view" aria-busy="true">
        <CollectionTopBar onBack={onBack} />
        <div className="archive-state archive-state--loading" role="status" aria-live="polite">
          <span className="archive-state__kicker">loading</span>
          <p className="archive-state__copy">Loading collection.</p>
        </div>
      </section>
    );
  }

  if (error || !collection) {
    return (
      <section className="collection-view">
        <CollectionTopBar onBack={onBack} />
        <div className="archive-state archive-state--error" role="alert">
          <span className="archive-state__kicker">load error</span>
          <h2 className="archive-state__title">Collection could not be loaded.</h2>
          <p className="archive-state__copy">{error ?? "Unable to load collection."}</p>
        </div>
      </section>
    );
  }

  return (
    <article className="collection-view" aria-labelledby="collection-title">
      <CollectionTopBar onBack={onBack} />
      <header className="collection-view__header">
        <p className="proof-kicker">collection</p>
        <h1 id="collection-title">{collection.name}</h1>
        <p className="collection-view__meta">
          {formatCount(collection.pieceCount, "piece", "pieces")} · {collection.kindSummary} · last updated{" "}
          {formatDate(collection.lastUpdatedAt)}
        </p>
        {collection.description ? (
          <p className="collection-view__description">{collection.description}</p>
        ) : null}
      </header>

      {collection.items.length === 0 ? (
        <div className="archive-state">
          <span className="archive-state__kicker">empty collection</span>
          <h2 className="archive-state__title">No pieces in this collection yet.</h2>
        </div>
      ) : (
        <div className="collection-sequence" aria-label={`${collection.name} pieces`}>
          {buildSequence(collection.items).map((entry) =>
            entry.kind === "pair" ? (
              <div
                className="collection-sequence__entry collection-sequence__entry--pair"
                key={`${entry.items[0].id}:${entry.items[1].id}`}
              >
                {entry.items.map((item, itemIndex) => (
                  <CollectionPiece
                    collectionId={collection.id}
                    index={entry.indexes[itemIndex]}
                    item={item}
                    key={item.id}
                    onOpenItem={onOpenItem}
                    paired
                  />
                ))}
              </div>
            ) : (
              <CollectionPiece
                collectionId={collection.id}
                index={entry.index}
                item={entry.item}
                key={entry.item.id}
                onOpenItem={onOpenItem}
              />
            ),
          )}
        </div>
      )}
    </article>
  );
}

function CollectionTopBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="collection-view__topbar" aria-label="collection context">
      <button className="text-button" type="button" onClick={onBack}>
        Back to archive
      </button>
    </div>
  );
}

function CollectionPiece({
  collectionId,
  index,
  item,
  onOpenItem,
  paired = false,
}: {
  collectionId: string;
  index: number;
  item: CollectionDetailItem;
  onOpenItem?: (itemId: string, collectionId: string) => void;
  paired?: boolean;
}) {
  const itemHref = buildCollectionItemHref(item.id, collectionId);
  const openItem = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !onOpenItem ||
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
    onOpenItem(item.id, collectionId);
  };

  return (
    <article className={getPieceClassName(item, index, paired)}>
      {renderPieceContent(item)}
      <a className="collection-piece__caption" href={itemHref} onClick={openItem}>
        {formatCaption(item)}
      </a>
    </article>
  );
}

function renderPieceContent(item: CollectionDetailItem) {
  if (item.type === "image") {
    return (
      <div className="collection-piece__visual">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title ?? ""} />
        ) : (
          <div className="collection-piece__placeholder">image pending</div>
        )}
      </div>
    );
  }

  if (item.type === "caption") {
    return (
      <p className="collection-piece__text collection-piece__text--caption">
        {item.captionText ?? item.title ?? "Caption unavailable."}
      </p>
    );
  }

  if (item.type === "note") {
    return (
      <p className="collection-piece__text collection-piece__text--note">
        {item.noteParagraph ?? item.summary ?? item.title ?? "Note unavailable."}
      </p>
    );
  }

  return (
    <div className="collection-piece__text collection-piece__text--link">
      <span>link</span>
      <p>{item.ogTitle ?? item.title ?? item.url ?? "Link unavailable."}</p>
      {item.url ? <small>{item.url}</small> : null}
    </div>
  );
}

function buildSequence(items: CollectionDetailItem[]): SequenceEntry[] {
  const entries: SequenceEntry[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index];
    const nextItem = items[index + 1];

    if (canPairPortraits(item, nextItem, index)) {
      entries.push({
        kind: "pair",
        items: [item, nextItem],
        indexes: [index, index + 1],
      });
      index += 2;
    } else {
      entries.push({ kind: "single", item, index });
      index += 1;
    }
  }

  return entries;
}

function canPairPortraits(
  item: CollectionDetailItem,
  nextItem: CollectionDetailItem | undefined,
  index: number,
) {
  return (
    !isFullBleedIndex(index) &&
    nextItem !== undefined &&
    !isFullBleedIndex(index + 1) &&
    isPortraitImage(item) &&
    isPortraitImage(nextItem)
  );
}

function getPieceClassName(item: CollectionDetailItem, index: number, paired: boolean) {
  const classes = ["collection-piece"];

  if (paired) {
    classes.push("collection-piece--paired");
  } else if (isFullBleedIndex(index)) {
    classes.push("collection-sequence__entry", "collection-piece--full");
  } else if (item.type !== "image") {
    classes.push("collection-sequence__entry", "collection-piece--textual");
  } else if (isPortraitImage(item)) {
    classes.push("collection-sequence__entry", "collection-piece--portrait");
  } else if (isLandscapeImage(item)) {
    classes.push("collection-sequence__entry", "collection-piece--landscape");
  } else {
    classes.push("collection-sequence__entry", "collection-piece--square");
  }

  return classes.join(" ");
}

function isFullBleedIndex(index: number) {
  return (index + 1) % 5 === 0;
}

function isPortraitImage(item: CollectionDetailItem) {
  return item.type === "image" && hasDimensions(item) && item.imageHeight / item.imageWidth > 1.2;
}

function isLandscapeImage(item: CollectionDetailItem) {
  return item.type === "image" && hasDimensions(item) && item.imageWidth / item.imageHeight > 1.2;
}

function hasDimensions(
  item: CollectionDetailItem,
): item is CollectionDetailItem & { imageWidth: number; imageHeight: number } {
  return item.imageWidth !== null && item.imageHeight !== null && item.imageWidth > 0 && item.imageHeight > 0;
}

function formatCaption(item: CollectionDetailItem) {
  const parts = [
    item.title ?? `${item.type} piece`,
    getYear(item.createdAt),
    item.source.label ? `from ${item.source.label}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" · ");
}

function getYear(value: string) {
  const match = value.match(/^(\d{4})/);
  return match ? match[1] : null;
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildCollectionItemHref(itemId: string, collectionId: string) {
  const searchParams = new URLSearchParams({ return_collection: collectionId });
  return `/items/${encodeURIComponent(itemId)}?${searchParams.toString()}`;
}
