import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import type { ItemStatus, ItemType } from "../atoms";
import { MasonryGrid } from "../items";
import type { ArchiveObject, ItemCardProps } from "../items";
import type { CollectionCardPreviewItem } from "../items/CollectionCard";
import { ArchiveReturnButton } from "../ui/ArchiveControls";
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
  onCreateNoteInCollection?: (input: { collectionId: string; body: string }) => Promise<void>;
  onDeleteItem?: (itemId: string, collectionId: string) => Promise<void> | void;
  onImportFilesToCollection?: (input: { collectionId: string; files: File[] }) => Promise<void>;
  onOpenItem?: (itemId: string, collectionId: string) => void;
  onRemoveItemsFromCollection: (input: { collectionId: string; itemIds: string[] }) => Promise<void>;
  onUpdateCollection?: (input: { collectionId: string; description: string | null; name: string }) => Promise<void>;
  collectionUpdatePending?: boolean;
  collectionUpdateError?: string | null;
};

type CollectionKindFilter = ItemType | "pdf" | "video" | "website" | "all";
type CollectionStateFilter = ItemStatus | "all";
type CollectionSort = "newest" | "oldest" | "title";

const maxCollectionTitleLength = 50;

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
  onCreateNoteInCollection,
  onDeleteItem,
  onImportFilesToCollection,
  onOpenItem,
  onRemoveItemsFromCollection,
  onUpdateCollection,
  collectionUpdatePending = false,
  collectionUpdateError = null,
}: CollectionViewProps) {
  const [query, setQuery] = useState(() => getInitialCollectionQuery());
  const [kindFilter, setKindFilter] = useState<CollectionKindFilter>(() => getInitialKindFilter());
  const [stateFilter, setStateFilter] = useState<CollectionStateFilter>(() => getInitialStateFilter());
  const [sourceFilter, setSourceFilter] = useState(() => getInitialSourceFilter());
  const [sort, setSort] = useState<CollectionSort>(() => getInitialSort());
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionPending, setSelectionPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPending, setUploadPending] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [notePending, setNotePending] = useState(false);

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
  const importFiles = async (files: File[]) => {
    if (!collection || files.length === 0 || uploadPending) {
      return;
    }

    if (!onImportFilesToCollection) {
      setUploadError("Live archive mode required.");
      return;
    }

    setUploadPending(true);
    setUploadError(null);
    try {
      await onImportFilesToCollection({ collectionId: collection.id, files });
    } catch (importError: unknown) {
      console.error(importError);
      setUploadError("Unable to add files to this collection.");
    } finally {
      setUploadPending(false);
    }
  };
  const createNote = async (body: string) => {
    if (!collection || notePending) {
      return;
    }

    if (!onCreateNoteInCollection) {
      setNoteError("Live archive mode required.");
      return;
    }

    setNotePending(true);
    setNoteError(null);
    try {
      await onCreateNoteInCollection({ collectionId: collection.id, body });
    } catch (noteCreateError: unknown) {
      console.error(noteCreateError);
      setNoteError("Unable to add note to this collection.");
      throw noteCreateError;
    } finally {
      setNotePending(false);
    }
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
      onDeleteItem,
      onOpenItem,
      onSelectToggle: toggleSelection,
    }),
  }));
  const uploadTile = (
    <CollectionUploadTile
      error={uploadError ?? noteError}
      filePending={uploadPending}
      notePending={notePending}
      onCreateNote={createNote}
      onImportFiles={importFiles}
    />
  );

  return (
    <article className="collection-view collection-workspace" aria-labelledby="collection-title">
      <CollectionTopBar onBack={onBack} />
      <header className="collection-workspace__header">
        <CollectionWorkspaceCover collection={collection} />
        <div className="collection-workspace__intro">
          <CollectionHeaderMeta collection={collection} />
          <EditableCollectionIdentity
            collection={collection}
            error={collectionUpdateError}
            onUpdateCollection={onUpdateCollection}
            pending={collectionUpdatePending}
          />
        </div>
      </header>

      {collection.items.length > 0 ? (
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
      ) : null}
      <MasonryGrid
        ariaLabel={`${collection.name} items`}
        className="collection-workspace__grid"
        columns={4}
        density="comfortable"
        leadingTile={uploadTile}
        objects={archiveObjects}
        emptyState={
          <CollectionFilteredEmptyState
            hasActiveFilters={hasActiveFilters}
            onBack={onBack}
            onClearFilters={clearFilters}
          />
        }
      />

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
      <ArchiveReturnButton onClick={onBack} ariaLabel="Return to archive" />
    </div>
  );
}

