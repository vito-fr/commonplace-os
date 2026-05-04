import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { gsap, ScrollTrigger } from "./motion/MotionShell";
import type { ItemStatus, ItemType } from "./components/atoms";
import { CollectionView } from "./components/collections/CollectionView";
import { MasonryGrid } from "./components/items";
import type { ItemCardProps } from "./components/items";
import { ItemDetailView, type DetailArchiveFlow } from "./components/items/ItemDetail";
import type { ItemCardFilters, ItemCardReader, ItemSourceFilter } from "./data/itemCardReader";
import { createPocketBaseItemCaptureWriter } from "./data/pocketBaseItemCapture";
import {
  createPocketBaseItemCollectionClient,
  type CollectionDetail,
  type CollectionOption,
} from "./data/pocketBaseItemCollection";
import { createPocketBaseItemDeleteWriter } from "./data/pocketBaseItemDelete";
import type { ItemDetail, ItemDetailReader } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemDetailReader } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemCardReader } from "./data/pocketBaseItemCards";
import { createPocketBaseItemRelationshipWriter } from "./data/pocketBaseItemRelationship";
import { createPocketBaseItemStatusWriter } from "./data/pocketBaseItemStatus";
import { seedFixtureItemCardReader } from "./data/seedItemCards";
import { seedFixtureItemDetailReader } from "./data/seedItemDetail";
import { SpotlightDock } from "./components/spotlight/SpotlightDock";
import { PillNav, type PillNavPanel } from "./components/nav/PillNav";

type AppRoute =
  | { kind: "grid" }
  | { kind: "item"; itemId: string; returnCollectionId?: string }
  | { kind: "collection"; collectionId: string };
type ArchiveStatusFilter = ItemStatus | "all";
type ArchiveTypeFilter = ItemType | "all";
type ArchiveSourceFilter = ItemSourceFilter | "all";
type SiteTheme = "light" | "dark";

