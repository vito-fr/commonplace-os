import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { gsap, ScrollTrigger } from "./motion/MotionShell";
import type { ItemStatus, ItemType } from "./components/atoms";
import { CollectionView } from "./components/collections/CollectionView";
import { MasonryGrid } from "./components/items";
import type { ItemCardActionAnchor, ItemCardProps } from "./components/items";
import { ItemDetailView, type DetailArchiveFlow } from "./components/items/ItemDetail";
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
import { createPocketBaseItemDetailReader } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemCardReader } from "./data/pocketBaseItemCards";
import { createPocketBaseItemRelationshipWriter } from "./data/pocketBaseItemRelationship";
import { createPocketBaseItemStatusWriter } from "./data/pocketBaseItemStatus";
import { seedFixtureItemCardReader } from "./data/seedItemCards";
import { seedFixtureItemDetailReader } from "./data/seedItemDetail";
import { SpotlightDock, type SpotlightCaptureRequest } from "./components/spotlight/SpotlightDock";
import {
  PillNav,
  type PillNavPanel,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutBindings,
} from "./components/nav/PillNav";

type AppRoute =
  | { kind: "grid" }
  | { kind: "item"; itemId: string; returnCollectionId?: string }
  | { kind: "collection"; collectionId: string }
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
const shortcutStorageKey = "vita:shortcut-bindings:v1";
const defaultShortcutBindings: ShortcutBindings = {
  search: { key: "k", modifier: "mod" },
  theme: { key: "m" },
  galleryIncrease: { key: "+", alternateKeys: ["="] },
  galleryDecrease: { key: "-" },
};

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

