import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ItemStatus, ItemType } from "../atoms";
import { MasonryGrid } from "../items";
import type { ArchiveObject, ItemCardProps } from "../items";
import type { CollectionCardPreviewItem } from "../items/CollectionCard";
import type { CollectionDetail, CollectionDetailItem, CollectionIndexItem } from "../../data/pocketBaseItemCollection";

export type CollectionViewProps = {
  collection: CollectionDetail | null;
  collectionIndex: CollectionIndexItem[];
  loading: boolean;
  error: string | null;
  onAddItemsToCollection: (input: {
    collectionId: string;
    itemIds: string[];
    sourceCollectionId: string;
  }) => Promise<void>;
  onBack: () => void;
  onCreateCollectionFromItems: (input: {
    description: string | null;
    itemIds: string[];
    name: string;
    sourceCollectionId: string;
  }) => Promise<void>;
  onOpenItem?: (itemId: string, collectionId: string) => void;
  onRemoveItemsFromCollection: (input: { collectionId: string; itemIds: string[] }) => Promise<void>;
};

type CollectionKindFilter = ItemType | "pdf" | "video" | "website" | "all";
type CollectionStateFilter = ItemStatus | "all";
type CollectionSort = "newest" | "oldest" | "title";

const collectionKindOptions: CollectionKindFilter[] = [
  "all",
  "image",
  "caption",
  "note",
  "link",
  "pdf",
  "website",
  "video",
];
const collectionStateOptions: CollectionStateFilter[] = ["all", "active", "archived"];
const collectionSortOptions: CollectionSort[] = ["newest", "oldest", "title"];