const statusFilterOptions: ArchiveStatusFilter[] = [
  "all",
  "active",
  "archived",
];
const typeFilterOptions: ArchiveTypeFilter[] = [
  "all",
  "image",
  "caption",
  "note",
  "link",
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
const minGalleryColumns = 2;
const maxGalleryColumns = 8;

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
const itemCollectionClient = createPocketBaseItemCollectionClient({ baseUrl: pocketBaseUrl });
const itemDeleteWriter = createPocketBaseItemDeleteWriter({ baseUrl: pocketBaseUrl });
const itemDetailReader: ItemDetailReader = isPocketBaseMode
  ? createPocketBaseItemDetailReader({ baseUrl: pocketBaseUrl })
  : seedFixtureItemDetailReader;
const itemRelationshipWriter = createPocketBaseItemRelationshipWriter({ baseUrl: pocketBaseUrl });
const itemStatusWriter = createPocketBaseItemStatusWriter({ baseUrl: pocketBaseUrl });

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [items, setItems] = useState<ItemCardProps[]>([]);
  const [itemCardFilters, setItemCardFilters] = useState<ItemCardFilters>(() => getFiltersFromLocation());
  const [archivePanel, setArchivePanel] = useState<PillNavPanel | null>(null);
  const [galleryColumns, setGalleryColumns] = useState(4);
  const [siteTheme, setSiteTheme] = useState<SiteTheme>(() => getInitialSiteTheme());
  const [isLoading, setIsLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [collectionOptions, setCollectionOptions] = useState<CollectionOption[]>([]);
  const [collectionDetail, setCollectionDetail] = useState<CollectionDetail | null>(null);
  const [isCollectionLoading, setIsCollectionLoading] = useState(false);
  const [collectionReadError, setCollectionReadError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isCollectionAttaching, setIsCollectionAttaching] = useState(false);
  const [collectionWriteError, setCollectionWriteError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusWriteError, setStatusWriteError] = useState<string | null>(null);
  const [isRelationshipCreating, setIsRelationshipCreating] = useState(false);
  const [relationshipWriteError, setRelationshipWriteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteWriteError, setDeleteWriteError] = useState<string | null>(null);

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
    document.documentElement.dataset.theme = siteTheme;
    window.localStorage.setItem("vita:theme", siteTheme);
  }, [siteTheme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (!isTypingTarget && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setSiteTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const nextUrl =
      route.kind === "item"
        ? buildItemDetailUrl(route.itemId, itemCardFilters, {
            returnCollectionId: route.returnCollectionId,
          })
        : route.kind === "collection"
          ? buildCollectionUrl(route.collectionId)
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
          setReadError("Unable to load archive.");
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
      setCollectionOptions([]);
      setDetailError(null);
      setIsDetailLoading(false);
      setCollectionWriteError(null);
      setIsCollectionAttaching(false);
      setStatusWriteError(null);
      setIsStatusUpdating(false);
      setRelationshipWriteError(null);
      setIsRelationshipCreating(false);
      setDeleteWriteError(null);
      setIsDeleting(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsDetailLoading(true);
    setDetailError(null);
    setCollectionWriteError(null);
    setStatusWriteError(null);
    setRelationshipWriteError(null);
    setDeleteWriteError(null);

    itemDetailReader
      .getItemDetail({ workspaceId, itemId: route.itemId })
      .then(async (nextDetail) => {
        if (isCurrent) {
          setDetail(nextDetail);
        }

        if (!isPocketBaseMode) {
          if (isCurrent) {
            setCollectionOptions([]);
          }
          return;
        }

        try {
          const nextCollectionOptions = await itemCollectionClient.listCollectionOptions({
            workspaceId,
            itemId: route.itemId,
          });
          if (isCurrent) {
            setCollectionOptions(nextCollectionOptions);
          }
        } catch (error: unknown) {
          if (isCurrent) {
            console.error(error);
            setCollectionOptions([]);
            setCollectionWriteError("Unable to load collection options.");
          }
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          console.error(error);
          setDetail(null);
          setCollectionOptions([]);
          setDetailError("Unable to load archive detail.");
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

  useEffect(() => {
    let isCurrent = true;

    if (route.kind !== "collection") {
      setCollectionDetail(null);
      setCollectionReadError(null);
      setIsCollectionLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    if (!isPocketBaseMode) {
      setCollectionDetail(null);
      setCollectionReadError("Collection view requires live archive mode.");
      setIsCollectionLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsCollectionLoading(true);
    setCollectionReadError(null);

    itemCollectionClient
      .getCollectionDetail({ workspaceId, collectionId: route.collectionId })
      .then((nextCollection) => {
        if (isCurrent) {
          setCollectionDetail(nextCollection);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          console.error(error);
          setCollectionDetail(null);
          setCollectionReadError("Unable to load collection.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsCollectionLoading(false);
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

  const openCollectionItemDetail = (itemId: string, collectionId: string) => {
    window.history.pushState(
      null,
      "",
      buildItemDetailUrl(itemId, {}, { returnCollectionId: collectionId }),
    );
    setRoute({ kind: "item", itemId, returnCollectionId: collectionId });
  };

  const openCollection = (collectionId: string) => {
    window.history.pushState(null, "", buildCollectionUrl(collectionId));
    setRoute({ kind: "collection", collectionId });
  };

  const closeItemDetail = () => {
    if (route.kind === "item" && route.returnCollectionId) {
      window.history.pushState(null, "", buildCollectionUrl(route.returnCollectionId));
      setRoute({ kind: "collection", collectionId: route.returnCollectionId });
    } else {
      window.history.pushState(null, "", buildArchiveUrl(itemCardFilters));
      setRoute({ kind: "grid" });
    }
  };

  const closeCollection = () => {
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
      setStatusWriteError("Unable to change work state.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const deleteItem = async () => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsDeleting(true);
    setDeleteWriteError(null);

    try {
      await itemDeleteWriter.deleteItem({
        workspaceId,
        itemId: detail.id,
        actor: "system",
      });

      const nextItems = await itemCardReader.listItemCards({
        workspaceId,
        filters: itemCardFilters,
      });
      setItems(nextItems);

      if (route.kind === "item" && route.returnCollectionId) {
        window.history.pushState(null, "", buildCollectionUrl(route.returnCollectionId));
        setRoute({ kind: "collection", collectionId: route.returnCollectionId });
      } else {
        window.history.pushState(null, "", buildArchiveUrl(itemCardFilters));
        setRoute({ kind: "grid" });
      }
    } catch (error: unknown) {
      console.error(error);
      setDeleteWriteError("Unable to delete item.");
      throw error;
    } finally {
      setIsDeleting(false);
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
      setRelationshipWriteError("Unable to connect item.");
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

  const captureArchiveInput = async (rawInput: string) => {
    if (!isPocketBaseMode) {
      return;
    }

    setIsCapturing(true);
    setCaptureError(null);
    setCaptureNotice(null);

    try {
      const captureInput = normalizeCaptureInput(rawInput);

      if (captureInput.type === "link") {
        await itemCaptureWriter.captureUrl({
          workspaceId,
          type: "link",
          url: captureInput.url,
          sourceExternalId: captureInput.url,
          actor: "system",
        });
      } else {
        await itemCaptureWriter.captureNote({
          workspaceId,
          type: "note",
          body: captureInput.body,
          sourceExternalId: captureSourceExternalId(),
          actor: "system",
        });
      }

      const nextItems = await itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters });
      setItems(nextItems);
      setReadError(null);
      setCaptureNotice(captureInput.type === "link" ? "Imported URL." : "Added note.");
    } catch (error: unknown) {
      console.error(error);
      setCaptureError("Unable to import.");
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

  const updateGalleryColumns = (columns: number) => {
    setGalleryColumns(Math.min(maxGalleryColumns, Math.max(minGalleryColumns, columns)));
  };

  const routeRef = useRef<HTMLDivElement | null>(null);
  const previousRouteKeyRef = useRef<string>(routeKey(route));
  const [renderedRoute, setRenderedRoute] = useState<AppRoute>(route);

  useEffect(() => {
    const wrapper = routeRef.current;
    const previousKey = previousRouteKeyRef.current;
    const currentKey = routeKey(route);

    if (previousKey === currentKey) {
      setRenderedRoute(route);
      return;
    }

    previousRouteKeyRef.current = currentKey;

    if (!wrapper) {
      setRenderedRoute(route);
      return;
    }

    gsap.to(wrapper, {
      opacity: 0,
      duration: 0.18,
      ease: "power2.in",
      onComplete: () => {
        setRenderedRoute(route);
        requestAnimationFrame(() => {
          gsap.fromTo(
            wrapper,
            { opacity: 0 },
            { opacity: 1, duration: 0.24, ease: "power2.out" },
          );
          ScrollTrigger.refresh();
        });
      },
    });
  }, [route]);

  let routeContent: ReactNode = null;
  const archiveNav =
    renderedRoute.kind === "grid" ? (
      <PillNav
        activePanel={archivePanel}
        filters={itemCardFilters}
        galleryColumns={galleryColumns}
        itemCount={items.length}
        loading={isLoading}
        onClearFilters={clearArchiveFilters}
        onGalleryColumnsChange={updateGalleryColumns}
        onPanelChange={setArchivePanel}
        onSourceChange={updateSourceFilter}
        onStatusChange={updateStatusFilter}
        onTypeChange={updateTypeFilter}
        readError={readError}
        statusOptions={statusFilterOptions}
        typeOptions={typeFilterOptions}
        sourceOptions={sourceFilterOptions}
      />
    ) : null;

  if (renderedRoute.kind === "collection") {
    routeContent = (
      <main className="app-shell" aria-label="Vita collection">
        <CollectionView
          collection={collectionDetail}
          loading={isCollectionLoading}
          error={collectionReadError}
          onBack={closeCollection}
          onOpenItem={openCollectionItemDetail}
        />
      </main>
    );
  } else if (renderedRoute.kind === "item") {
    const currentItemId = detail?.id ?? renderedRoute.itemId;
    const archiveContextLabel = renderedRoute.returnCollectionId
      ? "collection view"
      : formatArchiveContext(itemCardFilters);
    const archiveFlow = renderedRoute.returnCollectionId
      ? null
      : getDetailArchiveFlow(items, currentItemId);
    const relationshipTargetOptions = items
      .filter((item) => item.id !== currentItemId)
      .map((item) => ({
        id: item.id,
        label: item.title ?? `${item.type} item`,
      }));
    const collectionTargetOptions = collectionOptions.map((collection) => ({
      id: collection.id,
      label: collection.name,
      alreadyAttached: collection.alreadyAttached,
    }));

    routeContent = (
      <main className="app-shell" aria-label="Vita archive">
        <ItemDetailView
          item={detail}
          loading={isDetailLoading}
          error={detailError}
          archiveContext={archiveContextLabel}
          archiveFlow={archiveFlow}
          backLabel={renderedRoute.returnCollectionId ? "Back to collection" : "Back to archive"}
          onBack={closeItemDetail}
          onOpenCollection={openCollection}
          onOpenArchiveItem={openItemDetail}
          onOpenRelatedItem={openItemDetail}
          onChangeStatus={changeItemStatus}
          statusActionPending={isStatusUpdating}
          statusActionError={statusWriteError}
          onDelete={deleteItem}
          deleteActionPending={isDeleting}
          deleteActionError={deleteWriteError}
          onCreateRelationship={createItemRelationship}
          relationshipActionPending={isRelationshipCreating}
          relationshipActionError={relationshipWriteError}
          relationshipTargetOptions={relationshipTargetOptions}
          onAttachCollection={attachItemToCollection}
          collectionActionPending={isCollectionAttaching}
          collectionActionError={collectionWriteError}
          collectionOptions={collectionTargetOptions}
        />
      </main>
    );
  } else {
    const renderedItems = items.map((item) => ({
      ...item,
      activeFilters: itemCardFilters,
      ...(isPocketBaseMode
        ? {
            detailHref: buildItemDetailUrl(item.id, itemCardFilters),
            onNavigate: openItemDetail,
          }
        : {
            onNavigate: openItemDetail,
          }),
    }));

    routeContent = (
      <main className="app-shell app-shell--archive" aria-label="Vita archive">
        <h1 className="visually-hidden">Archive</h1>
        <section className="archive-canvas" aria-label="archive items">
          {isLoading ? <ArchiveLoadingState filters={itemCardFilters} /> : null}
          <MasonryGrid
            items={renderedItems}
            density="comfortable"
            columns={galleryColumns}
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

  return (
    <>
      {archiveNav}
      <div className="app-route-shell" ref={routeRef}>
        {routeContent}
      </div>
      <SpotlightDock
        value={itemCardFilters.text ?? ""}
        onChange={updateTextFilter}
        isPocketBaseMode={isPocketBaseMode}
        pendingCapture={isCapturing}
        captureError={captureError}
        captureNotice={captureNotice}
        onCapture={captureArchiveInput}
      />
    </>
  );
}

function routeKey(r: AppRoute): string {
  if (r.kind === "grid") {
    return "grid";
  }

  if (r.kind === "collection") {
    return `collection:${r.collectionId}`;
  }

  return `item:${r.itemId}`;
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
        <span className="archive-state__kicker">empty set</span>
        <h2 className="archive-state__title">Nothing matches this archive set.</h2>
        <p className="archive-state__copy">{filterSummary}</p>
        <button className="text-button" type="button" onClick={onClearFilters}>
          Clear narrow view
        </button>
      </div>
    );
  }

  return (
    <div className="archive-state">
      <span className="archive-state__kicker">empty archive</span>
      <h2 className="archive-state__title">Archive has no items yet.</h2>
      <p className="archive-state__copy">This workspace has nothing available to inspect.</p>
    </div>
  );
}

function getRouteFromLocation(): AppRoute {
  const itemMatch = window.location.pathname.match(/^\/items\/([^/]+)\/?$/);
  if (itemMatch) {
    const returnCollectionId = new URLSearchParams(window.location.search).get("return_collection")?.trim();
    return {
      kind: "item",
      itemId: decodeURIComponent(itemMatch[1]),
      returnCollectionId: returnCollectionId ? returnCollectionId : undefined,
    };
  }

  const collectionMatch = window.location.pathname.match(/^\/collections\/([^/]+)\/?$/);
  if (collectionMatch) {
    return { kind: "collection", collectionId: decodeURIComponent(collectionMatch[1]) };
  }

  return { kind: "grid" };
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

function buildCollectionUrl(collectionId: string) {
  return `/collections/${encodeURIComponent(collectionId)}`;
}

function buildItemDetailUrl(
  itemId: string,
  filters: ItemCardFilters,
  options: { returnCollectionId?: string } = {},
) {
  return `/items/${encodeURIComponent(itemId)}${buildFilterSearch(filters, options)}`;
}

function buildFilterSearch(
  filters: ItemCardFilters,
  options: { returnCollectionId?: string } = {},
) {
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

  if (options.returnCollectionId) {
    searchParams.set("return_collection", options.returnCollectionId);
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

function formatArchiveContext(filters: ItemCardFilters) {
  return formatFilterSummary(filters) || "whole archive";
}

function formatResultCount(itemCount: number) {
  return `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
}

function getDetailArchiveFlow(items: ItemCardProps[], currentItemId: string): DetailArchiveFlow | null {
  const currentIndex = items.findIndex((item) => item.id === currentItemId);

  if (currentIndex === -1) {
    return null;
  }

  return {
    index: currentIndex + 1,
    total: items.length,
    previous: toArchiveNeighbor(items[currentIndex - 1]),
    next: toArchiveNeighbor(items[currentIndex + 1]),
  };
}

function toArchiveNeighbor(item: ItemCardProps | undefined) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    label: item.title ?? `${item.type} item`,
    meta: `${item.type} · ${item.status}`,
  };
}

function getFilterSummaryParts(filters: ItemCardFilters) {
  return getFilterSummaryItems(filters).map((filter) => `${filter.label}: ${filter.value}`);
}

function getFilterSummaryItems(filters: ItemCardFilters) {
  const parts: Array<{ label: string; value: string }> = [];

  if (filters.status) {
    parts.push({ label: "work state", value: filters.status });
  }

  if (filters.type) {
    parts.push({ label: "kind", value: filters.type });
  }

  if (filters.source) {
    parts.push({ label: "from", value: filters.source.replace("_", " ") });
  }

  if (filters.text?.trim()) {
    parts.push({ label: "words", value: `"${filters.text.trim()}"` });
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

function normalizeCaptureInput(rawInput: string):
  | { type: "link"; url: string }
  | { type: "note"; body: string } {
  const value = rawInput.trim();

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      url.hash = "";
      return { type: "link", url: url.toString().replace(/\/$/, "") };
    }
  } catch {
    // Non-URL input is captured as a note.
  }

  return { type: "note", body: value };
}

function getInitialSiteTheme(): SiteTheme {
  const savedTheme = window.localStorage.getItem("vita:theme");

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return "light";
}
