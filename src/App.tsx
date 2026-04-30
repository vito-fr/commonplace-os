import { useEffect, useState, type FormEvent } from "react";
import type { ItemStatus, ItemType } from "./components/atoms";
import { MasonryGrid } from "./components/items";
import type { ItemCardProps } from "./components/items";
import { ItemDetailView } from "./components/items/ItemDetail";
import type { ItemCardFilters, ItemCardReader, ItemSourceFilter } from "./data/itemCardReader";
import { createPocketBaseItemCaptureWriter } from "./data/pocketBaseItemCapture";
import {
  createPocketBaseItemCampaignClient,
  type CampaignOption,
} from "./data/pocketBaseItemCampaign";
import {
  createPocketBaseItemCollectionClient,
  type CollectionOption,
} from "./data/pocketBaseItemCollection";
import type { ItemDetail } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemDetailReader } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemCardReader } from "./data/pocketBaseItemCards";
import { createPocketBaseItemRelationshipWriter } from "./data/pocketBaseItemRelationship";
import { createPocketBaseItemRetirementWriter } from "./data/pocketBaseItemRetirement";
import { createPocketBaseItemStatusWriter } from "./data/pocketBaseItemStatus";
import { seedFixtureItemCardReader } from "./data/seedItemCards";

type AppRoute = { kind: "grid" } | { kind: "item"; itemId: string };
type ArchiveStatusFilter = ItemStatus | "all";
type ArchiveTypeFilter = ItemType | "all";
type ArchiveSourceFilter = ItemSourceFilter | "all";

const statusFilterOptions: ArchiveStatusFilter[] = [
  "all",
  "inbox",
  "triaged",
  "active",
  "archived",
  "retired",
];
const typeFilterOptions: ArchiveTypeFilter[] = [
  "all",
  "image",
  "caption",
  "note",
  "link",
  "campaign",
];
const sourceFilterOptions: ArchiveSourceFilter[] = [
  "all",
  "pinterest",
  "arena",
  "url",
  "local",
  "ios_capture",
  "manual",
];

const workspaceId = "seed:ws001";
const readerMode = import.meta.env.VITE_ITEM_CARD_READER;
const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL ?? "http://127.0.0.1:8090";
const isPocketBaseMode = readerMode === "pocketbase";
const itemCardReader: ItemCardReader =
  isPocketBaseMode
    ? createPocketBaseItemCardReader({
        baseUrl: pocketBaseUrl,
      })
    : seedFixtureItemCardReader;
