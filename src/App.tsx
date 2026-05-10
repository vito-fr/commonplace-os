import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { ScrollTrigger } from "./motion/MotionShell";
import type { ItemStatus, ItemType } from "./components/atoms";
import { MasonryGrid, MasonryView } from "./components/items";
import type { ArchiveObject, CollectionCardModel, ItemCardActionAnchor, ItemCardProps } from "./components/items";
import type { DetailArchiveFlow } from "./components/items/ItemDetail";
import type { ItemCardFilters, ItemCardReader, ItemFormatFilter, ItemSourceFilter } from "./data/itemCardReader";
import { createPocketBaseItemCaptureWriter } from "./data/pocketBaseItemCapture";
import {
  createPocketBaseItemCollectionClient,
  type CollectionDetail,
  type CollectionIndexItem,
  type CollectionOption,
} from "./data/pocketBaseItemCollection";
import { createPocketBaseItemDeleteWriter } from "./data/pocketBaseItemDelete";
import type { ItemDetail, ItemDetailReader } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemDetailReader, createPocketBaseItemNoteWriter } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemCardReader } from "./data/pocketBaseItemCards";
import { createPocketBaseItemRelationshipWriter } from "./data/pocketBaseItemRelationship";
import { createPocketBaseItemStatusWriter } from "./data/pocketBaseItemStatus";
import { seedFixtureItemCardReader } from "./data/seedItemCards";
import { seedFixtureItemCollectionClient } from "./data/seedItemCollection";
import { seedFixtureItemDetailReader } from "./data/seedItemDetail";
import { SpotlightDock, type SpotlightCaptureRequest } from "./components/spotlight/SpotlightDock";
import {
  PillNav,
  type ArchiveViewMode,
  type GalleryObjectMode,
  type PillNavPanel,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutBindings,
} from "./components/nav/PillNav";

type AppRoute =
  | { kind: "grid" }
  | { kind: "item"; itemId: string; returnCollectionId?: string }
  | { kind: "collection"; collectionId: string; returnTo?: string }
  | { kind: "pdfPreview"; src: string; name?: string; surface?: "card" | "reader" };
type ArchiveStatusFilter = ItemStatus | "all";
type ArchiveTypeFilter = ItemType | "all";
type ArchiveSourceFilter = ItemSourceFilter | "all";
type ArchiveFormatFilter = ItemFormatFilter | "all";
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
  "local",
  "manual",
  "url",
  "pinterest",
  "arena",
];
const formatFilterOptions: ArchiveFormatFilter[] = [
  "all",
  "pdf",
  "video",
  "website",
];
const minGalleryColumns = 2;
const maxGalleryColumns = 8;
const defaultGalleryColumns = 5;
const minMasonryColumns = 2;
const maxMasonryColumns = 8;
const maxCollectionTitleLength = 50;
const shortcutStorageKey = "vita:shortcut-bindings:v1";
const defaultShortcutBindings: ShortcutBindings = {
  search: { key: "k", modifier: "mod" },
  theme: { key: "m" },
  galleryIncrease: { key: "+", alternateKeys: ["="] },
  galleryDecrease: { key: "-" },
};
const pocketBaseUnavailableTitle = "PocketBase is not running or cannot be reached.";
const pocketBaseUnavailableCopy = "Run npm run pb:serve and refresh.";

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
const itemCollectionClient = isPocketBaseMode
  ? createPocketBaseItemCollectionClient({ baseUrl: pocketBaseUrl })
  : seedFixtureItemCollectionClient;
const itemDeleteWriter = createPocketBaseItemDeleteWriter({ baseUrl: pocketBaseUrl });
const itemDetailReader: ItemDetailReader = isPocketBaseMode
  ? createPocketBaseItemDetailReader({ baseUrl: pocketBaseUrl })
  : seedFixtureItemDetailReader;
const itemNoteWriter = createPocketBaseItemNoteWriter({ baseUrl: pocketBaseUrl });
const itemRelationshipWriter = createPocketBaseItemRelationshipWriter({ baseUrl: pocketBaseUrl });
const itemStatusWriter = createPocketBaseItemStatusWriter({ baseUrl: pocketBaseUrl });

const LazyCollectionView = lazy(() =>
  import("./components/collections/CollectionView").then((module) => ({ default: module.CollectionView })),
);
const LazyItemDetailView = lazy(() =>
  import("./components/items/ItemDetail").then((module) => ({ default: module.ItemDetailView })),
);

type CardCollectionIslandPosition = {
  left: number;
  top: number;
};
const itemCardSurfaceEvent = "vita:item-card-surface-open";
type ItemCardSurfaceDetail = {
  itemId: string;
  surface: "actions" | "collection";
};