function CollectionHeaderMeta({ collection }: { collection: CollectionDetail }) {
  return (
    <div className="collection-workspace__meta-row" aria-label="collection metadata">
      <CollectionCountPill count={collection.pieceCount} kindSummary={collection.kindSummary} />
      <span className="collection-workspace__date-pill">Created {formatDisplayDate(collection.createdAt)}</span>
      <span className="collection-workspace__date-pill">Updated {formatDisplayDate(collection.lastUpdatedAt)}</span>
    </div>
  );
}

function CollectionCountPill({ count, kindSummary }: { count: number; kindSummary: string }) {
  const countLabel = `${count} ${count === 1 ? "item" : "items"}`;
  const summary = kindSummary.trim();

  return (
    <span className="collection-workspace__count-pill" aria-label={summary ? `${countLabel}: ${summary}` : countLabel}>
      <span className="collection-workspace__count-label">{countLabel}</span>
      {summary ? (
        <span className="collection-workspace__count-extra" aria-hidden="true">
          <span className="collection-workspace__count-divider" />
          <span>{summary}</span>
        </span>
      ) : null}
    </span>
  );
}

function EditableCollectionIdentity({
  collection,
  error,
  onUpdateCollection,
  pending,
}: {
  collection: CollectionDetail;
  error: string | null;
  onUpdateCollection?: (input: { collectionId: string; description: string | null; name: string }) => Promise<void>;
  pending: boolean;
}) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const initialNameRef = useRef(collection.name);
  const initialDescriptionRef = useRef(collection.description ?? "");
  const trimmedName = name.trim();
  const normalizedDescription = description.trim();
  const isDirty =
    trimmedName !== initialNameRef.current ||
    normalizedDescription !== initialDescriptionRef.current;
  const canSave = trimmedName.length > 0 && isDirty && !pending;

  useEffect(() => {
    initialNameRef.current = collection.name;
    initialDescriptionRef.current = collection.description ?? "";
    setName(collection.name);
    setDescription(collection.description ?? "");
    setIsEditing(false);
    setLocalError(null);
  }, [collection.description, collection.id, collection.name]);

  const save = async () => {
    if (!canSave) {
      return;
    }

    if (!onUpdateCollection) {
      setLocalError("Live archive mode required.");
      return;
    }

    setLocalError(null);
    await onUpdateCollection({
      collectionId: collection.id,
      name: trimmedName,
      description: normalizedDescription || null,
    });
    initialNameRef.current = trimmedName;
    initialDescriptionRef.current = normalizedDescription;
    setIsEditing(false);
  };
  const cancel = () => {
    setName(initialNameRef.current);
    setDescription(initialDescriptionRef.current);
    setIsEditing(false);
    setLocalError(null);
  };
  const onTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void save();
      event.currentTarget.blur();
    }
  };
  const onDescriptionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <div className="collection-title-editor" data-dirty={isDirty ? "true" : "false"} data-editing={isEditing ? "true" : "false"}>
      <div className="collection-title-editor__header">
        <h1 id="collection-title" title={collection.name}>
          {isEditing ? (
            <input
              aria-label="collection title"
              autoFocus
              disabled={pending}
              maxLength={maxCollectionTitleLength}
              onChange={(event) => setName(event.target.value.slice(0, maxCollectionTitleLength))}
              onKeyDown={onTitleKeyDown}
              value={name}
            />
          ) : (
            <span>{collection.name}</span>
          )}
        </h1>
        <div className="collection-title-editor__controls" aria-label="collection title editing controls">
          {isEditing ? (
            <>
              <button disabled={!canSave} type="button" onClick={() => void save()}>
                {pending ? "Saving" : "Save"}
              </button>
              <button disabled={pending || !isDirty} type="button" onClick={cancel}>
                Cancel
              </button>
            </>
          ) : (
            <button disabled={pending || !onUpdateCollection} type="button" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>
      {isEditing ? (
        <textarea
          aria-label="collection description"
          disabled={pending}
          onChange={(event) => setDescription(event.target.value)}
          onKeyDown={onDescriptionKeyDown}
          placeholder="Add a description..."
          rows={description.trim().length > 88 ? 3 : 1}
          value={description}
        />
      ) : (
        <p className="collection-title-editor__description">
          {collection.description?.trim() || "Add a description..."}
        </p>
      )}
      {localError || error ? <p className="collection-title-editor__error">{localError ?? error}</p> : null}
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
    </div>
  );
}