type CardCollectionIslandPosition = {
  left: number;
  top: number;
};

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [items, setItems] = useState<ItemCardProps[]>([]);
  const [itemCardFilters, setItemCardFilters] = useState<ItemCardFilters>(() => getFiltersFromLocation());
  const [archivePanel, setArchivePanel] = useState<PillNavPanel | null>(null);
  const [galleryColumns, setGalleryColumns] = useState(4);
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
  const [cardCollectionItem, setCardCollectionItem] = useState<ItemCardProps | null>(null);
  const [cardCollectionAnchor, setCardCollectionAnchor] = useState<CardCollectionIslandPosition | null>(null);
  const [cardCollectionOptions, setCardCollectionOptions] = useState<CollectionOption[]>([]);
  const [isCardCollectionLoading, setIsCardCollectionLoading] = useState(false);
  const [isCardCollectionWriting, setIsCardCollectionWriting] = useState(false);
  const [cardCollectionError, setCardCollectionError] = useState<string | null>(null);
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

      if (route.kind === "grid" && matchesShortcut(event, shortcutBindings.galleryIncrease)) {
        event.preventDefault();
        setGalleryColumns((currentColumns) => Math.min(maxGalleryColumns, currentColumns + 1));
        return;
      }

      if (route.kind === "grid" && matchesShortcut(event, shortcutBindings.galleryDecrease)) {
        event.preventDefault();
        setGalleryColumns((currentColumns) => Math.max(minGalleryColumns, currentColumns - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [route.kind, shortcutBindings]);

  useEffect(() => {
    const nextUrl =
      route.kind === "pdfPreview"
        ? buildPdfPreviewRouteUrl(route.src, route.name, route.surface)
        : route.kind === "item"
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
    if (route.kind !== "grid") {
      setCardCollectionItem(null);
      setCardCollectionAnchor(null);
      setCardCollectionOptions([]);
      setCardCollectionError(null);
      setIsCardCollectionLoading(false);
      setIsCardCollectionWriting(false);
    }
  }, [route.kind]);

  useEffect(() => {
    let isCurrent = true;

    if (route.kind !== "grid" || archivePanel !== "index") {
      setCollectionIndexError(null);
      setIsCollectionIndexLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    if (!isPocketBaseMode) {
      setCollectionIndex([]);
      setCollectionIndexError("Collection index requires live archive mode.");
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
          setCollectionIndexError("Unable to load collections.");
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
  }, [archivePanel, route.kind]);

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
    setArchivePanel(null);
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

  const attachArchiveCardToCollection = async (collectionId: string) => {
    if (!cardCollectionItem || !isPocketBaseMode) {
      return;
    }

    setIsCardCollectionWriting(true);
    setCardCollectionError(null);
    try {
      await itemCollectionClient.attachCollection({
        workspaceId,
        itemId: cardCollectionItem.id,
        collectionId,
        actor: "system",
      });

      const nextItems = await itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters });
      setItems(nextItems);
      closeArchiveCardCollection();
    } catch (error: unknown) {
      console.error(error);
      setCardCollectionError("Unable to add to collection.");
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

      const nextItems = await itemCardReader.listItemCards({ workspaceId, filters: itemCardFilters });
      setItems(nextItems);
      closeArchiveCardCollection();
    } catch (error: unknown) {
      console.error(error);
      setCardCollectionError("Unable to create collection.");
    } finally {
      setIsCardCollectionWriting(false);
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
        collectionIndex={collectionIndex}
        collectionIndexError={collectionIndexError}
        collectionIndexLoading={isCollectionIndexLoading}
        filters={itemCardFilters}
        galleryColumns={galleryColumns}
        isPocketBaseMode={isPocketBaseMode}
        itemCount={items.length}
        loading={isLoading}
        onClearFilters={clearArchiveFilters}
        onOpenCollection={openCollection}
        onGalleryColumnsChange={updateGalleryColumns}
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
        typeOptions={typeFilterOptions}
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
          onRemoveCollection={removeItemFromCollection}
          collectionActionPending={isCollectionAttaching}
          collectionActionError={collectionWriteError}
          collectionOptions={collectionTargetOptions}
        />
      </main>
    );
  } else {
    const showInitialArchiveLoading = isLoading && items.length === 0;
    const renderedItems = items.map((item) => ({
      ...item,
      activeFilters: itemCardFilters,
      ...(isPocketBaseMode
        ? {
            detailHref: buildItemDetailUrl(item.id, itemCardFilters),
            onAddToCollection: openArchiveCardCollection,
            onNavigate: openItemDetail,
          }
        : {
            onAddToCollection: openArchiveCardCollection,
            onNavigate: openItemDetail,
          }),
    }));

    routeContent = (
      <main className="app-shell app-shell--archive" aria-label="Vita archive">
        <h1 className="visually-hidden">Archive</h1>
        <section className="archive-canvas" aria-label="archive items">
          <MasonryGrid
            items={renderedItems}
            density="comfortable"
            columns={galleryColumns}
            loading={showInitialArchiveLoading}
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
      {renderedRoute.kind === "grid" && cardCollectionItem ? (
        <CardCollectionIsland
          anchor={cardCollectionAnchor}
          item={cardCollectionItem}
          options={cardCollectionOptions}
          loading={isCardCollectionLoading}
          pending={isCardCollectionWriting}
          error={cardCollectionError}
          onAttach={attachArchiveCardToCollection}
          onClose={closeArchiveCardCollection}
          onCreate={createArchiveCardCollection}
        />
      ) : null}
      {renderedRoute.kind !== "pdfPreview" ? (
        <SpotlightDock
          value={itemCardFilters.text ?? ""}
          onChange={updateTextFilter}
          isPocketBaseMode={isPocketBaseMode}
          pendingCapture={isCapturing}
          captureError={captureError}
          captureNotice={captureNotice}
          searchShortcut={shortcutBindings.search}
          onCapture={captureArchiveInput}
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

function CardCollectionIsland({
  anchor,
  error,
  item,
  loading,
  onAttach,
  onClose,
  onCreate,
  options,
  pending,
}: {
  anchor: CardCollectionIslandPosition | null;
  error: string | null;
  item: ItemCardProps;
  loading: boolean;
  onAttach: (collectionId: string) => void;
  onClose: () => void;
  onCreate: (input: { name: string; description: string | null }) => void;
  options: CollectionOption[];
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const itemLabel = item.title ?? item.ogTitle ?? item.url ?? item.type;
  const canCreate = name.trim().length > 0 && !pending;
  const islandStyle = anchor
    ? ({
        "--card-collection-left": `${anchor.left}px`,
        "--card-collection-top": `${anchor.top}px`,
      } as CSSProperties)
    : undefined;

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
    <section
      className="card-collection-island"
      role="dialog"
      aria-label="add item to collection"
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

      <div className="card-collection-island__options" aria-label="existing collections">
        {loading ? <span className="card-collection-island__status">Loading collections.</span> : null}
        {!loading && options.length === 0 ? (
          <span className="card-collection-island__status">No collections yet.</span>
        ) : null}
        {options.map((collection) => (
          <button
            className="card-collection-island__cell"
            data-attached={collection.alreadyAttached ? "true" : "false"}
            disabled={pending || collection.alreadyAttached}
            key={collection.id}
            type="button"
            onClick={() => onAttach(collection.id)}
          >
            {collection.name}
            {collection.alreadyAttached ? " · added" : ""}
          </button>
        ))}
      </div>

      <form className="card-collection-island__form" onSubmit={submitCreate}>
        <input
          aria-label="new collection name"
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
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
              src={`${objectUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title={label}
              scrolling="no"
            />
            <span className="pdf-preview-shell__badge" aria-hidden="true">
              <strong>PDF</strong>
              <small>{label}</small>
            </span>
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
  const format = searchParams.get("format");
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

  if (filters.format) {
    searchParams.set("format", filters.format);
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
  return Boolean(filters.status || filters.type || filters.source || filters.format || filters.text?.trim());
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

  if (filters.format) {
    parts.push({ label: "format", value: filters.format });
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
