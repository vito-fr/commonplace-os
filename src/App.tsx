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
          setReadError("Unable to load item cards.");
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
      setDetailError("Item detail proof requires PocketBase reader mode.");
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

  return (
    <main className="app-shell" aria-label="Vita archive">
      <section className="proof-panel" aria-labelledby="proof-title">
        <p className="proof-kicker">v0.1 interface slice</p>
        <h1 id="proof-title">MasonryGrid proof</h1>
        <p className="proof-copy">
          The MasonryGrid slice is mounted with representative rows from seed fixtures and no
          route, persistence, or drag layer.
        </p>
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
          onSourceChange={updateSourceFilter}
          onStatusChange={updateStatusFilter}
          onTextChange={updateTextFilter}
          onTypeChange={updateTypeFilter}
        />
        <MasonryGrid
          items={renderedItems}
          density="comfortable"
          loading={isLoading}
          emptyState={
            <p className="proof-empty">
              {readError ?? "No items match the current archive filters."}
            </p>
          }
          ariaLabel="filtered archive items grid"
        />
      </section>
    </main>
  );
}

function ArchiveFilterControls({
  filters,
  loading,
  onSourceChange,
  onStatusChange,
  onTextChange,
  onTypeChange,
}: {
  filters: ItemCardFilters;
  loading: boolean;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTextChange: (text: string) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
}) {
  return (
    <form className="archive-filters" aria-label="archive filters">
      <label className="archive-filters__text">
        <span>text</span>
        <input
          autoComplete="off"
          disabled={loading}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="query text"
          type="search"
          value={filters.text ?? ""}
        />
      </label>
      <label>
        <span>status</span>
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
      <label>
        <span>type</span>
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
      <label>
        <span>source</span>
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
      <label>
        <span>Capture note</span>
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