const itemCaptureWriter = createPocketBaseItemCaptureWriter({ baseUrl: pocketBaseUrl });
const itemCampaignClient = createPocketBaseItemCampaignClient({ baseUrl: pocketBaseUrl });
const itemCollectionClient = createPocketBaseItemCollectionClient({ baseUrl: pocketBaseUrl });
const itemDetailReader = createPocketBaseItemDetailReader({ baseUrl: pocketBaseUrl });
const itemRelationshipWriter = createPocketBaseItemRelationshipWriter({ baseUrl: pocketBaseUrl });
const itemRetirementWriter = createPocketBaseItemRetirementWriter({ baseUrl: pocketBaseUrl });
const itemStatusWriter = createPocketBaseItemStatusWriter({ baseUrl: pocketBaseUrl });

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [items, setItems] = useState<ItemCardProps[]>([]);
  const [itemCardFilters, setItemCardFilters] = useState<ItemCardFilters>(() => getFiltersFromLocation());
  const [isLoading, setIsLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [collectionOptions, setCollectionOptions] = useState<CollectionOption[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isCampaignAttaching, setIsCampaignAttaching] = useState(false);
  const [campaignWriteError, setCampaignWriteError] = useState<string | null>(null);
  const [isCollectionAttaching, setIsCollectionAttaching] = useState(false);
  const [collectionWriteError, setCollectionWriteError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusWriteError, setStatusWriteError] = useState<string | null>(null);
  const [isRelationshipCreating, setIsRelationshipCreating] = useState(false);
  const [relationshipWriteError, setRelationshipWriteError] = useState<string | null>(null);
  const [isRetiringWithReplacement, setIsRetiringWithReplacement] = useState(false);
  const [retirementWriteError, setRetirementWriteError] = useState<string | null>(null);

  useEffect(() => {
    const syncRoute = () => {
      setRoute(getRouteFromLocation());
      setItemCardFilters(getFiltersFromLocation());
    };

    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    const nextUrl =
      route.kind === "item"
        ? buildItemDetailUrl(route.itemId, itemCardFilters)
        : buildArchiveUrl(itemCardFilters);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [itemCardFilters, route]);

  useEffect(() => {
    let isCurrent = true;

    setIsLoading(true);
    itemCardReader
      .listItemCards({ workspaceId, filters: itemCardFilters })
      .then((nextItems) => {
        if (isCurrent) {
          setItems(nextItems);
          setReadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          console.error(error);
          setItems([]);
          setReadError("Unable to load archive items.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [itemCardFilters]);

  useEffect(() => {
    let isCurrent = true;

    if (route.kind !== "item") {
      setDetail(null);
      setCampaignOptions([]);
      setCollectionOptions([]);
      setDetailError(null);
      setIsDetailLoading(false);
      setCampaignWriteError(null);
      setIsCampaignAttaching(false);
      setCollectionWriteError(null);
      setIsCollectionAttaching(false);
      setStatusWriteError(null);
      setIsStatusUpdating(false);
      setRelationshipWriteError(null);
      setIsRelationshipCreating(false);
      setRetirementWriteError(null);
      setIsRetiringWithReplacement(false);
      return () => {
        isCurrent = false;
      };
    }

    if (!isPocketBaseMode) {
      setDetail(null);
      setCampaignOptions([]);
      setCollectionOptions([]);
      setDetailError("Item detail requires live archive mode.");
      setIsDetailLoading(false);
      setCampaignWriteError(null);
      setIsCampaignAttaching(false);
      setCollectionWriteError(null);
      setIsCollectionAttaching(false);
      setStatusWriteError(null);
      setIsStatusUpdating(false);
      setRelationshipWriteError(null);
      setIsRelationshipCreating(false);
      setRetirementWriteError(null);
      setIsRetiringWithReplacement(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsDetailLoading(true);
    setDetailError(null);
    setCampaignWriteError(null);
    setCollectionWriteError(null);
    setStatusWriteError(null);
    setRelationshipWriteError(null);
    setRetirementWriteError(null);

    itemDetailReader
      .getItemDetail({ workspaceId, itemId: route.itemId })
      .then(async (nextDetail) => {
        if (isCurrent) {
          setDetail(nextDetail);
        }

        try {
          const [nextCollectionOptions, nextCampaignOptions] = await Promise.all([
            itemCollectionClient.listCollectionOptions({
              workspaceId,
              itemId: route.itemId,
            }),
            itemCampaignClient.listCampaignOptions({
              workspaceId,
              itemId: route.itemId,
            }),
          ]);
          if (isCurrent) {
            setCollectionOptions(nextCollectionOptions);
            setCampaignOptions(nextCampaignOptions);
          }
        } catch (error: unknown) {
          if (isCurrent) {
            console.error(error);
            setCampaignOptions([]);
            setCollectionOptions([]);
            setCampaignWriteError("Unable to load campaign options.");
            setCollectionWriteError("Unable to load collection options.");
          }
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          console.error(error);
          setDetail(null);
          setCampaignOptions([]);
          setCollectionOptions([]);
          setDetailError("Unable to load item detail.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [route]);

  const openItemDetail = (itemId: string) => {
    window.history.pushState(null, "", buildItemDetailUrl(itemId, itemCardFilters));
    setRoute({ kind: "item", itemId });
  };

  const closeItemDetail = () => {
    window.history.pushState(null, "", buildArchiveUrl(itemCardFilters));
    setRoute({ kind: "grid" });
  };

  const changeItemStatus = async (nextStatus: ItemDetail["status"]) => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsStatusUpdating(true);
    setStatusWriteError(null);

    try {
      await itemStatusWriter.updateItemStatus({
        workspaceId,
        itemId: detail.id,
        nextStatus,
        actor: "system",
      });

      const [nextDetail, nextItems] = await Promise.all([
        itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id }),
        itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters }),
      ]);
      setDetail(nextDetail);
      setItems(nextItems);
    } catch (error: unknown) {
      console.error(error);
      setStatusWriteError("Unable to change item status.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const retireItemWithReplacement = async ({ replacementId }: { replacementId: string }) => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsRetiringWithReplacement(true);
    setRetirementWriteError(null);

    try {
      await itemRetirementWriter.retireWithReplacement({
        workspaceId,
        itemId: detail.id,
        replacementId,
        actor: "system",
      });

      const [nextDetail, nextItems] = await Promise.all([
        itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id }),
        itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters }),
      ]);
      setDetail(nextDetail);
      setItems(nextItems);
    } catch (error: unknown) {
      console.error(error);
      setRetirementWriteError("Unable to retire with replacement.");
      throw error;
    } finally {
      setIsRetiringWithReplacement(false);
    }
  };

  const createItemRelationship = async ({ toId, note }: { toId: string; note: string | null }) => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsRelationshipCreating(true);
    setRelationshipWriteError(null);

    try {
      await itemRelationshipWriter.createRelationship({
        workspaceId,
        fromId: detail.id,
        toId,
        type: "references",
        note: note ?? undefined,
        actor: "system",
      });

      const nextDetail = await itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id });
      setDetail(nextDetail);
    } catch (error: unknown) {
      console.error(error);
      setRelationshipWriteError("Unable to add relationship.");
      throw error;
    } finally {
      setIsRelationshipCreating(false);
    }
  };

  const attachItemToCollection = async ({ collectionId }: { collectionId: string }) => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsCollectionAttaching(true);
    setCollectionWriteError(null);

    try {
      await itemCollectionClient.attachCollection({
        workspaceId,
        itemId: detail.id,
        collectionId,
        actor: "system",
      });

      const [nextDetail, nextCollectionOptions] = await Promise.all([
        itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id }),
        itemCollectionClient.listCollectionOptions({ workspaceId, itemId: detail.id }),
      ]);
      setDetail(nextDetail);
      setCollectionOptions(nextCollectionOptions);
    } catch (error: unknown) {
      console.error(error);
      setCollectionWriteError("Unable to attach collection.");
      throw error;
    } finally {
      setIsCollectionAttaching(false);
    }
  };

  const attachItemToCampaign = async ({
    campaignId,
    role,
    rightsOverrideNote,
  }: {
    campaignId: string;
    role: "primary" | "supporting" | "reference";
    rightsOverrideNote: string | null;
  }) => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsCampaignAttaching(true);
    setCampaignWriteError(null);

    try {
      await itemCampaignClient.attachCampaign({
        workspaceId,
        itemId: detail.id,
        campaignId,
        role,
        rightsOverrideNote: rightsOverrideNote ?? undefined,
        actor: "system",
      });

      const [nextDetail, nextCampaignOptions, nextItems] = await Promise.all([
        itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id }),
        itemCampaignClient.listCampaignOptions({ workspaceId, itemId: detail.id }),
        itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters }),
      ]);
      setDetail(nextDetail);
      setCampaignOptions(nextCampaignOptions);
      setItems(nextItems);
    } catch (error: unknown) {
      console.error(error);
      setCampaignWriteError("Unable to attach campaign.");
      throw error;
    } finally {
      setIsCampaignAttaching(false);
    }
  };

  const captureNote = async (body: string) => {
    if (!isPocketBaseMode) {
      return;
    }

    setIsCapturing(true);
    setCaptureError(null);
    setCaptureNotice(null);

    try {
      await itemCaptureWriter.captureNote({
        workspaceId,
        type: "note",
        body,
        sourceExternalId: captureSourceExternalId(),
        actor: "system",
      });
      const nextItems = await itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters });
      setItems(nextItems);
      setReadError(null);
      setCaptureNotice("Captured to inbox.");
    } catch (error: unknown) {
      console.error(error);
      setCaptureError("Unable to capture note.");
      throw error;
    } finally {
      setIsCapturing(false);
    }
  };

  const updateStatusFilter = (status: ArchiveStatusFilter) => {
    setItemCardFilters((currentFilters) => ({
      ...currentFilters,
      status: status === "all" ? undefined : status,
    }));
  };

  const updateTypeFilter = (type: ArchiveTypeFilter) => {
    setItemCardFilters((currentFilters) => ({
      ...currentFilters,
      type: type === "all" ? undefined : type,
    }));
  };

  const updateSourceFilter = (source: ArchiveSourceFilter) => {
    setItemCardFilters((currentFilters) => ({
      ...currentFilters,
      source: source === "all" ? undefined : source,
    }));
  };

  const updateTextFilter = (text: string) => {
    setItemCardFilters((currentFilters) => ({
      ...currentFilters,
      text: text === "" ? undefined : text,
    }));
  };

  const clearArchiveFilters = () => {
    setItemCardFilters({});
  };

  if (route.kind === "item") {
    const currentItemId = detail?.id ?? route.itemId;
    const relationshipTargetOptions = items
      .filter((item) => item.id !== currentItemId)
      .map((item) => ({
        id: item.id,
        label: item.title ?? `${item.type} item`,
      }));
    const replacementTargetOptions = items
      .filter((item) => item.id !== currentItemId && item.status !== "retired")
      .map((item) => ({
        id: item.id,
        label: item.title ?? `${item.type} item`,
      }));
    const collectionTargetOptions = collectionOptions.map((collection) => ({
      id: collection.id,
      label: collection.name,
      alreadyAttached: collection.alreadyAttached,
    }));
    const campaignTargetOptions = campaignOptions.map((campaign) => ({
      id: campaign.id,
      label: campaign.title ?? `${campaign.phase ?? campaign.status} campaign`,
      phase: campaign.phase,
      alreadyAttached: campaign.alreadyAttached,
    }));

    return (
      <main className="app-shell" aria-label="Vita archive">
        <ItemDetailView
          item={detail}
          loading={isDetailLoading}
          error={detailError}
          onBack={closeItemDetail}
          onOpenRelatedItem={openItemDetail}
          onChangeStatus={changeItemStatus}
          statusActionPending={isStatusUpdating || isRetiringWithReplacement}
          statusActionError={statusWriteError}
          onRetireWithReplacement={retireItemWithReplacement}
          retirementActionPending={isRetiringWithReplacement || isStatusUpdating}
          retirementActionError={retirementWriteError}
          retirementTargetOptions={replacementTargetOptions}
          onCreateRelationship={createItemRelationship}
          relationshipActionPending={isRelationshipCreating}
          relationshipActionError={relationshipWriteError}
          relationshipTargetOptions={relationshipTargetOptions}
          onAttachCollection={attachItemToCollection}
          collectionActionPending={isCollectionAttaching}
          collectionActionError={collectionWriteError}
          collectionOptions={collectionTargetOptions}
          onAttachCampaign={attachItemToCampaign}
          campaignActionPending={isCampaignAttaching}
          campaignActionError={campaignWriteError}
          campaignOptions={campaignTargetOptions}
        />
      </main>
    );
  }

  const renderedItems = isPocketBaseMode
    ? items.map((item) => ({
        ...item,
        detailHref: buildItemDetailUrl(item.id, itemCardFilters),
        onNavigate: openItemDetail,
      }))
    : items;
  const archiveModeLabel = isPocketBaseMode ? "live archive" : "seed fixtures";

  return (
    <main className="app-shell" aria-label="Vita archive">
      <section className="proof-panel" aria-labelledby="proof-title">
        <p className="proof-kicker">archive</p>
        <h1 id="proof-title">Archive</h1>
        <ArchiveUsageSummary
          captureEnabled={isPocketBaseMode}
          filters={itemCardFilters}
          itemCount={items.length}
          loading={isLoading}
          modeLabel={archiveModeLabel}
          readError={readError}
        />
        {isPocketBaseMode ? (
          <CaptureNoteForm
            error={captureError}
            notice={captureNotice}
            onCapture={captureNote}
            pending={isCapturing}
          />
        ) : null}
        <ArchiveFilterControls
          filters={itemCardFilters}
          loading={isLoading}
          onClearFilters={clearArchiveFilters}
          onSourceChange={updateSourceFilter}
          onStatusChange={updateStatusFilter}
          onTextChange={updateTextFilter}
          onTypeChange={updateTypeFilter}
        />
        {isLoading ? <ArchiveLoadingState filters={itemCardFilters} /> : null}
        <ArchiveResultHeader
          filters={itemCardFilters}
          itemCount={items.length}
          loading={isLoading}
          readError={readError}
        />
        <MasonryGrid
          items={renderedItems}
          density="comfortable"
          loading={isLoading}
          emptyState={
            <ArchiveEmptyState
              filters={itemCardFilters}
              readError={readError}
              onClearFilters={clearArchiveFilters}
            />
          }
          ariaLabel="archive items"
        />
      </section>
    </main>
  );
}