function CollectionUploadTile({
  error,
  filePending,
  notePending,
  onCreateNote,
  onImportFiles,
}: {
  error: string | null;
  filePending: boolean;
  notePending: boolean;
  onCreateNote: (body: string) => Promise<void>;
  onImportFiles: (files: File[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [mode, setMode] = useState<"choice" | "note">("choice");
  const [noteBody, setNoteBody] = useState("");
  const pending = filePending || notePending;
  const canSaveNote = noteBody.trim().length > 0 && !pending;

  const importFileList = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length > 0) {
      onImportFiles(files);
    }
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    importFileList(event.target.files);
    event.target.value = "";
  };
  const hasDraggedFiles = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes("Files");
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    if (!pending) {
      setIsFileDragging(true);
    }
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    setIsFileDragging(false);
    if (!pending) {
      importFileList(event.dataTransfer.files);
    }
  };
  const submitNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSaveNote) {
      return;
    }

    await onCreateNote(noteBody.trim());
    setNoteBody("");
    setMode("choice");
  };
  const onNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      setMode("choice");
      setNoteBody("");
    }
  };

  return (
    <div
      id="add-to-collection"
      className="collection-upload-tile"
      data-dragging={isFileDragging ? "true" : "false"}
      data-mode={mode}
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        const relatedTarget = event.relatedTarget;
        if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
          setIsFileDragging(false);
        }
      }}
      onDrop={onDrop}
    >
      <div className="collection-upload-tile__surface">
        <span className="collection-upload-tile__icon" aria-hidden="true">{isFileDragging ? "↓" : "+"}</span>
        {mode === "note" ? (
          <form className="collection-upload-tile__note-form" onSubmit={submitNote}>
            <textarea
              aria-label="new note for this collection"
              autoFocus
              disabled={pending}
              onChange={(event) => setNoteBody(event.target.value)}
              onKeyDown={onNoteKeyDown}
              placeholder="Write a note for this collection"
              value={noteBody}
            />
            <div className="collection-upload-tile__actions">
              <button type="button" disabled={pending} onClick={() => {
                setMode("choice");
                setNoteBody("");
              }}>
                Cancel
              </button>
              <button type="submit" disabled={!canSaveNote}>
                {notePending ? "Saving" : "Save note"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <strong>{isFileDragging ? "Release into this set" : "Add to the collection"}</strong>
            <small>{isFileDragging ? "Files attach to this collection" : "Import files or write a note in place"}</small>
            <div className="collection-upload-tile__actions">
              <button disabled={pending} type="button" onClick={() => fileInputRef.current?.click()}>
                Files
              </button>
              <button disabled={pending} type="button" onClick={() => setMode("note")}>
                Note
              </button>
            </div>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        aria-label="upload files to this collection"
        hidden
        multiple
        accept="image/*,application/pdf,video/*"
        type="file"
        onChange={onChange}
      />
      {error ? <span className="collection-upload-tile__error">{error}</span> : null}
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
        className="collection-workspace__search"
        aria-label="search within this collection"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search this collection"
        type="search"
        value={query}
      />
      <div className="collection-workspace__tool-group">
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
      </div>
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
            maxLength={maxCollectionTitleLength}
            onChange={(event) => setName(event.target.value.slice(0, maxCollectionTitleLength))}
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
  onDeleteItem,
  onOpenItem,
  onSelectToggle,
}: {
  collectionId: string;
  isSelected: boolean;
  item: CollectionDetailItem;
  onDeleteItem?: (itemId: string, collectionId: string) => Promise<void> | void;
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
    imageWidth: item.imageWidth,
    imageHeight: item.imageHeight,
    aspectRatio: item.aspectRatio,
    captionText: item.captionText,
    noteParagraph: item.noteParagraph,
    url: item.url,
    linkContentType: item.linkContentType,
    ogImageUrl: item.ogImageUrl,
    ogTitle: item.ogTitle,
    assetFileUrl: item.assetFileUrl,
    assetMimeType: item.assetMimeType,
    previewUrl: item.previewUrl,
    thumbnailUrl: item.thumbnailUrl,
    videoPosterUrl: item.videoPosterUrl,
    mediaPreview: item.mediaPreview,
    isSelected,
    detailHref: buildCollectionItemHref(item.id, collectionId),
    onDelete: onDeleteItem ? (itemId) => onDeleteItem(itemId, collectionId) : undefined,
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
    return item.type === "video" || (item.type === "link" && item.linkContentType === "video");
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
      thumbnailUrl: item.thumbnailUrl ?? item.imageUrl ?? item.videoPosterUrl ?? item.ogImageUrl,
      previewUrl: item.previewUrl,
      imageUrl: item.imageUrl,
      ogImageUrl: item.ogImageUrl,
      videoPosterUrl: item.videoPosterUrl,
      width: item.imageWidth,
      height: item.imageHeight,
      aspectRatio: item.aspectRatio,
      textPreview: item.captionText ?? item.noteParagraph ?? item.summary ?? item.url,
      sourceUrl: item.url,
      source: item.source.kind,
    }));
}

