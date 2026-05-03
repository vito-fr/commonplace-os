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

type AppRoute =
  | { kind: "grid" }
  | { kind: "item"; itemId: string; returnCollectionId?: string }
  | { kind: "collection"; collectionId: string };
type ArchiveStatusFilter = ItemStatus | "all";
type ArchiveTypeFilter = ItemType | "all";
type ArchiveSourceFilter = ItemSourceFilter | "all";
type ArchiveShellPanel = "index" | "views" | "filters" | "import" | "information" | null;
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
  const [archivePanel, setArchivePanel] = useState<ArchiveShellPanel>("index");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
        return;
      }

      if (event.key === "Escape") {
        setIsSettingsOpen(false);
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

  const openArchiveSettings = () => {
    setIsSettingsOpen(true);
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
        <ArchiveTopShell
          activePanel={archivePanel}
          captureError={captureError}
          captureNotice={captureNotice}
          filters={itemCardFilters}
          isPocketBaseMode={isPocketBaseMode}
          itemCount={items.length}
          loading={isLoading}
          onCapture={captureArchiveInput}
          onClearFilters={clearArchiveFilters}
          onPanelChange={setArchivePanel}
          onSourceChange={updateSourceFilter}
          onStatusChange={updateStatusFilter}
          onTextChange={updateTextFilter}
          onTypeChange={updateTypeFilter}
          pendingCapture={isCapturing}
          readError={readError}
        />
        <section className="archive-canvas" aria-label="archive items">
          {isLoading ? <ArchiveLoadingState filters={itemCardFilters} /> : null}
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
        <ArchiveTouchBar
          onOpenSettings={openArchiveSettings}
          theme={siteTheme}
        />
        {isSettingsOpen ? (
          <ArchiveSettingsOverlay
            onClose={() => setIsSettingsOpen(false)}
            onThemeChange={setSiteTheme}
            theme={siteTheme}
          />
        ) : null}
      </main>
    );
  }

  return (
    <>
      <div className="app-route-shell" ref={routeRef}>
        {routeContent}
      </div>
      <SpotlightDock value={itemCardFilters.text ?? ""} onChange={updateTextFilter} />
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

function ArchiveTopShell({
  activePanel,
  captureError,
  captureNotice,
  filters,
  isPocketBaseMode,
  itemCount,
  loading,
  onCapture,
  onClearFilters,
  onPanelChange,
  onSourceChange,
  onStatusChange,
  onTextChange,
  onTypeChange,
  pendingCapture,
  readError,
}: {
  activePanel: ArchiveShellPanel;
  captureError: string | null;
  captureNotice: string | null;
  filters: ItemCardFilters;
  isPocketBaseMode: boolean;
  itemCount: number;
  loading: boolean;
  onCapture: (body: string) => Promise<void> | void;
  onClearFilters: () => void;
  onPanelChange: (panel: ArchiveShellPanel) => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTextChange: (text: string) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  pendingCapture: boolean;
  readError: string | null;
}) {
  const hasFilters = hasActiveFilters(filters);
  const resultLabel = readError
    ? "load error"
    : loading
      ? "loading"
      : `${formatResultCount(itemCount)} shown`;

  const togglePanel = (panel: Exclude<ArchiveShellPanel, null>) => {
    onPanelChange(activePanel === panel ? null : panel);
  };

  const revealRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const previousPanelRef = useRef<ArchiveShellPanel>(null);
  const [renderedPanel, setRenderedPanel] = useState<ArchiveShellPanel>(activePanel);

  useEffect(() => {
    const wrapper = revealRef.current;
    const inner = innerRef.current;

    if (!wrapper || !inner) {
      previousPanelRef.current = activePanel;
      return;
    }

    const previousPanel = previousPanelRef.current;
    previousPanelRef.current = activePanel;

    if (!previousPanel && activePanel) {
      setRenderedPanel(activePanel);
      requestAnimationFrame(() => {
        gsap.fromTo(
          wrapper,
          { height: 0 },
          {
            height: "auto",
            duration: 0.32,
            ease: "power3.out",
            onComplete: () => {
              wrapper.style.height = "";
            },
          },
        );
        gsap.fromTo(
          inner,
          { y: 4, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.24, delay: 0.06, ease: "power2.out" },
        );
      });
      return;
    }

    if (previousPanel && !activePanel) {
      gsap.to(inner, { opacity: 0, duration: 0.16, ease: "power2.in" });
      gsap.to(wrapper, {
        height: 0,
        duration: 0.24,
        ease: "power3.in",
        onComplete: () => {
          setRenderedPanel(null);
        },
      });
      return;
    }

    if (previousPanel && activePanel && previousPanel !== activePanel) {
      setRenderedPanel(activePanel);
      requestAnimationFrame(() => {
        wrapper.style.height = "";
        gsap.fromTo(
          inner,
          { opacity: 0 },
          { opacity: 1, duration: 0.18, ease: "power2.out" },
        );
      });
    }
  }, [activePanel]);

  return (
    <header className="topbar-shell">
      <div className="topbar-shell__bar">
        <button className="topbar-shell__brand" type="button" onClick={onClearFilters} aria-label="live archive">
          <span className="topbar-live-dot" aria-hidden="true" />
        </button>
        <nav className="topbar-shell__nav" aria-label="archive controls">
          <ArchiveShellButton
            active={activePanel === "index"}
            label="Index"
            onClick={() => togglePanel("index")}
          />
          <ArchiveShellButton
            active={activePanel === "views"}
            label="Views"
            onClick={() => togglePanel("views")}
          />
          <ArchiveShellButton
            active={activePanel === "filters"}
            label="Filters"
            onClick={() => togglePanel("filters")}
          />
          <ArchiveShellButton
            active={activePanel === "import"}
            label="Import"
            onClick={() => togglePanel("import")}
          />
          <ArchiveShellButton
            active={activePanel === "information"}
            label="Information"
            onClick={() => togglePanel("information")}
          />
        </nav>
      </div>
      <div className="topbar-shell__scope" aria-label="archive scope">
        <ArchiveFilterChips filters={filters} emptyLabel="whole archive" />
        <span>{resultLabel}</span>
        {hasFilters ? (
          <button className="topbar-text-control" disabled={loading} onClick={onClearFilters} type="button">
            Clear filters
          </button>
        ) : null}
      </div>
      <div
        className="topbar-reveal"
        aria-live="polite"
        aria-hidden={!activePanel}
        ref={revealRef}
        style={{ height: 0 }}
      >
        <div className="topbar-reveal__inner" ref={innerRef}>
          {renderedPanel === "index" ? (
            <div className="topbar-reveal__grid">
              <div className="topbar-reveal__group">
                <span className="topbar-reveal__label">Index</span>
                <button className="topbar-option topbar-option--active" type="button" onClick={onClearFilters}>
                  All items
                </button>
                <span className="topbar-option topbar-option--muted">Collections</span>
              </div>
              <div className="topbar-reveal__group">
                <span className="topbar-reveal__label">Current set</span>
                <ArchiveFilterChips filters={filters} emptyLabel="whole archive" />
                <span className="topbar-reveal__meta">{resultLabel}</span>
              </div>
            </div>
          ) : null}
          {renderedPanel === "views" ? (
            <div className="topbar-reveal__grid">
              <div className="topbar-reveal__group">
                <span className="topbar-reveal__label">View</span>
                <span className="topbar-option topbar-option--active">Masonry</span>
                <span className="topbar-option topbar-option--muted">Gallery</span>
                <span className="topbar-option topbar-option--muted">List</span>
                <span className="topbar-option topbar-option--muted">Graph</span>
              </div>
            </div>
          ) : null}
          {renderedPanel === "filters" ? (
            <ArchiveFilterControls
              filters={filters}
              loading={loading}
              onSourceChange={onSourceChange}
              onStatusChange={onStatusChange}
              onTextChange={onTextChange}
              onTypeChange={onTypeChange}
            />
          ) : null}
          {renderedPanel === "import" ? (
            <div className="topbar-reveal__grid">
              <div className="topbar-reveal__group topbar-reveal__group--wide">
                <span className="topbar-reveal__label">Import</span>
                {isPocketBaseMode ? (
                  <CaptureNoteForm
                    error={captureError}
                    notice={captureNotice}
                    onCapture={onCapture}
                    pending={pendingCapture}
                  />
                ) : (
                  <p className="topbar-reveal__meta">Import requires live archive mode.</p>
                )}
              </div>
            </div>
          ) : null}
          {renderedPanel === "information" ? (
            <div className="topbar-reveal__grid">
              <div className="topbar-reveal__group">
                <span className="topbar-reveal__label">Information</span>
                <p className="topbar-reveal__copy">
                  A working archive for capture, inspection, connection, reuse, and removal.
                </p>
                <p className="topbar-reveal__meta">⌘K search · M color mode · Esc close</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ArchiveTouchBar({
  onOpenSettings,
  theme,
}: {
  onOpenSettings: () => void;
  theme: SiteTheme;
}) {
  return (
    <div className="archive-touchbar" aria-label="archive quick controls">
      <button className="archive-touchbar__settings" type="button" onClick={onOpenSettings}>
        {theme === "light" ? "light" : "dark"}
      </button>
    </div>
  );
}

function ArchiveSettingsOverlay({
  onClose,
  onThemeChange,
  theme,
}: {
  onClose: () => void;
  onThemeChange: (theme: SiteTheme) => void;
  theme: SiteTheme;
}) {
  return (
    <div
      className="archive-modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="archive-settings" aria-label="site settings">
        <div className="archive-settings__header">
          <span>Settings</span>
          <button className="topbar-text-control" type="button" onClick={onClose}>
            close
          </button>
        </div>
        <div className="archive-settings__row">
          <span>Color mode</span>
          <div className="archive-settings__options">
            <button
              className={`topbar-option${theme === "light" ? " topbar-option--active" : ""}`}
              type="button"
              onClick={() => onThemeChange("light")}
            >
              light
            </button>
            <button
              className={`topbar-option${theme === "dark" ? " topbar-option--active" : ""}`}
              type="button"
              onClick={() => onThemeChange("dark")}
            >
              dark
            </button>
          </div>
        </div>
        <p className="topbar-reveal__meta">Press M from the archive to invert the interface.</p>
      </section>
    </div>
  );
}

function ArchiveShellButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-expanded={active}
      className={`topbar-shell__control${active ? " topbar-shell__control--active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
    <form
      className="archive-filters"
      aria-label="narrow archive"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="archive-filters__controls">
        <div className="archive-filters__filter-group" aria-labelledby="archive-filter-heading">
          <span className="archive-filters__section-title" id="archive-filter-heading">
            Filter
          </span>
          <div className="archive-filters__filter-controls">
            <label
              className={`archive-filter-field${
                filters.status ? " archive-filter-field--active" : ""
              }`}
            >
              <span className="archive-filter-field__label">
                <span>work state</span>
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
                    {status === "all" ? "any state" : status}
                  </option>
                ))}
              </select>
            </label>
            <label
              className={`archive-filter-field${filters.type ? " archive-filter-field--active" : ""}`}
            >
              <span className="archive-filter-field__label">
                <span>kind</span>
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
                    {type === "all" ? "any kind" : type}
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
                <span>from</span>
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
                    {source === "all" ? "any origin" : source.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    </form>
  );
}

function ArchiveFilterChips({
  filters,
  emptyLabel,
}: {
  filters: ItemCardFilters;
  emptyLabel: string;
}) {
  const filterItems = getFilterSummaryItems(filters);

  if (filterItems.length === 0) {
    return (
      <div className="archive-filter-chips" aria-label="archive scope">
        <span className="archive-filter-chip archive-filter-chip--empty">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className="archive-filter-chips" aria-label="archive scope">
      {filterItems.map((filter) => (
        <span className="archive-filter-chip" key={filter.label}>
          <span>{filter.label}</span>
          {filter.value}
        </span>
      ))}
    </div>
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
      setLocalError("Text or URL is required.");
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
    <form className="capture-note" aria-label="import item" onSubmit={submit}>
      <textarea
        aria-label="text or URL"
        disabled={pending}
        onChange={(event) => setBody(event.target.value)}
        placeholder="paste URL or write text"
        rows={3}
        value={body}
      />
      <div className="capture-note__actions">
        <button className="status-action" disabled={pending} type="submit">
          {pending ? "Importing" : "Add to archive"}
        </button>
        {notice ? <span className="capture-note__notice">{notice}</span> : null}
      </div>
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
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