function useResponsiveGalleryColumnCap() {
  const [columnCap, setColumnCap] = useState(() => getResponsiveGalleryColumnCap());

  useEffect(() => {
    let frame = 0;
    const updateColumnCap = () => {
      frame = 0;
      const nextColumnCap = getResponsiveGalleryColumnCap();
      setColumnCap((currentColumnCap) =>
        currentColumnCap === nextColumnCap ? currentColumnCap : nextColumnCap,
      );
    };
    const scheduleUpdate = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(updateColumnCap);
    };

    updateColumnCap();
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return columnCap;
}

function getDefaultGalleryColumnCount() {
  return Math.min(defaultGalleryColumns, getResponsiveGalleryColumnCap());
}

function getDefaultMasonryColumnCount() {
  if (typeof window === "undefined") {
    return 4;
  }

  return window.innerWidth >= 1680 ? 5 : 4;
}

function getResponsiveGalleryColumnCap() {
  if (typeof window === "undefined") {
    return defaultGalleryColumns;
  }

  const width = window.innerWidth;
  if (width >= 1440) {
    return maxGalleryColumns;
  }
  if (width >= 1180) {
    return defaultGalleryColumns;
  }
  if (width >= 900) {
    return 4;
  }
  if (width >= 620) {
    return 3;
  }
  return 2;
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [items, setItems] = useState<ItemCardProps[]>([]);
  const [itemCardFilters, setItemCardFilters] = useState<ItemCardFilters>(() => getFiltersFromLocation());
  const [archivePanel, setArchivePanel] = useState<PillNavPanel | null>(null);
  const [galleryObjectMode, setGalleryObjectMode] = useState<GalleryObjectMode>(() => getGalleryObjectModeFromLocation());
  const [archiveViewMode, setArchiveViewMode] = useState<ArchiveViewMode>(() => getArchiveViewModeFromLocation());
  const [galleryColumns, setGalleryColumns] = useState(() => getDefaultGalleryColumnCount());
  const [masonryColumns, setMasonryColumns] = useState(() => getDefaultMasonryColumnCount());
  const galleryColumnCap = useResponsiveGalleryColumnCap();
  const effectiveGalleryColumns = Math.min(galleryColumns, galleryColumnCap);
  const [siteTheme, setSiteTheme] = useState<SiteTheme>(() => getInitialSiteTheme());
  const [shortcutBindings, setShortcutBindings] = useState<ShortcutBindings>(() => getInitialShortcutBindings());
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [collectionOptions, setCollectionOptions] = useState<CollectionOption[]>([]);
  const [collectionIndex, setCollectionIndex] = useState<CollectionIndexItem[]>([]);
  const [collectionDetail, setCollectionDetail] = useState<CollectionDetail | null>(null);
  const [isCollectionIndexLoading, setIsCollectionIndexLoading] = useState(false);
  const [isCollectionLoading, setIsCollectionLoading] = useState(false);
  const [collectionIndexError, setCollectionIndexError] = useState<string | null>(null);
  const [collectionReadError, setCollectionReadError] = useState<string | null>(null);
  const [collectionUpdateError, setCollectionUpdateError] = useState<string | null>(null);
  const [isCollectionUpdating, setIsCollectionUpdating] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [isCreateCollectionPending, setIsCreateCollectionPending] = useState(false);
  const [createCollectionError, setCreateCollectionError] = useState<string | null>(null);
  const [cardCollectionItem, setCardCollectionItem] = useState<ItemCardProps | null>(null);
  const [cardCollectionAnchor, setCardCollectionAnchor] = useState<CardCollectionIslandPosition | null>(null);
  const [cardCollectionOptions, setCardCollectionOptions] = useState<CollectionOption[]>([]);
  const [isCardCollectionLoading, setIsCardCollectionLoading] = useState(false);
  const [isCardCollectionWriting, setIsCardCollectionWriting] = useState(false);
  const [cardCollectionError, setCardCollectionError] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectionWriteError, setSelectionWriteError] = useState<string | null>(null);
  const [isSelectionWriting, setIsSelectionWriting] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isCollectionAttaching, setIsCollectionAttaching] = useState(false);
  const [collectionWriteError, setCollectionWriteError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusWriteError, setStatusWriteError] = useState<string | null>(null);
  const [isRelationshipCreating, setIsRelationshipCreating] = useState(false);
  const [relationshipWriteError, setRelationshipWriteError] = useState<string | null>(null);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [noteWriteError, setNoteWriteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteWriteError, setDeleteWriteError] = useState<string | null>(null);

  useEffect(() => {
    const syncRoute = () => {
      setRoute(getRouteFromLocation());
      setItemCardFilters(getFiltersFromLocation());
      setGalleryObjectMode(getGalleryObjectModeFromLocation());
      setArchiveViewMode(getArchiveViewModeFromLocation());
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
    window.localStorage.setItem(shortcutStorageKey, JSON.stringify(shortcutBindings));
  }, [shortcutBindings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTypingTarget) {
        return;
      }

      if (matchesShortcut(event, shortcutBindings.theme)) {
        event.preventDefault();
        setSiteTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
        return;
      }

      if (route.kind === "grid" && archiveViewMode === "gallery" && matchesShortcut(event, shortcutBindings.galleryIncrease)) {
        event.preventDefault();
        setGalleryColumns((currentColumns) => Math.min(maxGalleryColumns, currentColumns + 1));
        return;
      }

      if (route.kind === "grid" && archiveViewMode === "masonry" && matchesShortcut(event, shortcutBindings.galleryIncrease)) {
        event.preventDefault();
        setMasonryColumns((currentColumns) => Math.min(maxMasonryColumns, currentColumns + 1));
        return;
      }

      if (route.kind === "grid" && archiveViewMode === "gallery" && matchesShortcut(event, shortcutBindings.galleryDecrease)) {
        event.preventDefault();
        setGalleryColumns((currentColumns) => Math.max(minGalleryColumns, currentColumns - 1));
        return;
      }

      if (route.kind === "grid" && archiveViewMode === "masonry" && matchesShortcut(event, shortcutBindings.galleryDecrease)) {
        event.preventDefault();
        setMasonryColumns((currentColumns) => Math.max(minMasonryColumns, currentColumns - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [archiveViewMode, route.kind, shortcutBindings]);

  useEffect(() => {
    const nextUrl =
      route.kind === "pdfPreview"
        ? buildPdfPreviewRouteUrl(route.src, route.name, route.surface)
        : route.kind === "item"
        ? buildItemDetailUrl(route.itemId, itemCardFilters, {
            mode: galleryObjectMode,
            view: archiveViewMode,
            returnCollectionId: route.returnCollectionId,
          })
        : route.kind === "collection"
          ? `${buildCollectionUrl(route.collectionId)}${window.location.search}`
          : buildArchiveUrl(itemCardFilters, galleryObjectMode, archiveViewMode);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [archiveViewMode, galleryObjectMode, itemCardFilters, route]);

  useEffect(() => {
    let isCurrent = true;

    if (route.kind !== "grid") {
      setIsLoading(false);
      return () => {
        isCurrent = false;
      };
    }

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
          setReadError(getReadableLoadError(error, "archive"));
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
  }, [itemCardFilters, route.kind]);

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
      setNoteWriteError(null);
      setIsNoteSaving(false);
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
    setNoteWriteError(null);
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
          setDetailError(getReadableDetailError(error));
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
    if (route.kind !== "grid") {
      setCardCollectionItem(null);
      setCardCollectionAnchor(null);
      setCardCollectionOptions([]);
      setCardCollectionError(null);
      setIsCardCollectionLoading(false);
      setIsCardCollectionWriting(false);
      setSelectedItemIds([]);
      setSelectionWriteError(null);
      setIsSelectionWriting(false);
    }
  }, [route.kind]);

  useEffect(() => {
    if ((archiveViewMode === "list" || archiveViewMode === "graph") && selectedItemIds.length > 0) {
      setSelectedItemIds([]);
      setSelectionWriteError(null);
    }
  }, [archiveViewMode, selectedItemIds.length]);

  useEffect(() => {
    setSelectedItemIds((currentSelection) => {
      if (currentSelection.length === 0) {
        return currentSelection;
      }

      const visibleItemIds = new Set(items.map((item) => item.id));
      const nextSelection = currentSelection.filter((itemId) => visibleItemIds.has(itemId));
      return nextSelection.length === currentSelection.length ? currentSelection : nextSelection;
    });
  }, [items]);

  useEffect(() => {
    let isCurrent = true;
    const needsCollections = route.kind === "grid" || route.kind === "item";

    if (!needsCollections) {
      setCollectionIndexError(null);
      setIsCollectionIndexLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsCollectionIndexLoading(true);
    setCollectionIndexError(null);

    itemCollectionClient
      .listCollectionIndex({ workspaceId })
      .then((nextCollections) => {
        if (isCurrent) {
          setCollectionIndex(nextCollections);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          console.error(error);
          setCollectionIndex([]);
          setCollectionIndexError(getReadableLoadError(error, "collections"));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsCollectionIndexLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [galleryObjectMode, route.kind]);

  useEffect(() => {
    let isCurrent = true;

    if (route.kind !== "collection") {
      setCollectionReadError(null);
      setIsCollectionLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsCollectionLoading(true);
    setCollectionReadError(null);
    setCollectionDetail((currentCollection) =>
      currentCollection?.id === route.collectionId ? currentCollection : null,
    );

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
          setCollectionReadError(getReadableLoadError(error, "collection"));
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
    window.history.pushState(null, "", buildItemDetailUrl(itemId, itemCardFilters, { mode: galleryObjectMode, view: archiveViewMode }));
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
    setArchivePanel(null);
  };

  const openCollectionFromItemDetail = (collectionId: string) => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.history.pushState(null, "", buildCollectionUrl(collectionId, { returnTo }));
    setRoute({ kind: "collection", collectionId, returnTo });
    setArchivePanel(null);
  };

  const closeItemDetail = () => {
    if (route.kind === "item" && route.returnCollectionId) {
      window.history.pushState(null, "", buildCollectionUrl(route.returnCollectionId));
      setRoute({ kind: "collection", collectionId: route.returnCollectionId });
    } else {
      window.history.pushState(null, "", buildArchiveUrl(itemCardFilters, galleryObjectMode, archiveViewMode));
      setRoute({ kind: "grid" });
    }
  };

  const exitItemDetailToArchive = () => {
    window.history.pushState(null, "", buildArchiveUrl(itemCardFilters, galleryObjectMode, archiveViewMode));
    setRoute({ kind: "grid" });
  };

  const closeCollection = () => {
    if (route.kind === "collection" && route.returnTo && isSafeInternalReturnPath(route.returnTo)) {
      window.history.pushState(null, "", route.returnTo);
      setRoute(getRouteFromLocation());
      setItemCardFilters(getFiltersFromLocation());
      setGalleryObjectMode(getGalleryObjectModeFromLocation());
      setArchiveViewMode(getArchiveViewModeFromLocation());
      return;
    }

    window.history.pushState(null, "", buildArchiveUrl(itemCardFilters, galleryObjectMode, archiveViewMode));
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
        window.history.pushState(null, "", buildArchiveUrl(itemCardFilters, galleryObjectMode, archiveViewMode));
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

  const deleteArchiveCardItem = async (itemId: string) => {
    if (!isPocketBaseMode) {
      throw new Error("Live archive mode required.");
    }

    await itemDeleteWriter.deleteItem({
      workspaceId,
      itemId,
      actor: "system",
    });
    await refreshArchiveCollectionState();
    setSelectedItemIds((currentSelection) => currentSelection.filter((selectedItemId) => selectedItemId !== itemId));

    if (cardCollectionItem?.id === itemId) {
      closeArchiveCardCollection();
    }
  };

  const deleteCollectionWorkspaceItem = async (itemId: string, collectionId: string) => {
    if (!isPocketBaseMode) {
      throw new Error("Live archive mode required.");
    }

    await itemDeleteWriter.deleteItem({
      workspaceId,
      itemId,
      actor: "system",
    });
    await refreshCollectionWorkspaceState(collectionId);
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

  const updateItemNote = async ({
    body,
    format,
  }: {
    body: string;
    format?: "plain" | "markdown" | "blocknote";
  }) => {
    if (!detail || detail.type !== "note") {
      return;
    }

    if (!isPocketBaseMode) {
      setNoteWriteError("Note editing requires live archive mode.");
      throw new Error("Live archive mode required.");
    }

    setIsNoteSaving(true);
    setNoteWriteError(null);

    try {
      await itemNoteWriter.updateItemNote({
        workspaceId,
        itemId: detail.id,
        body,
        format,
        actor: "system",
      });

      const collectionRefresh =
        route.kind === "item" && route.returnCollectionId
          ? itemCollectionClient.getCollectionDetail({
              workspaceId,
              collectionId: route.returnCollectionId,
            })
          : Promise.resolve(null);
      const [nextDetail, nextItems, nextCollectionDetail] = await Promise.all([
        itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id }),
        itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters }),
        collectionRefresh,
      ]);

      setDetail(nextDetail);
      setItems(nextItems);
      if (nextCollectionDetail) {
        setCollectionDetail(nextCollectionDetail);
      }
    } catch (error: unknown) {
      console.error(error);
      setNoteWriteError("Unable to save note.");
      throw error;
    } finally {
      setIsNoteSaving(false);
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

  const removeItemFromCollection = async ({ collectionId }: { collectionId: string }) => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsCollectionAttaching(true);
    setCollectionWriteError(null);

    try {
      await itemCollectionClient.removeCollection({
        workspaceId,
        itemId: detail.id,
        collectionId,
        actor: "system",
      });

      const collectionRefresh =
        route.kind === "item" && route.returnCollectionId
          ? itemCollectionClient.getCollectionDetail({
              workspaceId,
              collectionId: route.returnCollectionId,
            })
          : Promise.resolve(null);

      const [nextDetail, nextCollectionOptions, nextItems, nextCollectionDetail] = await Promise.all([
        itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id }),
        itemCollectionClient.listCollectionOptions({ workspaceId, itemId: detail.id }),
        itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters }),
        collectionRefresh,
      ]);

      setDetail(nextDetail);
      setCollectionOptions(nextCollectionOptions);
      setItems(nextItems);
      if (nextCollectionDetail) {
        setCollectionDetail(nextCollectionDetail);
      }
    } catch (error: unknown) {
      console.error(error);
      setCollectionWriteError("Unable to remove collection.");
      throw error;
    } finally {
      setIsCollectionAttaching(false);
    }
  };

  const openArchiveCardCollection = async (itemId: string, anchor: ItemCardActionAnchor) => {
    const item = items.find((candidate) => candidate.id === itemId);

    if (!item) {
      return;
    }

    if (cardCollectionItem?.id === itemId) {
      closeArchiveCardCollection();
      return;
    }

    window.dispatchEvent(new CustomEvent<ItemCardSurfaceDetail>(itemCardSurfaceEvent, {
      detail: { itemId, surface: "collection" },
    }));
    setCardCollectionItem(item);
    setCardCollectionAnchor(getCardCollectionIslandPosition(anchor));
    setCardCollectionOptions([]);
    setCardCollectionError(null);

    if (!isPocketBaseMode) {
      setCardCollectionError("Live archive mode required.");
      return;
    }

    setIsCardCollectionLoading(true);
    try {
      const nextOptions = await itemCollectionClient.listCollectionOptions({ workspaceId, itemId });
      setCardCollectionOptions(nextOptions);
    } catch (error: unknown) {
      console.error(error);
      setCardCollectionOptions([]);
      setCardCollectionError("Unable to load collections.");
    } finally {
      setIsCardCollectionLoading(false);
    }
  };

  const closeArchiveCardCollection = () => {
    setCardCollectionItem(null);
    setCardCollectionAnchor(null);
    setCardCollectionOptions([]);
    setCardCollectionError(null);
    setIsCardCollectionLoading(false);
    setIsCardCollectionWriting(false);
  };

  const refreshArchiveCollectionState = async () => {
    const [nextItems, nextCollections] = await Promise.all([
      itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters }),
      itemCollectionClient.listCollectionIndex({ workspaceId }),
    ]);

    setItems(nextItems);
    setCollectionIndex(nextCollections);
    return { nextCollections, nextItems };
  };

  const refreshCollectionWorkspaceState = async (collectionId: string) => {
    const [nextCollection, nextItems, nextCollections] = await Promise.all([
      itemCollectionClient.getCollectionDetail({ workspaceId, collectionId }),
      itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters }),
      itemCollectionClient.listCollectionIndex({ workspaceId }),
    ]);

    setCollectionDetail(nextCollection);
    setItems(nextItems);
    setCollectionIndex(nextCollections);
  };

  const openCreateCollectionIsland = () => {
    setIsCreateCollectionOpen(true);
    setCreateCollectionError(isPocketBaseMode ? null : "Live archive mode required.");
  };

  const closeCreateCollectionIsland = () => {
    if (isCreateCollectionPending) {
      return;
    }

    setIsCreateCollectionOpen(false);
    setCreateCollectionError(null);
  };

  const createBlankCollection = async ({
    description,
    name,
  }: {
    description: string | null;
    name: string;
  }) => {
    if (!isPocketBaseMode) {
      setCreateCollectionError("Live archive mode required.");
      return;
    }

    setIsCreateCollectionPending(true);
    setCreateCollectionError(null);

    try {
      const result = await itemCollectionClient.createCollection({
        workspaceId,
        name,
        description: description ?? undefined,
        actor: "system",
      });
      await refreshArchiveCollectionState();
      setIsCreateCollectionOpen(false);
      openCollection(result.collection.id);
    } catch (error: unknown) {
      console.error(error);
      setCreateCollectionError("Unable to create collection.");
    } finally {
      setIsCreateCollectionPending(false);
    }
  };

  const removeCollectionWorkspaceItems = async ({
    collectionId,
    itemIds,
  }: {
    collectionId: string;
    itemIds: string[];
  }) => {
    if (!isPocketBaseMode) {
      throw new Error("Live archive mode required.");
    }

    for (const itemId of itemIds) {
      await itemCollectionClient.removeCollection({
        workspaceId,
        itemId,
        collectionId,
        actor: "system",
      });
    }

    await refreshCollectionWorkspaceState(collectionId);
  };

  const addCollectionWorkspaceItemsToCollection = async ({
    collectionId,
    itemIds,
    sourceCollectionId,
  }: {
    collectionId: string;
    itemIds: string[];
    sourceCollectionId: string;
  }) => {
    if (!isPocketBaseMode) {
      throw new Error("Live archive mode required.");
    }

    let attachedCount = 0;
    let failedCount = 0;

    for (const itemId of itemIds) {
      try {
        await itemCollectionClient.attachCollection({
          workspaceId,
          itemId,
          collectionId,
          actor: "system",
        });
        attachedCount += 1;
      } catch (error: unknown) {
        console.error(error);
        failedCount += 1;
      }
    }

    await refreshCollectionWorkspaceState(sourceCollectionId);

    if (attachedCount === 0 && failedCount > 0) {
      throw new Error("Selected items are already in that collection or could not be added.");
    }
  };

  const createCollectionFromCollectionWorkspaceItems = async ({
    description,
    itemIds,
    name,
    sourceCollectionId,
  }: {
    description: string | null;
    itemIds: string[];
    name: string;
    sourceCollectionId: string;
  }) => {
    const [firstItemId, ...remainingItemIds] = itemIds;

    if (!firstItemId) {
      return;
    }

    if (!isPocketBaseMode) {
      throw new Error("Live archive mode required.");
    }

    const result = await itemCollectionClient.createCollectionAndAttach({
      workspaceId,
      itemId: firstItemId,
      name,
      description: description ?? undefined,
      actor: "system",
    });

    for (const itemId of remainingItemIds) {
      await itemCollectionClient.attachCollection({
        workspaceId,
        itemId,
        collectionId: result.collection.id,
        actor: "system",
      });
    }

    await refreshCollectionWorkspaceState(sourceCollectionId);
  };

  const importFilesToCollection = async ({
    collectionId,
    files,
  }: {
    collectionId: string;
    files: File[];
  }) => {
    if (!isPocketBaseMode) {
      throw new Error("Live archive mode required.");
    }

    for (const file of files) {
      const kind = getCollectionImportFileKind(file);
      if (!kind) {
        throw new Error("Only image and PDF files can be imported into a collection.");
      }

      const captureResult =
        kind === "pdf"
          ? await itemCaptureWriter.capturePdf({
              workspaceId,
              type: "pdf",
              file,
              actor: "system",
            })
          : await itemCaptureWriter.captureImage({
              workspaceId,
              type: "image",
              file,
              actor: "system",
            });

      await itemCollectionClient.attachCollection({
        workspaceId,
        itemId: captureResult.item.id,
        collectionId,
        actor: "system",
      });
    }

    await refreshCollectionWorkspaceState(collectionId);
  };

  const createNoteInCollection = async ({
    body,
    collectionId,
  }: {
    body: string;
    collectionId: string;
  }) => {
    if (!isPocketBaseMode) {
      throw new Error("Live archive mode required.");
    }

    const captureResult = await itemCaptureWriter.captureNote({
      workspaceId,
      type: "note",
      body,
      sourceExternalId: captureSourceExternalId(),
      actor: "system",
    });

    await itemCollectionClient.attachCollection({
      workspaceId,
      itemId: captureResult.item.id,
      collectionId,
      actor: "system",
    });

    await refreshCollectionWorkspaceState(collectionId);
  };

  const toggleArchiveItemSelection = (itemId: string) => {
    setSelectionWriteError(null);
    closeArchiveCardCollection();
    setSelectedItemIds((currentSelection) =>
      currentSelection.includes(itemId)
        ? currentSelection.filter((selectedItemId) => selectedItemId !== itemId)
        : [...currentSelection, itemId],
    );
  };

  const clearArchiveSelection = () => {
    setSelectedItemIds([]);
    setSelectionWriteError(null);
  };

  const addSelectedItemsToCollection = async (collectionId: string) => {
    if (selectedItemIds.length === 0) {
      return;
    }

    if (!isPocketBaseMode) {
      setSelectionWriteError("Live archive mode required.");
      return;
    }

    setIsSelectionWriting(true);
    setSelectionWriteError(null);

    let attachedCount = 0;
    let failedCount = 0;

    try {
      for (const itemId of selectedItemIds) {
        try {
          await itemCollectionClient.attachCollection({
            workspaceId,
            itemId,
            collectionId,
            actor: "system",
          });
          attachedCount += 1;
        } catch (error: unknown) {
          console.error(error);
          failedCount += 1;
        }
      }

      await refreshArchiveCollectionState();

      if (attachedCount > 0) {
        setSelectedItemIds([]);
      } else if (failedCount > 0) {
        setSelectionWriteError("Selected items are already in that collection or could not be added.");
      }
    } catch (error: unknown) {
      console.error(error);
      setSelectionWriteError("Unable to add selected items.");
    } finally {
      setIsSelectionWriting(false);
    }
  };

  const createCollectionFromSelectedItems = async ({
    description,
    name,
  }: {
    description: string | null;
    name: string;
  }) => {
    const [firstItemId, ...remainingItemIds] = selectedItemIds;

    if (!firstItemId) {
      return;
    }

    if (!isPocketBaseMode) {
      setSelectionWriteError("Live archive mode required.");
      return;
    }

    setIsSelectionWriting(true);
    setSelectionWriteError(null);

    try {
      const result = await itemCollectionClient.createCollectionAndAttach({
        workspaceId,
        itemId: firstItemId,
        name,
        description: description ?? undefined,
        actor: "system",
      });

      for (const itemId of remainingItemIds) {
        await itemCollectionClient.attachCollection({
          workspaceId,
          itemId,
          collectionId: result.collection.id,
          actor: "system",
        });
      }

      await refreshArchiveCollectionState();
      setSelectedItemIds([]);
    } catch (error: unknown) {
      console.error(error);
      setSelectionWriteError("Unable to create collection from selection.");
    } finally {
      setIsSelectionWriting(false);
    }
  };

  const toggleArchiveCardCollectionMembership = async (collectionId: string, alreadyAttached: boolean) => {
    if (!cardCollectionItem || !isPocketBaseMode) {
      return;
    }

    setIsCardCollectionWriting(true);
    setCardCollectionError(null);
    try {
      if (alreadyAttached) {
        await itemCollectionClient.removeCollection({
          workspaceId,
          itemId: cardCollectionItem.id,
          collectionId,
          actor: "system",
        });
      } else {
        await itemCollectionClient.attachCollection({
          workspaceId,
          itemId: cardCollectionItem.id,
          collectionId,
          actor: "system",
        });
      }

      const [{ nextItems }, nextOptions] = await Promise.all([
        refreshArchiveCollectionState(),
        itemCollectionClient.listCollectionOptions({ workspaceId, itemId: cardCollectionItem.id }),
      ]);
      setCardCollectionItem(nextItems.find((item) => item.id === cardCollectionItem.id) ?? cardCollectionItem);
      setCardCollectionOptions(nextOptions);
    } catch (error: unknown) {
      console.error(error);
      setCardCollectionError(alreadyAttached ? "Unable to remove from collection." : "Unable to add to collection.");
    } finally {
      setIsCardCollectionWriting(false);
    }
  };

  const createArchiveCardCollection = async ({
    description,
    name,
  }: {
    description: string | null;
    name: string;
  }) => {
    if (!cardCollectionItem || !isPocketBaseMode) {
      return;
    }

    setIsCardCollectionWriting(true);
    setCardCollectionError(null);
    try {
      await itemCollectionClient.createCollectionAndAttach({
        workspaceId,
        itemId: cardCollectionItem.id,
        name,
        description: description ?? undefined,
        actor: "system",
      });

      const [{ nextItems }, nextOptions] = await Promise.all([
        refreshArchiveCollectionState(),
        itemCollectionClient.listCollectionOptions({ workspaceId, itemId: cardCollectionItem.id }),
      ]);
      setCardCollectionItem(nextItems.find((item) => item.id === cardCollectionItem.id) ?? cardCollectionItem);
      setCardCollectionOptions(nextOptions);
    } catch (error: unknown) {
      console.error(error);
      setCardCollectionError("Unable to create collection.");
    } finally {
      setIsCardCollectionWriting(false);
    }
  };

  const updateArchiveCollection = async ({
    collectionId,
    description,
    name,
  }: {
    collectionId: string;
    description: string | null;
    name: string;
  }) => {
    if (!isPocketBaseMode) {
      setCollectionUpdateError("Collection editing requires live archive mode.");
      return;
    }

    setIsCollectionUpdating(true);
    setCollectionUpdateError(null);

    try {
      const result = await itemCollectionClient.updateCollection({
        workspaceId,
        collectionId,
        name,
        description,
        actor: "system",
      });

      setCollectionIndex((current) =>
        current.map((collection) =>
          collection.id === result.collection.id
            ? {
                ...collection,
                ...result.collection,
                previewItems: result.collection.previewItems.length > 0 ? result.collection.previewItems : collection.previewItems,
              }
            : collection,
        ),
      );
      setCollectionDetail((current) =>
        current?.id === result.collection.id
          ? {
              ...current,
              name: result.collection.name,
              description: result.collection.description,
              lastUpdatedAt: result.collection.lastUpdatedAt,
            }
          : current,
      );
    } catch (error: unknown) {
      console.error(error);
      setCollectionUpdateError("Unable to update collection.");
      throw error;
    } finally {
      setIsCollectionUpdating(false);
    }
  };

  const captureArchiveInput = async (captureInput: SpotlightCaptureRequest) => {
    if (!isPocketBaseMode) {
      return;
    }

    setIsCapturing(true);
    setCaptureError(null);
    setCaptureNotice(null);

    try {
      let captureResult: { created: boolean };

      if (captureInput.type === "link") {
        const normalizedUrl = normalizeCaptureUrl(captureInput.url);

        captureResult = await itemCaptureWriter.captureUrl({
          workspaceId,
          type: "link",
          url: normalizedUrl,
          sourceExternalId: normalizedUrl,
          actor: "system",
        });
      } else if (captureInput.type === "image") {
        captureResult = await itemCaptureWriter.captureImage({
          workspaceId,
          type: "image",
          file: captureInput.file,
          actor: "system",
        });
      } else if (captureInput.type === "pdf") {
        captureResult = await itemCaptureWriter.capturePdf({
          workspaceId,
          type: "pdf",
          file: captureInput.file,
          actor: "system",
        });
      } else {
        captureResult = await itemCaptureWriter.captureNote({
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
      setCaptureNotice(
        captureInput.type === "link"
          ? "Imported URL."
          : captureInput.type === "image"
            ? "Imported image."
            : captureInput.type === "pdf"
              ? "Imported PDF."
            : "Added note.",
      );
      return {
        created: captureResult.created,
      };
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

  const updateFormatFilter = (format: ArchiveFormatFilter) => {
    setItemCardFilters((currentFilters) => ({
      ...currentFilters,
      format: format === "all" ? undefined : format,
    }));
  };

  const updateCollectionFilter = (collection: string) => {
    setItemCardFilters((currentFilters) => ({
      ...currentFilters,
      collection: collection === "all" ? undefined : collection,
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

  const updateMasonryColumns = (columns: number) => {
    setMasonryColumns(Math.min(maxMasonryColumns, Math.max(minMasonryColumns, columns)));
  };

  const updateArchiveViewMode = (mode: ArchiveViewMode) => {
    setArchiveViewMode(mode);
    setArchivePanel("views");
  };

  const updateShortcutBinding = (action: ShortcutAction, binding: ShortcutBinding) => {
    const conflict = getShortcutConflict(action, binding, shortcutBindings);

    if (conflict) {
      setShortcutError(`${formatShortcutBinding(binding)} is already used for ${formatShortcutAction(conflict)}.`);
      return false;
    }

    setShortcutBindings((currentBindings) => ({
      ...currentBindings,
      [action]: binding,
    }));
    setShortcutError(null);
    return true;
  };

  const resetShortcutBindings = () => {
    setShortcutBindings(defaultShortcutBindings);
    setShortcutError(null);
  };

  const archiveSelectedItems = async () => {
    if (selectedItemIds.length === 0) {
      return;
    }

    if (!isPocketBaseMode) {
      setSelectionWriteError("Live archive mode required.");
      return;
    }

    setIsSelectionWriting(true);
    setSelectionWriteError(null);

    try {
      for (const itemId of selectedItemIds) {
        await itemStatusWriter.updateItemStatus({
          workspaceId,
          itemId,
          nextStatus: "archived",
          actor: "system",
        });
      }

      await refreshArchiveCollectionState();
      setSelectedItemIds([]);
    } catch (error: unknown) {
      console.error(error);
      setSelectionWriteError("Unable to archive selected items.");
    } finally {
      setIsSelectionWriting(false);
    }
  };

  const previousRouteKeyRef = useRef<string>(routeKey(route));
  const [renderedRoute, setRenderedRoute] = useState<AppRoute>(route);
  const [routeTransitionToken, setRouteTransitionToken] = useState(0);

  useEffect(() => {
    const previousKey = previousRouteKeyRef.current;
    const currentKey = routeKey(route);

    if (previousKey === currentKey) {
      setRenderedRoute(route);
      return;
    }

    previousRouteKeyRef.current = currentKey;
    setRenderedRoute(route);
    setRouteTransitionToken((currentToken) => currentToken + 1);
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
  }, [route]);

  let routeContent: ReactNode = null;
  const archiveNav =
    renderedRoute.kind === "grid" ? (
      <PillNav
        activePanel={archivePanel}
        collectionCount={collectionIndex.length}
        collectionIndex={collectionIndex}
        filters={itemCardFilters}
        galleryColumns={effectiveGalleryColumns}
        itemCount={items.length}
        masonryColumns={masonryColumns}
        viewMode={archiveViewMode}
        isPocketBaseMode={isPocketBaseMode}
        loading={isLoading}
        onClearFilters={clearArchiveFilters}
        objectMode={galleryObjectMode}
        onCollectionFilterChange={updateCollectionFilter}
        onObjectModeChange={setGalleryObjectMode}
        onViewModeChange={updateArchiveViewMode}
        onGalleryColumnsChange={updateGalleryColumns}
        onMasonryColumnsChange={updateMasonryColumns}
        onFormatChange={updateFormatFilter}
        onPanelChange={setArchivePanel}
        onSiteThemeChange={setSiteTheme}
        onSourceChange={updateSourceFilter}
        onStatusChange={updateStatusFilter}
        onTypeChange={updateTypeFilter}
        readError={readError}
        shortcutBindings={shortcutBindings}
        shortcutError={shortcutError}
        siteTheme={siteTheme}
        onShortcutChange={updateShortcutBinding}
        onShortcutReset={resetShortcutBindings}
        statusOptions={statusFilterOptions}
        sourceOptions={sourceFilterOptions}
        formatOptions={formatFilterOptions}
      />
    ) : null;

  if (renderedRoute.kind === "pdfPreview") {
    routeContent = (
      <PdfPreview
        src={renderedRoute.src}
        name={renderedRoute.name ?? null}
        surface={renderedRoute.surface ?? "reader"}
      />
    );
  } else if (renderedRoute.kind === "collection") {
    const renderedCollectionDetail =
      collectionDetail?.id === renderedRoute.collectionId ? collectionDetail : null;
    const renderedCollectionLoading =
      isCollectionLoading || (!collectionReadError && !renderedCollectionDetail);

    routeContent = (
      <main className="app-shell" aria-label="Vita collection">
        <Suspense fallback={<RouteChunkLoadingState label="Loading collection." />}>
          <LazyCollectionView
            collection={renderedCollectionDetail}
            collectionIndex={collectionIndex}
            loading={renderedCollectionLoading}
            error={collectionReadError}
            onBack={closeCollection}
            onAddItemsToCollection={addCollectionWorkspaceItemsToCollection}
            onCreateCollectionFromItems={createCollectionFromCollectionWorkspaceItems}
            onCreateNoteInCollection={createNoteInCollection}
            onImportFilesToCollection={importFilesToCollection}
            onOpenItem={openCollectionItemDetail}
            onDeleteItem={deleteCollectionWorkspaceItem}
            onRemoveItemsFromCollection={removeCollectionWorkspaceItems}
            onUpdateCollection={updateArchiveCollection}
            collectionUpdatePending={isCollectionUpdating}
            collectionUpdateError={collectionUpdateError}
          />
        </Suspense>
      </main>
    );
  } else if (renderedRoute.kind === "item") {
    const renderedDetail = detail?.id === renderedRoute.itemId ? detail : null;
    const renderedDetailLoading = isDetailLoading || (!detailError && !renderedDetail);
    const currentItemId = renderedDetail?.id ?? renderedRoute.itemId;
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
        <Suspense fallback={<RouteChunkLoadingState label="Loading archive object." />}>
          <LazyItemDetailView
            item={renderedDetail}
            loading={renderedDetailLoading}
            error={detailError}
            archiveContext={archiveContextLabel}
            archiveFlow={archiveFlow}
            backLabel={renderedRoute.returnCollectionId ? "Back to collection" : "Back to archive"}
            onBack={closeItemDetail}
            onExitToArchive={exitItemDetailToArchive}
            onOpenCollection={openCollectionFromItemDetail}
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
            onUpdateNote={updateItemNote}
            noteActionPending={isNoteSaving}
            noteActionError={noteWriteError}
            onAttachCollection={attachItemToCollection}
            onRemoveCollection={removeItemFromCollection}
            collectionActionPending={isCollectionAttaching}
            collectionActionError={collectionWriteError}
            collectionOptions={collectionTargetOptions}
            collectionIndex={collectionIndex}
          />
        </Suspense>
      </main>
    );
  } else {
    const showInitialArchiveLoading = isLoading && items.length === 0;
    const renderedItems = items.map((item) => ({
      ...item,
      activeFilters: itemCardFilters,
      ...(isPocketBaseMode
        ? {
            detailHref: buildItemDetailUrl(item.id, itemCardFilters, { mode: galleryObjectMode, view: archiveViewMode }),
            isSelected: selectedItemIds.includes(item.id),
            isCollectionPickerOpen: cardCollectionItem?.id === item.id,
            onAddToCollection: openArchiveCardCollection,
            onDelete: deleteArchiveCardItem,
            onNavigate: openItemDetail,
            onSelectToggle: toggleArchiveItemSelection,
          }
        : {
            isSelected: selectedItemIds.includes(item.id),
            isCollectionPickerOpen: cardCollectionItem?.id === item.id,
            onAddToCollection: openArchiveCardCollection,
            onDelete: undefined,
            onNavigate: openItemDetail,
            onSelectToggle: toggleArchiveItemSelection,
          }),
    }));
    const renderedCollections = filterCollectionCards(collectionIndex, itemCardFilters).map((collection) =>
      toCollectionCardModel(collection, openCollection),
    );
    const archiveObjects = buildArchiveObjects({
      collections: renderedCollections,
      items: renderedItems,
      mode: galleryObjectMode,
      onCreateCollection: openCreateCollectionIsland,
    });
    const showInitialCollectionsLoading =
      galleryObjectMode === "collections" && isCollectionIndexLoading && collectionIndex.length === 0;
    const galleryLoading = showInitialArchiveLoading || showInitialCollectionsLoading;

    routeContent = (
      <main className="app-shell app-shell--archive" aria-label="Vita archive">
        <h1 className="visually-hidden">Archive</h1>
        <section className="archive-canvas" aria-label="archive objects">
          {archiveViewMode === "gallery" ? (
            <MasonryGrid
              objects={archiveObjects}
              density="comfortable"
              columns={effectiveGalleryColumns}
              loading={galleryLoading}
              emptyState={
                <ArchiveEmptyState
                  collectionError={collectionIndexError}
                  objectMode={galleryObjectMode}
                  filters={itemCardFilters}
                  readError={readError}
                  onClearFilters={clearArchiveFilters}
                />
              }
              ariaLabel="archive objects"
            />
          ) : archiveViewMode === "masonry" ? (
            <MasonryView
              objects={archiveObjects}
              columns={masonryColumns}
              loading={galleryLoading}
              emptyState={
                <ArchiveEmptyState
                  collectionError={collectionIndexError}
                  objectMode={galleryObjectMode}
                  filters={itemCardFilters}
                  readError={readError}
                  onClearFilters={clearArchiveFilters}
                />
              }
              ariaLabel="masonry archive objects"
            />
          ) : (
            <ArchiveComingSoonState
              viewMode={archiveViewMode}
              objectMode={galleryObjectMode}
              onBackToGallery={() => setArchiveViewMode("gallery")}
            />
          )}
        </section>
      </main>
    );
  }

  return (
    <>
      {archiveNav}
      <div className="app-route-shell" key={routeTransitionToken}>
        {routeContent}
      </div>
      {renderedRoute.kind === "grid" && cardCollectionItem ? (
        <CardCollectionIsland
          anchor={cardCollectionAnchor}
          item={cardCollectionItem}
          options={cardCollectionOptions}
          loading={isCardCollectionLoading}
          pending={isCardCollectionWriting}
          collectionIndex={collectionIndex}
          error={cardCollectionError}
          onToggle={toggleArchiveCardCollectionMembership}
          onClose={closeArchiveCardCollection}
          onCreate={createArchiveCardCollection}
        />
      ) : null}
      {renderedRoute.kind === "grid" && isCreateCollectionOpen ? (
        <CreateCollectionIsland
          error={createCollectionError}
          pending={isCreateCollectionPending}
          onClose={closeCreateCollectionIsland}
          onCreate={createBlankCollection}
        />
      ) : null}
      {renderedRoute.kind === "grid" && (archiveViewMode === "gallery" || archiveViewMode === "masonry") && selectedItemIds.length > 0 ? (
        <SelectionActionBar
          collections={collectionIndex}
          error={selectionWriteError}
          pending={isSelectionWriting}
          selectedCount={selectedItemIds.length}
          onAddToCollection={addSelectedItemsToCollection}
          onArchive={archiveSelectedItems}
          onClear={clearArchiveSelection}
          onCreate={createCollectionFromSelectedItems}
        />
      ) : null}
      {renderedRoute.kind === "grid" ? (
        <SpotlightDock
          value={itemCardFilters.text ?? ""}
          onChange={updateTextFilter}
          isPocketBaseMode={isPocketBaseMode}
          pendingCapture={isCapturing}
          captureError={captureError}
          captureNotice={captureNotice}
          searchShortcut={shortcutBindings.search}
          onCapture={captureArchiveInput}
          onOpen={() => setArchivePanel(null)}
        />
      ) : null}
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

  if (r.kind === "pdfPreview") {
    return `pdf-preview:${r.surface ?? "reader"}:${r.src}`;
  }

  return `item:${r.itemId}`;
}

function buildArchiveObjects({
  collections,
  items,
  mode,
  onCreateCollection,
}: {
  collections: CollectionCardModel[];
  items: ItemCardProps[];
  mode: GalleryObjectMode;
  onCreateCollection: () => void;
}): ArchiveObject[] {
  if (mode === "items") {
    return items.map((item) => ({ objectType: "item" as const, item }));
  }

  if (mode === "collections") {
    return [
      { objectType: "collection-create" as const, onCreateCollection },
      ...collections.map((collection) => ({ objectType: "collection" as const, collection })),
    ];
  }

  return [
    ...collections.map((collection) => ({ objectType: "collection" as const, collection })),
    ...items.map((item) => ({ objectType: "item" as const, item })),
  ];
}

function getCollectionImportFileKind(file: File): "image" | "pdf" | null {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }

  return null;
}

function toCollectionCardModel(
  collection: CollectionIndexItem,
  onNavigate: (collectionId: string) => void,
): CollectionCardModel {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    pieceCount: collection.pieceCount,
    kindSummary: collection.kindSummary,
    lastUpdatedAt: collection.lastUpdatedAt,
    previewItems: collection.previewItems,
    href: buildCollectionUrl(collection.id),
    onNavigate,
  };
}

function filterCollectionCards(collections: CollectionIndexItem[], filters: ItemCardFilters) {
  return collections.filter((collection) => collectionMatchesFilters(collection, filters));
}

function collectionMatchesFilters(collection: CollectionIndexItem, filters: ItemCardFilters) {
  if (filters.collection === "none") {
    return false;
  }

  if (filters.collection && collection.id !== filters.collection) {
    return false;
  }

  if (filters.text?.trim()) {
    const query = filters.text.trim().toLowerCase();
    const haystack = [
      collection.name,
      collection.description,
      collection.kindSummary,
      ...collection.previewItems.map((item) => `${item.title ?? ""} ${item.textPreview ?? ""} ${item.sourceUrl ?? ""}`),
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(query)) {
      return false;
    }
  }

  if (filters.type && !collectionHasKind(collection, filters.type)) {
    return false;
  }

  if (filters.format && !collectionHasFormat(collection, filters.format)) {
    return false;
  }

  if (filters.source && !collection.previewItems.some((item) => item.source === filters.source)) {
    return false;
  }

  return true;
}

function collectionHasKind(collection: CollectionIndexItem, type: ItemType) {
  const kindSummary = collection.kindSummary.toLowerCase();
  if (kindSummary.includes(type)) {
    return true;
  }

  return collection.previewItems.some((item) => item.kind === type);
}

function collectionHasFormat(collection: CollectionIndexItem, format: ItemFormatFilter) {
  if (format === "website") {
    return collection.previewItems.some(
      (item) => item.kind === "link" && (!item.format || item.format === "website" || item.format === "unknown"),
    );
  }

  return collection.previewItems.some((item) => item.format === format);
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

function RouteChunkLoadingState({ label }: { label: string }) {
  return (
    <div className="archive-state archive-state--loading" role="status" aria-live="polite">
      <span className="archive-state__kicker">loading</span>
      <p className="archive-state__copy">{label}</p>
    </div>
  );
}

function ArchiveEmptyState({
  collectionError,
  filters,
  objectMode,
  readError,
  onClearFilters,
}: {
  collectionError: string | null;
  filters: ItemCardFilters;
  objectMode: GalleryObjectMode;
  readError: string | null;
  onClearFilters: () => void;
}) {
  const hasFilters = hasActiveFilters(filters);
  const filterSummary = formatFilterSummary(filters);
  const objectLabel = formatGalleryObjectModeLabel(objectMode);

  if (readError) {
    const { copy, title } = getLoadErrorDisplay(readError);
    return (
      <div className="archive-state archive-state--error" role="alert">
        <span className="archive-state__kicker">load error</span>
        <h2 className="archive-state__title">{title}</h2>
        <p className="archive-state__copy">{copy}</p>
      </div>
    );
  }

  if (collectionError) {
    const { copy, title } = getLoadErrorDisplay(collectionError);
    return (
      <div className="archive-state archive-state--error" role="alert">
        <span className="archive-state__kicker">load error</span>
        <h2 className="archive-state__title">{title}</h2>
        <p className="archive-state__copy">{copy}</p>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="archive-state">
        <span className="archive-state__kicker">empty {objectLabel}</span>
        <h2 className="archive-state__title">
          {filters.text?.trim() ? "No results match this search." : `No ${objectLabel} match these filters.`}
        </h2>
        <p className="archive-state__copy">{filterSummary || "Clear the active filters to return to Gallery."}</p>
        <button className="text-button" type="button" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }

  if (objectMode === "collections") {
    return (
      <div className="archive-state">
        <span className="archive-state__kicker">empty collections</span>
        <h2 className="archive-state__title">No collections yet.</h2>
        <p className="archive-state__copy">Select items in Gallery and create a collection to make it appear here.</p>
      </div>
    );
  }

  if (objectMode === "items") {
    return (
      <div className="archive-state">
        <span className="archive-state__kicker">empty items</span>
        <h2 className="archive-state__title">No items in Gallery yet.</h2>
        <p className="archive-state__copy">Use Import to add notes, links, images, or PDFs.</p>
      </div>
    );
  }

  return (
    <div className="archive-state">
      <span className="archive-state__kicker">empty Gallery</span>
      <h2 className="archive-state__title">Gallery is empty.</h2>
      <p className="archive-state__copy">Use Import to add archive items, then collect related pieces into Collections.</p>
    </div>
  );
}

function ArchiveComingSoonState({
  objectMode,
  onBackToGallery,
  viewMode,
}: {
  objectMode: GalleryObjectMode;
  onBackToGallery: () => void;
  viewMode: Exclude<ArchiveViewMode, "gallery" | "masonry">;
}) {
  const isGraph = viewMode === "graph";

  return (
    <div className="archive-state archive-state--view">
      <span className="archive-state__kicker">{viewMode} view</span>
      <h2 className="archive-state__title">
        {isGraph ? "Graph view is not built yet." : "List view is not built yet."}
      </h2>
      <p className="archive-state__copy">
        {isGraph
          ? "Graph will show relationships between archive items and Collections when that interaction is ready."
          : `List will provide a compact scanner for ${formatGalleryObjectModeLabel(objectMode)} without changing the archive data model.`}
      </p>
      <button className="text-button" type="button" onClick={onBackToGallery}>
        Back to Gallery
      </button>
    </div>
  );
}

function CreateCollectionIsland({
  error,
  onClose,
  onCreate,
  pending,
}: {
  error: string | null;
  onClose: () => void;
  onCreate: (input: { name: string; description: string | null }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canCreate = name.trim().length > 0 && !pending;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) {
      return;
    }

    onCreate({
      name: name.trim(),
      description: description.trim() || null,
    });
  };

  return (
    <section className="create-collection-island" role="dialog" aria-label="create collection" aria-modal="true">
      <form className="create-collection-island__form" onSubmit={submitCreate}>
        <div className="create-collection-island__header">
          <span>
            <small>new object</small>
            <strong>Create collection</strong>
          </span>
          <button className="card-collection-island__cell" type="button" disabled={pending} onClick={onClose}>
            Cancel
          </button>
        </div>
        <label>
          <span>Name</span>
          <input
            autoFocus
            disabled={pending}
            maxLength={maxCollectionTitleLength}
            onChange={(event) => setName(event.target.value.slice(0, maxCollectionTitleLength))}
            placeholder="Collection name"
            value={name}
          />
        </label>
        <label>
          <span>Description optional</span>
          <textarea
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What belongs here?"
            rows={3}
            value={description}
          />
        </label>
        <button className="card-collection-island__cell" disabled={!canCreate} type="submit">
          {pending ? "Creating" : "Create"}
        </button>
        {error ? <span className="card-collection-island__error">{error}</span> : null}
      </form>
    </section>
  );
}

function CardCollectionIsland({
  anchor,
  collectionIndex,
  error,
  item,
  loading,
  onClose,
  onCreate,
  onToggle,
  options,
  pending,
}: {
  anchor: CardCollectionIslandPosition | null;
  collectionIndex: CollectionIndexItem[];
  error: string | null;
  item: ItemCardProps;
  loading: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; description: string | null }) => void;
  onToggle: (collectionId: string, alreadyAttached: boolean) => void;
  options: CollectionOption[];
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const islandRef = useRef<HTMLElement | null>(null);
  const itemLabel = item.title ?? item.ogTitle ?? item.url ?? item.type;
  const canCreate = name.trim().length > 0 && !pending;
  const normalizedQuery = query.trim().toLowerCase();
  const enrichedOptions = options
    .map((option) => ({
      ...option,
      index: collectionIndex.find((collection) => collection.id === option.id) ?? null,
    }))
    .filter((option) => {
      if (!normalizedQuery) {
        return true;
      }

      return [option.name, option.description, option.index?.kindSummary]
        .filter((part): part is string => Boolean(part))
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((first, second) => Number(second.alreadyAttached) - Number(first.alreadyAttached) || first.name.localeCompare(second.name));
  const islandStyle = anchor
    ? ({
        "--card-collection-left": `${anchor.left}px`,
        "--card-collection-top": `${anchor.top}px`,
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (islandRef.current?.contains(target) || (target instanceof Element && target.closest(".item-card__action-cell--add"))) {
        return;
      }

      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const onSurfaceOpen = (event: Event) => {
      const detail = (event as CustomEvent<ItemCardSurfaceDetail>).detail;
      if (!detail || detail.itemId === item.id && detail.surface === "collection") {
        return;
      }

      onClose();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(itemCardSurfaceEvent, onSurfaceOpen);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(itemCardSurfaceEvent, onSurfaceOpen);
    };
  }, [item.id, onClose]);

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
    <section
      className="card-collection-island"
      role="dialog"
      aria-label="add item to collection"
      ref={islandRef}
      style={islandStyle}
    >
      <div className="card-collection-island__header">
        <span>
          <small>collect</small>
          <strong>{itemLabel}</strong>
        </span>
        <button className="card-collection-island__cell" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <input
        className="card-collection-island__search"
        aria-label="search collections"
        disabled={pending}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search collections"
        type="search"
        value={query}
      />

      <div className="card-collection-island__options" aria-label="existing collections">
        {loading ? <span className="card-collection-island__status">Loading collections.</span> : null}
        {!loading && options.length === 0 ? (
          <span className="card-collection-island__status">No collections yet.</span>
        ) : null}
        {!loading && options.length > 0 && enrichedOptions.length === 0 ? (
          <span className="card-collection-island__status">No collections match that search.</span>
        ) : null}
        {enrichedOptions.map((collection) => (
          <button
            className="card-collection-island__cell"
            data-attached={collection.alreadyAttached ? "true" : "false"}
            disabled={pending}
            key={collection.id}
            type="button"
            onClick={() => onToggle(collection.id, collection.alreadyAttached)}
          >
            <span className="card-collection-island__preview" aria-hidden="true">
              {collection.index?.previewItems.slice(0, 3).map((preview) => {
                const imageUrl = preview.thumbnailUrl || preview.imageUrl || preview.ogImageUrl || preview.videoPosterUrl;
                return imageUrl ? <img src={imageUrl} alt="" key={preview.id} /> : <span key={preview.id}>{preview.kind.slice(0, 1).toUpperCase()}</span>;
              })}
            </span>
            <span className="card-collection-island__copy">
              <strong>{collection.name}</strong>
              <small>
                {collection.alreadyAttached ? "Attached" : "Add"} · {collection.index ? `${collection.index.pieceCount} items · ${collection.index.kindSummary}` : "collection"}
              </small>
            </span>
          </button>
        ))}
      </div>

      <form className="card-collection-island__form" onSubmit={submitCreate}>
        <input
          aria-label="new collection name"
          disabled={pending}
          maxLength={maxCollectionTitleLength}
          onChange={(event) => setName(event.target.value.slice(0, maxCollectionTitleLength))}
          placeholder="New collection"
          value={name}
        />
        <textarea
          aria-label="new collection description"
          disabled={pending}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description optional"
          rows={2}
          value={description}
        />
        <button className="card-collection-island__cell" disabled={!canCreate} type="submit">
          {pending ? "Adding" : "Create and add"}
        </button>
      </form>
      {error ? <span className="card-collection-island__error">{error}</span> : null}
    </section>
  );
}

function SelectionActionBar({
  collections,
  error,
  onAddToCollection,
  onArchive,
  onClear,
  onCreate,
  pending,
  selectedCount,
}: {
  collections: CollectionIndexItem[];
  error: string | null;
  onAddToCollection: (collectionId: string) => void;
  onArchive: () => void;
  onClear: () => void;
  onCreate: (input: { name: string; description: string | null }) => void;
  pending: boolean;
  selectedCount: number;
}) {
  const [activeAction, setActiveAction] = useState<"add" | "create" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canCreate = name.trim().length > 0 && !pending;
  const selectedLabel = `${selectedCount} selected`;

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
    <section className="selection-action-bar" aria-label="selected item actions">
      <div className="selection-action-bar__summary">
        <strong>{selectedLabel}</strong>
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
        <button className="selection-action-bar__cell" type="button" disabled={pending} onClick={onArchive}>
          Archive
        </button>
        <button className="selection-action-bar__cell" type="button" disabled={pending} onClick={onClear}>
          Clear
        </button>
      </div>

      {activeAction === "add" ? (
        <div className="selection-action-bar__panel" aria-label="add selected to collection">
          {collections.length === 0 ? <span className="selection-action-bar__empty">No collections yet.</span> : null}
          {collections.map((collection) => (
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
            aria-label="new collection name for selected items"
            disabled={pending}
            maxLength={maxCollectionTitleLength}
            onChange={(event) => setName(event.target.value.slice(0, maxCollectionTitleLength))}
            placeholder="New collection"
            value={name}
          />
          <input
            aria-label="new collection description for selected items"
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

function getCardCollectionIslandPosition(anchor: ItemCardActionAnchor): CardCollectionIslandPosition {
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
  const margin = 12;
  const gap = 8;
  const width = Math.min(420, Math.max(280, viewportWidth - margin * 2));
  const estimatedHeight = Math.min(360, viewportHeight - margin * 2);
  const idealLeft = anchor.right - width;
  const left = clampNumber(idealLeft, margin, viewportWidth - width - margin);
  const fitsBelow = anchor.bottom + gap + estimatedHeight <= viewportHeight - margin;
  const top = fitsBelow
    ? anchor.bottom + gap
    : clampNumber(anchor.top - estimatedHeight - gap, margin, viewportHeight - estimatedHeight - margin);

  return { left, top };
}

function clampNumber(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function PdfPreview({
  name,
  src,
  surface,
}: {
  name: string | null;
  src: string;
  surface: "card" | "reader";
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = name || "PDF preview";

  useEffect(() => {
    if (!src) {
      setObjectUrl(null);
      setError("PDF unavailable.");
      return;
    }

    const controller = new AbortController();
    let nextObjectUrl: string | null = null;

    setObjectUrl(null);
    setError(null);

    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`PDF preview failed with HTTP ${response.status}`);
        }

        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) {
          return;
        }

        const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
        nextObjectUrl = URL.createObjectURL(pdfBlob);
        setObjectUrl(nextObjectUrl);
      })
      .catch((fetchError: unknown) => {
        if (!controller.signal.aborted) {
          console.error(fetchError);
          setError("PDF preview unavailable.");
        }
      });

    return () => {
      controller.abort();

      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [src]);

  return (
    <main className="pdf-preview-shell" data-surface={surface} aria-label={label}>
      <div className="pdf-preview-shell__page">
        {objectUrl ? (
          <>
            <iframe
              className="pdf-preview-shell__frame"
              src={`${objectUrl}#page=1&view=FitH`}
              title={label}
            />
          </>
        ) : (
          <div className="pdf-preview-shell__fallback" role={error ? "alert" : "status"}>
            <span>PDF</span>
            <small>{error ?? label}</small>
          </div>
        )}
      </div>
    </main>
  );
}

function getRouteFromLocation(): AppRoute {
  if (window.location.pathname === "/pdf-preview") {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      kind: "pdfPreview",
      src: searchParams.get("src") ?? "",
      name: searchParams.get("name") ?? undefined,
      surface: searchParams.get("surface") === "card" ? "card" : "reader",
    };
  }

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
    const returnTo = new URLSearchParams(window.location.search).get("return_to")?.trim();
    return {
      kind: "collection",
      collectionId: decodeURIComponent(collectionMatch[1]),
      returnTo: returnTo && isSafeInternalReturnPath(returnTo) ? returnTo : undefined,
    };
  }

  return { kind: "grid" };
}

function getFiltersFromLocation(): ItemCardFilters {
  const searchParams = new URLSearchParams(window.location.search);
  const filters: ItemCardFilters = {};
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const format = searchParams.get("format");
  const collection = searchParams.get("collection")?.trim();
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

  if (isFormatFilter(format)) {
    filters.format = format;
  }

  if (collection) {
    filters.collection = collection === "all" ? undefined : collection;
  }

  if (text) {
    filters.text = text;
  }

  return filters;
}

function getGalleryObjectModeFromLocation(): GalleryObjectMode {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "items" || mode === "collections" ? mode : "all";
}

function getArchiveViewModeFromLocation(): ArchiveViewMode {
  const view = new URLSearchParams(window.location.search).get("view");
  return view === "masonry" || view === "list" || view === "graph" ? view : "gallery";
}

function buildArchiveUrl(
  filters: ItemCardFilters,
  mode: GalleryObjectMode = "all",
  view: ArchiveViewMode = "gallery",
) {
  return `/${buildFilterSearch(filters, { mode, view })}`;
}

function buildCollectionUrl(collectionId: string, options: { returnTo?: string } = {}) {
  const searchParams = new URLSearchParams();

  if (options.returnTo && isSafeInternalReturnPath(options.returnTo)) {
    searchParams.set("return_to", options.returnTo);
  }

  const search = searchParams.toString();
  return `/collections/${encodeURIComponent(collectionId)}${search ? `?${search}` : ""}`;
}

function isSafeInternalReturnPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !/^\/pdf-preview(?:\/|\?|$)/.test(value);
}

function buildPdfPreviewRouteUrl(src: string, name?: string, surface: "card" | "reader" = "reader") {
  const searchParams = new URLSearchParams();
  searchParams.set("src", src);

  if (name) {
    searchParams.set("name", name);
  }

  if (surface === "card") {
    searchParams.set("surface", "card");
  }

  return `/pdf-preview?${searchParams.toString()}`;
}

function buildItemDetailUrl(
  itemId: string,
  filters: ItemCardFilters,
  options: { mode?: GalleryObjectMode; returnCollectionId?: string; view?: ArchiveViewMode } = {},
) {
  return `/items/${encodeURIComponent(itemId)}${buildFilterSearch(filters, options)}`;
}

function buildFilterSearch(
  filters: ItemCardFilters,
  options: { mode?: GalleryObjectMode; returnCollectionId?: string; view?: ArchiveViewMode } = {},
) {
  const searchParams = new URLSearchParams();

  if (options.mode && options.mode !== "all") {
    searchParams.set("mode", options.mode);
  }

  if (options.view && options.view !== "gallery") {
    searchParams.set("view", options.view);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  if (filters.type) {
    searchParams.set("type", filters.type);
  }

  if (filters.source) {
    searchParams.set("source", filters.source);
  }

  if (filters.format) {
    searchParams.set("format", filters.format);
  }

  if (filters.collection) {
    searchParams.set("collection", filters.collection);
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
  return Boolean(filters.status || filters.type || filters.source || filters.format || filters.collection || filters.text?.trim());
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

function formatGalleryObjectModeLabel(mode: GalleryObjectMode) {
  if (mode === "items") {
    return "items";
  }

  if (mode === "collections") {
    return "collections";
  }

  return "archive objects";
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
    parts.push({ label: "source", value: filters.source.replace("_", " ") });
  }

  if (filters.format) {
    parts.push({ label: "more", value: filters.format });
  }

  if (filters.collection) {
    parts.push({ label: "collection", value: filters.collection === "none" ? "Uncollected" : filters.collection });
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

function isFormatFilter(value: string | null): value is ItemFormatFilter {
  return value !== null && value !== "all" && formatFilterOptions.includes(value as ArchiveFormatFilter);
}

function captureSourceExternalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `manual:note:${crypto.randomUUID()}`;
  }

  return `manual:note:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCaptureUrl(rawInput: string) {
  const value = rawInput.trim();
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Capture URL must use http or https.");
  }

  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function getReadableLoadError(error: unknown, surface: "archive" | "collection" | "collections") {
  if (isApiUnreachableError(error)) {
    return `${pocketBaseUnavailableTitle}\n${pocketBaseUnavailableCopy}`;
  }

  if (surface === "collections") {
    return "Collections could not be loaded.\nRefresh the archive or check the PocketBase logs.";
  }

  if (surface === "collection") {
    if (isCollectionNotFoundError(error)) {
      return "This collection could not be found.\nIt may have been removed or belongs to another archive mode.";
    }

    return "Collection could not be loaded.\nRefresh the page or check the PocketBase logs.";
  }

  return "Archive could not be loaded.\nRefresh the page or check the PocketBase logs.";
}

function getReadableDetailError(error: unknown) {
  if (isApiUnreachableError(error)) {
    return `${pocketBaseUnavailableTitle}\n${pocketBaseUnavailableCopy}`;
  }

  if (isItemNotFoundError(error)) {
    return "This item could not be found.";
  }

  return "Item could not be loaded.\nRefresh the page or check the PocketBase logs.";
}

function getLoadErrorDisplay(message: string) {
  const [title, ...copyParts] = message.split("\n");

  return {
    title: title || "Archive could not be loaded.",
    copy: copyParts.join(" ") || "Refresh the page or check the PocketBase logs.",
  };
}

function isApiUnreachableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("econnrefused")
  );
}

function isCollectionNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("collection not found") ||
    (normalizedMessage.includes("http 404") && normalizedMessage.includes("collection"))
  );
}

function isItemNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("item not found") ||
    normalizedMessage.includes("seed fixture item") ||
    normalizedMessage.includes("http 404")
  );
}

function getInitialShortcutBindings(): ShortcutBindings {
  const savedBindings = window.localStorage.getItem(shortcutStorageKey);

  if (!savedBindings) {
    return defaultShortcutBindings;
  }

  try {
    const parsed = JSON.parse(savedBindings) as Partial<ShortcutBindings>;

    return {
      search: sanitizeShortcutBinding(parsed.search) ?? defaultShortcutBindings.search,
      theme: sanitizeShortcutBinding(parsed.theme) ?? defaultShortcutBindings.theme,
      galleryIncrease: sanitizeShortcutBinding(parsed.galleryIncrease) ?? defaultShortcutBindings.galleryIncrease,
      galleryDecrease: sanitizeShortcutBinding(parsed.galleryDecrease) ?? defaultShortcutBindings.galleryDecrease,
    };
  } catch {
    return defaultShortcutBindings;
  }
}

function sanitizeShortcutBinding(binding: unknown): ShortcutBinding | null {
  if (!binding || typeof binding !== "object") {
    return null;
  }

  const candidate = binding as Partial<ShortcutBinding>;
  if (typeof candidate.key !== "string" || candidate.key.trim() === "") {
    return null;
  }

  return {
    key: normalizeShortcutKey(candidate.key),
    ...(candidate.modifier === "mod" ? { modifier: "mod" as const } : {}),
    ...(Array.isArray(candidate.alternateKeys)
      ? {
          alternateKeys: candidate.alternateKeys
            .filter((key): key is string => typeof key === "string" && key.trim() !== "")
            .map(normalizeShortcutKey),
        }
      : {}),
  };
}

function matchesShortcut(event: KeyboardEvent, binding: ShortcutBinding) {
  const eventKey = normalizeShortcutKey(event.key);
  const expectedKeys = [binding.key, ...(binding.alternateKeys ?? [])].map(normalizeShortcutKey);

  if (!expectedKeys.includes(eventKey)) {
    return false;
  }

  if (binding.modifier === "mod") {
    return (event.metaKey || event.ctrlKey) && !event.altKey;
  }

  return !event.metaKey && !event.ctrlKey && !event.altKey;
}

function getShortcutConflict(
  action: ShortcutAction,
  binding: ShortcutBinding,
  bindings: ShortcutBindings,
): ShortcutAction | null {
  const actions = Object.keys(bindings) as ShortcutAction[];

  return actions.find((candidateAction) => {
    if (candidateAction === action) {
      return false;
    }

    return shortcutBindingsOverlap(binding, bindings[candidateAction]);
  }) ?? null;
}

function shortcutBindingsOverlap(first: ShortcutBinding, second: ShortcutBinding) {
  if ((first.modifier ?? null) !== (second.modifier ?? null)) {
    return false;
  }

  const firstKeys = [first.key, ...(first.alternateKeys ?? [])].map(normalizeShortcutKey);
  const secondKeys = [second.key, ...(second.alternateKeys ?? [])].map(normalizeShortcutKey);

  return firstKeys.some((key) => secondKeys.includes(key));
}

function normalizeShortcutKey(key: string) {
  if (key === " ") {
    return "space";
  }

  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

function formatShortcutBinding(binding: ShortcutBinding) {
  const keys = [binding.key, ...(binding.alternateKeys ?? [])].map(formatShortcutKey).join(" / ");
  return binding.modifier === "mod" ? `⌘${keys}` : keys;
}

function formatShortcutKey(key: string) {
  if (key === "space") {
    return "Space";
  }

  return key.length === 1 ? key.toUpperCase() : key;
}

function formatShortcutAction(action: ShortcutAction) {
  switch (action) {
    case "search":
      return "Search archive";
    case "theme":
      return "Toggle theme";
    case "galleryIncrease":
      return "More columns";
    case "galleryDecrease":
      return "Fewer columns";
  }
}

function getInitialSiteTheme(): SiteTheme {
  const savedTheme = window.localStorage.getItem("vita:theme");

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return "light";
}