export function CollectionView({
  collection,
  collectionIndex,
  error,
  loading,
  onAddItemsToCollection,
  onBack,
  onCreateCollectionFromItems,
  onOpenItem,
  onRemoveItemsFromCollection,
}: CollectionViewProps) {
  const [query, setQuery] = useState(() => getInitialCollectionQuery());
  const [kindFilter, setKindFilter] = useState<CollectionKindFilter>(() => getInitialKindFilter());
  const [stateFilter, setStateFilter] = useState<CollectionStateFilter>(() => getInitialStateFilter());
  const [sourceFilter, setSourceFilter] = useState(() => getInitialSourceFilter());
  const [sort, setSort] = useState<CollectionSort>(() => getInitialSort());
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionPending, setSelectionPending] = useState(false);

  const sourceOptions = useMemo(() => {
    const sources = new Set<string>();
    for (const item of collection?.items ?? []) {
      sources.add(item.source.kind || "manual");
    }
    if (sourceFilter !== "all") {
      sources.add(sourceFilter);
    }
    return ["all", ...Array.from(sources).sort()];
  }, [collection?.items, sourceFilter]);
  const filteredItems = useMemo(
    () => filterAndSortCollectionItems(collection?.items ?? [], { kindFilter, query, sort, sourceFilter, stateFilter }),
    [collection?.items, kindFilter, query, sort, sourceFilter, stateFilter],
  );
  const hasActiveFilters =
    query.trim() !== "" || kindFilter !== "all" || stateFilter !== "all" || sourceFilter !== "all" || sort !== "newest";

  useEffect(() => {
    setSelectedItemIds([]);
    setSelectionError(null);
  }, [collection?.id]);

  useEffect(() => {
    setSelectedItemIds((currentSelection) => {
      if (currentSelection.length === 0) {
        return currentSelection;
      }

      const availableIds = new Set(collection?.items.map((item) => item.id) ?? []);
      const nextSelection = currentSelection.filter((itemId) => availableIds.has(itemId));
      return nextSelection.length === currentSelection.length ? currentSelection : nextSelection;
    });
  }, [collection?.items]);

  useEffect(() => {
    if (!collection) {
      return;
    }

    const nextUrl = buildCollectionFilterUrl(collection.id, {
      kindFilter,
      query,
      sort,
      sourceFilter,
      stateFilter,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [collection, kindFilter, query, sort, sourceFilter, stateFilter]);

  const clearFilters = () => {
    setQuery("");
    setKindFilter("all");
    setStateFilter("all");
    setSourceFilter("all");
    setSort("newest");
  };
  const toggleSelection = (itemId: string) => {
    setSelectionError(null);
    setSelectedItemIds((currentSelection) =>
      currentSelection.includes(itemId)
        ? currentSelection.filter((selectedItemId) => selectedItemId !== itemId)
        : [...currentSelection, itemId],
    );
  };
  const clearSelection = () => {
    window.setTimeout(() => {
      setSelectedItemIds([]);
      setSelectionError(null);
    }, 0);
  };
  const runSelectionAction = async (action: () => Promise<void>) => {
    setSelectionPending(true);
    setSelectionError(null);
    try {
      await action();
      clearSelection();
    } catch (actionError: unknown) {
      console.error(actionError);
      setSelectionError("Unable to update selected items.");
    } finally {
      setSelectionPending(false);
    }
  };
  const removeSelected = () => {
    if (!collection || selectedItemIds.length === 0) {
      return;
    }

    void runSelectionAction(() =>
      onRemoveItemsFromCollection({
        collectionId: collection.id,
        itemIds: selectedItemIds,
      }),
    );
  };
  const addSelectedToCollection = (collectionId: string) => {
    if (!collection || selectedItemIds.length === 0) {
      return;
    }

    void runSelectionAction(() =>
      onAddItemsToCollection({
        collectionId,
        itemIds: selectedItemIds,
        sourceCollectionId: collection.id,
      }),
    );
  };
  const createCollectionFromSelected = (input: { name: string; description: string | null }) => {
    if (!collection || selectedItemIds.length === 0) {
      return;
    }

    void runSelectionAction(() =>
      onCreateCollectionFromItems({
        ...input,
        itemIds: selectedItemIds,
        sourceCollectionId: collection.id,
      }),
    );
  };

  if (loading) {
    return (
      <section className="collection-view collection-workspace" aria-busy="true">
        <CollectionTopBar onBack={onBack} />
        <div className="archive-state archive-state--loading" role="status" aria-live="polite">
          <span className="archive-state__kicker">loading</span>
          <p className="archive-state__copy">Loading collection.</p>
        </div>
      </section>
    );
  }

  if (error || !collection) {
    const errorDisplay = getCollectionLoadErrorDisplay(error ?? "Collection could not be loaded.");
    return (
      <section className="collection-view collection-workspace">
        <CollectionTopBar onBack={onBack} />
        <div className="archive-state archive-state--error" role="alert">
          <span className="archive-state__kicker">load error</span>
          <h2 className="archive-state__title">{errorDisplay.title}</h2>
          <p className="archive-state__copy">{errorDisplay.copy}</p>
        </div>
      </section>
    );
  }

  const archiveObjects = filteredItems.map((item) => ({
    objectType: "item" as const,
    item: toCollectionItemCard({
      collectionId: collection.id,
      isSelected: selectedItemIds.includes(item.id),
      item,
      onOpenItem,
      onSelectToggle: toggleSelection,
    }),
  }));

  return (
    <article className="collection-view collection-workspace" aria-labelledby="collection-title">
      <CollectionTopBar onBack={onBack} />
      <header className="collection-workspace__header">
        <CollectionWorkspaceCover collection={collection} />
        <div className="collection-workspace__intro">
          <p className="proof-kicker">collection</p>
          <h1 id="collection-title">{collection.name}</h1>
          {collection.description ? <p className="collection-view__description">{collection.description}</p> : null}
          <dl className="collection-workspace__meta">
            <div>
              <dt>items</dt>
              <dd>{collection.pieceCount}</dd>
            </div>
            <div>
              <dt>kind</dt>
              <dd>{collection.kindSummary}</dd>
            </div>
            <div>
              <dt>updated</dt>
              <dd>{formatDate(collection.lastUpdatedAt)}</dd>
            </div>
          </dl>
        </div>
      </header>

      {collection.items.length === 0 ? (
        <CollectionEmptyState onBack={onBack} />
      ) : (
        <>
          <CollectionToolbar
            kindFilter={kindFilter}
            onClearFilters={clearFilters}
            onKindFilterChange={setKindFilter}
            onQueryChange={setQuery}
            onSortChange={setSort}
            onSourceFilterChange={setSourceFilter}
            onStateFilterChange={setStateFilter}
            query={query}
            sort={sort}
            sourceFilter={sourceFilter}
            sourceOptions={sourceOptions}
            stateFilter={stateFilter}
          />
          <MasonryGrid
            ariaLabel={`${collection.name} items`}
            className="collection-workspace__grid"
            columns={4}
            density="comfortable"
            objects={archiveObjects}
            emptyState={
              <CollectionFilteredEmptyState
                hasActiveFilters={hasActiveFilters}
                onBack={onBack}
                onClearFilters={clearFilters}
              />
            }
          />
        </>
      )}

      {selectedItemIds.length > 0 ? (
        <CollectionSelectionActionBar
          collectionId={collection.id}
          collections={collectionIndex}
          error={selectionError}
          onAddToCollection={addSelectedToCollection}
          onClear={clearSelection}
          onCreate={createCollectionFromSelected}
          onRemove={removeSelected}
          pending={selectionPending}
          selectedCount={selectedItemIds.length}
        />
      ) : null}
    </article>
  );
}

function CollectionTopBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="collection-view__topbar" aria-label="collection context">
      <button className="text-button" type="button" onClick={onBack}>
        Back to Gallery
      </button>
    </div>
  );
}