function ArchiveResultHeader({
  filters,
  itemCount,
  loading,
  readError,
}: {
  filters: ItemCardFilters;
  itemCount: number;
  loading: boolean;
  readError: string | null;
}) {
  const hasFilters = hasActiveFilters(filters);
  const resultLabel = readError
    ? "current view unavailable"
    : loading
      ? "loading current view"
      : `${formatResultCount(itemCount)} in current view`;

  return (
    <div className="archive-result-header" aria-label="archive result context">
      <div>
        <h2>Items</h2>
        <p>{resultLabel}</p>
      </div>
      <span>{hasFilters ? "filtered view" : "full view"}</span>
    </div>
  );
}

function ArchiveUsageSummary({
  captureEnabled,
  filters,
  itemCount,
  loading,
  modeLabel,
  readError,
}: {
  captureEnabled: boolean;
  filters: ItemCardFilters;
  itemCount: number;
  loading: boolean;
  modeLabel: string;
  readError: string | null;
}) {
  const filterSummary = formatFilterSummary(filters);
  const resultLabel = readError
    ? "load error"
    : loading
      ? "loading items"
      : formatResultCount(itemCount);

  return (
    <dl className="archive-overview" aria-label="archive overview">
      <div className="archive-overview__item">
        <dt>data source</dt>
        <dd>{modeLabel}</dd>
      </div>
      <div className="archive-overview__item">
        <dt>results</dt>
        <dd>{resultLabel}</dd>
      </div>
      <div className="archive-overview__item">
        <dt>capture</dt>
        <dd>{captureEnabled ? "manual note" : "seed view"}</dd>
      </div>
      <div className="archive-overview__item">
        <dt>view</dt>
        <dd>{filterSummary || "all archive items"}</dd>
      </div>
    </dl>
  );
}