function getPreviewRank(item: CollectionDetailItem) {
  if (item.type === "image" && item.imageUrl) {
    return 0;
  }

  if (item.type === "video" && item.videoPosterUrl) {
    return 1;
  }

  if (item.ogImageUrl) {
    return 2;
  }

  if (item.linkContentType === "pdf") {
    return 3;
  }

  return 4;
}

function renderCoverTiles(items: CollectionCardPreviewItem[]) {
  const slots = [...items];
  while (slots.length < 4) {
    slots.push({ id: `empty-slot-${slots.length}`, kind: "empty", textPreview: "" });
  }

  return slots.map((item, index) => {
    const imageUrl = item.thumbnailUrl || item.imageUrl || item.ogImageUrl || item.videoPosterUrl || null;

    if (imageUrl) {
      return (
        <span className="collection-card__preview-tile collection-card__preview-tile--visual" key={`${item.id}:${index}`}>
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={item.width ?? undefined}
            height={item.height ?? undefined}
          />
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
        {getPreviewText(item) ? <small>{getPreviewText(item)}</small> : null}
      </span>
    );
  });
}

function getPreviewText(item: CollectionCardPreviewItem) {
  const text = item.title || item.textPreview || getDomain(item.sourceUrl) || "";
  return text.trim();
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
  const returnTo = new URLSearchParams(window.location.search).get("return_to")?.trim();

  if (returnTo) {
    searchParams.set("return_to", returnTo);
  }

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

function formatDisplayDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
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