function CollectionWorkspaceCover({ collection }: { collection: CollectionDetail }) {
  const previewItems = buildCollectionPreviewItems(collection.items);

  return (
    <div className="collection-workspace__cover" data-empty={previewItems.length === 0 ? "true" : "false"} aria-hidden="true">
      {previewItems.length === 0 ? (
        <span className="collection-card__cover-empty">
          <strong>{getCoverLabel(collection.name)}</strong>
          <small>empty collection</small>
        </span>
      ) : (
        renderCoverTiles(previewItems)
      )}
      <span className="collection-card__badge">workspace</span>
    </div>
  );
}

function CollectionToolbar({
  kindFilter,
  onClearFilters,
  onKindFilterChange,
  onQueryChange,
  onSortChange,
  onSourceFilterChange,
  onStateFilterChange,
  query,
  sort,
  sourceFilter,
  sourceOptions,
  stateFilter,
}: {
  kindFilter: CollectionKindFilter;
  onClearFilters: () => void;
  onKindFilterChange: (kind: CollectionKindFilter) => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: CollectionSort) => void;
  onSourceFilterChange: (source: string) => void;
  onStateFilterChange: (state: CollectionStateFilter) => void;
  query: string;
  sort: CollectionSort;
  sourceFilter: string;
  sourceOptions: string[];
  stateFilter: CollectionStateFilter;
}) {
  return (
    <section className="collection-workspace__toolbar" aria-label="collection filters">
      <input
        aria-label="search within this collection"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search this collection"
        type="search"
        value={query}
      />
      <CollectionSelect
        label="Kind"
        onChange={(value) => onKindFilterChange(value as CollectionKindFilter)}
        options={collectionKindOptions}
        value={kindFilter}
      />
      <CollectionSelect
        label="State"
        onChange={(value) => onStateFilterChange(value as CollectionStateFilter)}
        options={collectionStateOptions}
        value={stateFilter}
      />
      <CollectionSelect
        label="Source"
        onChange={onSourceFilterChange}
        options={sourceOptions}
        value={sourceFilter}
      />
      <CollectionSelect
        label="Sort"
        onChange={(value) => onSortChange(value as CollectionSort)}
        options={collectionSortOptions}
        value={sort}
      />
      <button className="collection-workspace__tool-cell" type="button" onClick={onClearFilters}>
        Clear filters
      </button>
    </section>
  );
}

function CollectionSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="collection-workspace__select">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOptionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CollectionSelectionActionBar({
  collectionId,
  collections,
  error,
  onAddToCollection,
  onClear,
  onCreate,
  onRemove,
  pending,
  selectedCount,
}: {
  collectionId: string;
  collections: CollectionIndexItem[];
  error: string | null;
  onAddToCollection: (collectionId: string) => void;
  onClear: () => void;
  onCreate: (input: { name: string; description: string | null }) => void;
  onRemove: () => void;
  pending: boolean;
  selectedCount: number;
}) {
  const targetCollections = collections.filter((collection) => collection.id !== collectionId);
  const [activeAction, setActiveAction] = useState<"add" | "create" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canCreate = name.trim().length > 0 && !pending;
  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) {
      return;
    }

    onCreate({
      name: name.trim(),
      description: description.trim() || null,
    });
    setName("");
    setDescription("");
  };

  return (
    <section className="selection-action-bar selection-action-bar--collection" aria-label="selected collection item actions">
      <div className="selection-action-bar__summary">
        <strong>{selectedCount} selected</strong>
        <button
          className="selection-action-bar__cell"
          type="button"
          disabled={pending}
          data-active={activeAction === "add" ? "true" : "false"}
          onClick={() => setActiveAction((current) => (current === "add" ? null : "add"))}
        >
          Add to collection
        </button>
        <button
          className="selection-action-bar__cell"
          type="button"
          disabled={pending}
          data-active={activeAction === "create" ? "true" : "false"}
          onClick={() => setActiveAction((current) => (current === "create" ? null : "create"))}
        >
          Create collection
        </button>
        <button className="selection-action-bar__cell selection-action-bar__cell--danger" type="button" disabled={pending} onClick={onRemove}>
          Remove
        </button>
        <button className="selection-action-bar__cell" type="button" disabled={pending} onClick={onClear}>
          Clear
        </button>
      </div>

      {activeAction === "add" ? (
        <div className="selection-action-bar__panel" aria-label="add selected to another collection">
          {targetCollections.length === 0 ? <span className="selection-action-bar__empty">No other collections yet.</span> : null}
          {targetCollections.map((collection) => (
            <button
              className="selection-action-bar__collection"
              disabled={pending}
              key={collection.id}
              type="button"
              onClick={() => onAddToCollection(collection.id)}
            >
              <span className="selection-action-bar__collection-preview" aria-hidden="true">
                {collection.previewItems.slice(0, 3).map((preview) => {
                  const imageUrl = preview.thumbnailUrl || preview.imageUrl || preview.ogImageUrl || preview.videoPosterUrl;
                  return imageUrl ? <img src={imageUrl} alt="" key={preview.id} /> : <span key={preview.id}>{preview.kind.slice(0, 1).toUpperCase()}</span>;
                })}
              </span>
              <span>
                <strong>{collection.name}</strong>
                <small>{collection.pieceCount} items · {collection.kindSummary}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {activeAction === "create" ? (
        <form className="selection-action-bar__panel selection-action-bar__panel--create" onSubmit={submitCreate}>
          <input
            aria-label="new collection name for selected collection items"
            disabled={pending}
            onChange={(event) => setName(event.target.value)}
            placeholder="New collection"
            value={name}
          />
          <input
            aria-label="new collection description for selected collection items"
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description optional"
            value={description}
          />
          <button className="selection-action-bar__cell" type="submit" disabled={!canCreate}>
            {pending ? "Adding" : "Create"}
          </button>
        </form>
      ) : null}

      {error ? <span className="selection-action-bar__error">{error}</span> : null}
    </section>
  );
}

function CollectionEmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="archive-state">
      <span className="archive-state__kicker">empty collection</span>
      <h2 className="archive-state__title">This collection is empty.</h2>
      <div className="collection-workspace__empty-actions">
        <button className="text-button" type="button" onClick={onBack}>
          Add items
        </button>
        <button className="text-button" type="button" onClick={onBack}>
          Back to Gallery
        </button>
      </div>
    </div>
  );
}

function CollectionFilteredEmptyState({
  hasActiveFilters,
  onBack,
  onClearFilters,
}: {
  hasActiveFilters: boolean;
  onBack: () => void;
  onClearFilters: () => void;
}) {
  if (hasActiveFilters) {
    return (
      <div className="archive-state">
        <span className="archive-state__kicker">empty set</span>
        <h2 className="archive-state__title">No items match these filters inside this collection.</h2>
        <button className="text-button" type="button" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }

  return <CollectionEmptyState onBack={onBack} />;
}

function toCollectionItemCard({
  collectionId,
  isSelected,
  item,
  onOpenItem,
  onSelectToggle,
}: {
  collectionId: string;
  isSelected: boolean;
  item: CollectionDetailItem;
  onOpenItem?: (itemId: string, collectionId: string) => void;
  onSelectToggle: (itemId: string) => void;
}): ItemCardProps {
  return {
    id: item.id,
    type: item.type,
    status: item.status as ItemStatus,
    source: item.source.kind,
    usageCount: 0,
    createdAt: item.createdAt,
    title: item.title,
    imageUrl: item.imageUrl,
    captionText: item.captionText,
    noteParagraph: item.noteParagraph,
    url: item.url,
    linkContentType: item.linkContentType,
    ogImageUrl: item.ogImageUrl,
    ogTitle: item.ogTitle,
    assetFileUrl: item.assetFileUrl,
    assetMimeType: item.assetMimeType,
    isSelected,
    detailHref: buildCollectionItemHref(item.id, collectionId),
    onNavigate: onOpenItem ? (itemId) => onOpenItem(itemId, collectionId) : undefined,
    onSelectToggle,
  };
}

function filterAndSortCollectionItems(
  items: CollectionDetailItem[],
  {
    kindFilter,
    query,
    sort,
    sourceFilter,
    stateFilter,
  }: {
    kindFilter: CollectionKindFilter;
    query: string;
    sort: CollectionSort;
    sourceFilter: string;
    stateFilter: CollectionStateFilter;
  },
) {
  const normalizedQuery = query.trim().toLowerCase();

  return items
    .filter((item) => {
      if (kindFilter !== "all" && !matchesKindFilter(item, kindFilter)) {
        return false;
      }

      if (stateFilter !== "all" && item.status !== stateFilter) {
        return false;
      }

      if (sourceFilter !== "all" && item.source.kind !== sourceFilter) {
        return false;
      }

      if (normalizedQuery && !getCollectionItemSearchText(item).includes(normalizedQuery)) {
        return false;
      }

      return true;
    })
    .sort((firstItem, secondItem) => compareCollectionItems(firstItem, secondItem, sort));
}

function matchesKindFilter(item: CollectionDetailItem, kindFilter: CollectionKindFilter) {
  if (kindFilter === "pdf") {
    return item.type === "link" && item.linkContentType === "pdf";
  }

  if (kindFilter === "video") {
    return item.type === "link" && item.linkContentType === "video";
  }

  if (kindFilter === "website") {
    return item.type === "link" && (!item.linkContentType || item.linkContentType === "website" || item.linkContentType === "unknown");
  }

  return item.type === kindFilter;
}

function compareCollectionItems(firstItem: CollectionDetailItem, secondItem: CollectionDetailItem, sort: CollectionSort) {
  if (sort === "title") {
    return getCollectionItemTitle(firstItem).localeCompare(getCollectionItemTitle(secondItem));
  }

  const firstTime = Date.parse(firstItem.addedAt || firstItem.createdAt);
  const secondTime = Date.parse(secondItem.addedAt || secondItem.createdAt);
  const firstValue = Number.isFinite(firstTime) ? firstTime : 0;
  const secondValue = Number.isFinite(secondTime) ? secondTime : 0;

  return sort === "oldest" ? firstValue - secondValue : secondValue - firstValue;
}

function getCollectionItemSearchText(item: CollectionDetailItem) {
  return [
    item.title,
    item.description,
    item.summary,
    item.captionText,
    item.noteParagraph,
    item.url,
    item.ogTitle,
    item.source.kind,
    item.source.label,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

function getCollectionItemTitle(item: CollectionDetailItem) {
  return item.title || item.ogTitle || item.url || item.captionText || item.noteParagraph || item.type;
}

function buildCollectionPreviewItems(items: CollectionDetailItem[]): CollectionCardPreviewItem[] {
  return [...items]
    .sort((firstItem, secondItem) => getPreviewRank(firstItem) - getPreviewRank(secondItem))
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title ?? item.ogTitle,
      kind: item.type,
      format: item.linkContentType,
      imageUrl: item.imageUrl,
      ogImageUrl: item.ogImageUrl,
      textPreview: item.captionText ?? item.noteParagraph ?? item.summary ?? item.url,
      sourceUrl: item.url,
      source: item.source.kind,
    }));
}

function getPreviewRank(item: CollectionDetailItem) {
  if (item.type === "image" && item.imageUrl) {
    return 0;
  }

  if (item.ogImageUrl) {
    return 1;
  }

  if (item.linkContentType === "pdf") {
    return 2;
  }

  return 3;
}

function renderCoverTiles(items: CollectionCardPreviewItem[]) {
  const slots = [...items];
  while (slots.length < 4) {
    slots.push({ id: `empty-slot-${slots.length}`, kind: "empty", textPreview: "" });
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

function formatOptionLabel(value: string) {
  if (value === "all") {
    return "Any";
  }

  if (value === "pdf") {
    return "PDF";
  }

  return value.replace(/_/g, " ");
}

function getInitialCollectionQuery() {
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
}

function getInitialKindFilter(): CollectionKindFilter {
  const value = new URLSearchParams(window.location.search).get("type");
  return collectionKindOptions.includes(value as CollectionKindFilter) ? (value as CollectionKindFilter) : "all";
}

function getInitialStateFilter(): CollectionStateFilter {
  const value = new URLSearchParams(window.location.search).get("status");
  return collectionStateOptions.includes(value as CollectionStateFilter) ? (value as CollectionStateFilter) : "all";
}

function getInitialSourceFilter() {
  return new URLSearchParams(window.location.search).get("source")?.trim() || "all";
}

function getInitialSort(): CollectionSort {
  const value = new URLSearchParams(window.location.search).get("sort");
  return collectionSortOptions.includes(value as CollectionSort) ? (value as CollectionSort) : "newest";
}

function buildCollectionFilterUrl(
  collectionId: string,
  {
    kindFilter,
    query,
    sort,
    sourceFilter,
    stateFilter,
  }: {
    kindFilter: CollectionKindFilter;
    query: string;
    sort: CollectionSort;
    sourceFilter: string;
    stateFilter: CollectionStateFilter;
  },
) {
  const searchParams = new URLSearchParams();

  if (query.trim()) {
    searchParams.set("q", query.trim());
  }

  if (kindFilter !== "all") {
    searchParams.set("type", kindFilter);
  }

  if (stateFilter !== "all") {
    searchParams.set("status", stateFilter);
  }

  if (sourceFilter !== "all") {
    searchParams.set("source", sourceFilter);
  }

  if (sort !== "newest") {
    searchParams.set("sort", sort);
  }

  const search = searchParams.toString();
  return `/collections/${encodeURIComponent(collectionId)}${search ? `?${search}` : ""}`;
}

function formatDate(value: string) {
  return value.slice(0, 10);
}

function buildCollectionItemHref(itemId: string, collectionId: string) {
  const searchParams = new URLSearchParams({ return_collection: collectionId });
  return `/items/${encodeURIComponent(itemId)}?${searchParams.toString()}`;
}

function getCollectionLoadErrorDisplay(message: string) {
  const [title, ...copyParts] = message.split("\n");

  return {
    title: title || "Collection could not be loaded.",
    copy: copyParts.join(" ") || "Refresh the page or check the PocketBase logs.",
  };
}