function ArchiveLoadingState({ filters }: { filters: ItemCardFilters }) {
  const filterSummary = formatFilterSummary(filters);

  return (
    <div className="archive-state archive-state--loading" role="status" aria-live="polite">
      <span className="archive-state__kicker">loading</span>
      <p className="archive-state__copy">
        {filterSummary ? `Loading archive items for ${filterSummary}.` : "Loading archive items."}
      </p>
    </div>
  );
}

function ArchiveEmptyState({
  filters,
  readError,
  onClearFilters,
}: {
  filters: ItemCardFilters;
  readError: string | null;
  onClearFilters: () => void;
}) {
  const hasFilters = hasActiveFilters(filters);
  const filterSummary = formatFilterSummary(filters);

  if (readError) {
    return (
      <div className="archive-state archive-state--error" role="alert">
        <span className="archive-state__kicker">load error</span>
        <h2 className="archive-state__title">Archive could not be loaded.</h2>
        <p className="archive-state__copy">{readError}</p>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="archive-state">
        <span className="archive-state__kicker">no results</span>
        <h2 className="archive-state__title">No items match these filters.</h2>
        <p className="archive-state__copy">{filterSummary}</p>
        <button className="text-button" type="button" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="archive-state">
      <span className="archive-state__kicker">empty archive</span>
      <h2 className="archive-state__title">Archive is empty.</h2>
      <p className="archive-state__copy">This workspace has no archive items available.</p>
    </div>
  );
}

function ArchiveFilterControls({
  filters,
  loading,
  onClearFilters,
  onSourceChange,
  onStatusChange,
  onTextChange,
  onTypeChange,
}: {
  filters: ItemCardFilters;
  loading: boolean;
  onClearFilters: () => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTextChange: (text: string) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
}) {
  const hasFilters = hasActiveFilters(filters);
  const filterSummary = formatFilterSummary(filters);

  return (
    <form
      className="archive-filters"
      aria-label="archive filters"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="archive-filters__header">
        <div>
          <span className="archive-filters__kicker">filters</span>
          <p className="archive-filters__summary">
            {hasFilters ? filterSummary : "No filters active."}
          </p>
        </div>
        {hasFilters ? (
          <button
            className="text-button archive-filters__clear"
            disabled={loading}
            onClick={onClearFilters}
            type="button"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      <div className="archive-filters__controls">
        <label
          className={`archive-filter-field archive-filter-field--text${
            filters.text?.trim() ? " archive-filter-field--active" : ""
          }`}
        >
          <span className="archive-filter-field__label">
            <span>search text</span>
            {filters.text?.trim() ? (
              <span className="archive-filter-field__state">active</span>
            ) : null}
          </span>
          <input
            autoComplete="off"
            disabled={loading}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="search archive"
            type="search"
            value={filters.text ?? ""}
          />
        </label>
        <label
          className={`archive-filter-field${
            filters.status ? " archive-filter-field--active" : ""
          }`}
        >
          <span className="archive-filter-field__label">
            <span>lifecycle</span>
            {filters.status ? (
              <span className="archive-filter-field__state">active</span>
            ) : null}
          </span>
          <select
            disabled={loading}
            onChange={(event) => onStatusChange(event.target.value as ArchiveStatusFilter)}
            value={filters.status ?? "all"}
          >
            {statusFilterOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "all statuses" : status}
              </option>
            ))}
          </select>
        </label>
        <label
          className={`archive-filter-field${filters.type ? " archive-filter-field--active" : ""}`}
        >
          <span className="archive-filter-field__label">
            <span>item type</span>
            {filters.type ? (
              <span className="archive-filter-field__state">active</span>
            ) : null}
          </span>
          <select
            disabled={loading}
            onChange={(event) => onTypeChange(event.target.value as ArchiveTypeFilter)}
            value={filters.type ?? "all"}
          >
            {typeFilterOptions.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "all types" : type}
              </option>
            ))}
          </select>
        </label>
        <label
          className={`archive-filter-field${
            filters.source ? " archive-filter-field--active" : ""
          }`}
        >
          <span className="archive-filter-field__label">
            <span>source</span>
            {filters.source ? (
              <span className="archive-filter-field__state">active</span>
            ) : null}
          </span>
          <select
            disabled={loading}
            onChange={(event) => onSourceChange(event.target.value as ArchiveSourceFilter)}
            value={filters.source ?? "all"}
          >
            {sourceFilterOptions.map((source) => (
              <option key={source} value={source}>
                {source === "all" ? "all sources" : source.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
    </form>
  );
}

function CaptureNoteForm({
  error,
  notice,
  onCapture,
  pending,
}: {
  error: string | null;
  notice: string | null;
  onCapture: (body: string) => Promise<void> | void;
  pending: boolean;
}) {
  const [body, setBody] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedBody = body.trim();

    if (!normalizedBody) {
      setLocalError("Note body is required.");
      return;
    }

    setLocalError(null);

    try {
      await onCapture(normalizedBody);
      setBody("");
    } catch {
      // The parent owns the persisted write error message.
    }
  };

  return (
    <form className="capture-note" aria-label="capture note" onSubmit={submit}>
      <div className="capture-note__header">
        <span>capture</span>
        <p>manual note · inbox</p>
      </div>
      <label>
        <span>body</span>
        <textarea
          disabled={pending}
          onChange={(event) => setBody(event.target.value)}
          placeholder="note body"
          rows={3}
          value={body}
        />
      </label>
      <div className="capture-note__actions">
        <button className="status-action" disabled={pending} type="submit">
          {pending ? "Capturing" : "Capture to inbox"}
        </button>
        {notice ? <span className="capture-note__notice">{notice}</span> : null}
      </div>
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
  );
}

function getRouteFromLocation(): AppRoute {
  const match = window.location.pathname.match(/^\/items\/([^/]+)\/?$/);

  if (!match) {
    return { kind: "grid" };
  }

  return { kind: "item", itemId: decodeURIComponent(match[1]) };
}

function getFiltersFromLocation(): ItemCardFilters {
  const searchParams = new URLSearchParams(window.location.search);
  const filters: ItemCardFilters = {};
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const text = searchParams.get("q")?.trim();

  if (isStatusFilter(status)) {
    filters.status = status;
  }

  if (isTypeFilter(type)) {
    filters.type = type;
  }

  if (isSourceFilter(source)) {
    filters.source = source;
  }

  if (text) {
    filters.text = text;
  }

  return filters;
}

function buildArchiveUrl(filters: ItemCardFilters) {
  return `/${buildFilterSearch(filters)}`;
}

function buildItemDetailUrl(itemId: string, filters: ItemCardFilters) {
  return `/items/${encodeURIComponent(itemId)}${buildFilterSearch(filters)}`;
}

function buildFilterSearch(filters: ItemCardFilters) {
  const searchParams = new URLSearchParams();

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (filters.type) {
    searchParams.set("type", filters.type);
  }

  if (filters.source) {
    searchParams.set("source", filters.source);
  }

  if (filters.text?.trim()) {
    searchParams.set("q", filters.text.trim());
  }

  const search = searchParams.toString();
  return search ? `?${search}` : "";
}

function hasActiveFilters(filters: ItemCardFilters) {
  return Boolean(filters.status || filters.type || filters.source || filters.text?.trim());
}

function formatFilterSummary(filters: ItemCardFilters) {
  return getFilterSummaryParts(filters).join(" · ");
}

function formatResultCount(itemCount: number) {
  return `${itemCount} ${itemCount === 1 ? "result" : "results"}`;
}

function getFilterSummaryParts(filters: ItemCardFilters) {
  const parts: string[] = [];

  if (filters.status) {
    parts.push(`lifecycle: ${filters.status}`);
  }

  if (filters.type) {
    parts.push(`item type: ${filters.type}`);
  }

  if (filters.source) {
    parts.push(`source: ${filters.source.replace("_", " ")}`);
  }

  if (filters.text?.trim()) {
    parts.push(`search: "${filters.text.trim()}"`);
  }

  return parts;
}

function isStatusFilter(value: string | null): value is ItemStatus {
  return value !== null && value !== "all" && statusFilterOptions.includes(value as ArchiveStatusFilter);
}

function isTypeFilter(value: string | null): value is ItemType {
  return value !== null && value !== "all" && typeFilterOptions.includes(value as ArchiveTypeFilter);
}

function isSourceFilter(value: string | null): value is ItemSourceFilter {
  return value !== null && value !== "all" && sourceFilterOptions.includes(value as ArchiveSourceFilter);
}

function captureSourceExternalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `manual:note:${crypto.randomUUID()}`;
  }

  return `manual:note:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}
