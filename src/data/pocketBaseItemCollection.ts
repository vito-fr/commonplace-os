import type { ItemType } from "../components/atoms";
import type { ItemMediaPreview } from "../components/items";
import { normalizeRemoteMediaUrl, resolvePocketBaseFileUrl } from "./pocketBaseFiles";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CollectionOption = {
  id: string;
  name: string;
  description: string | null;
  alreadyAttached: boolean;
};

export type CollectionDetailQuery = {
  workspaceId: string;
  collectionId: string;
};

export type CollectionDetailItem = {
  id: string;
  type: ItemType;
  status: string;
  title: string | null;
  description: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  addedAt: string;
  source: {
    kind: string;
    label: string;
  };
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  aspectRatio?: number | null;
  captionText: string | null;
  noteParagraph: string | null;
  url: string | null;
  linkContentType: string | null;
  videoDurationMs?: number | null;
  ogImageUrl: string | null;
  ogTitle: string | null;
  assetFileUrl: string | null;
  assetMimeType: string | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  videoPosterUrl?: string | null;
  mediaPreview?: ItemMediaPreview | null;
};

export type CollectionPreviewItem = {
  id: string;
  title?: string | null;
  kind: string;
  format?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  imageUrl?: string | null;
  ogImageUrl?: string | null;
  videoPosterUrl?: string | null;
  assetFileUrl?: string | null;
  assetMimeType?: string | null;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
  textPreview?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
};

export type CollectionIndexItem = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdAt: string;
  lastUpdatedAt: string;
  pieceCount: number;
  kindSummary: string;
  previewItems: CollectionPreviewItem[];
};

export type CollectionDetailSubCollection = CollectionIndexItem & {
  relationship: {
    parentCollectionId: string;
    position: number;
    addedAt: string;
    addedBy: string;
  };
};

export type CollectionDetail = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdAt: string;
  lastUpdatedAt: string;
  pieceCount: number;
  kindSummary: string;
  items: CollectionDetailItem[];
  subCollections: CollectionDetailSubCollection[];
};

export type CollectionIndexQuery = {
  workspaceId: string;
};

export type CollectionOptionsQuery = {
  workspaceId: string;
  itemId?: string;
};

export type ItemCollectionAttach = {
  workspaceId: string;
  itemId: string;
  collectionId: string;
  actor?: string;
};

export type ItemCollectionCreateAndAttach = {
  workspaceId: string;
  itemId: string;
  name: string;
  description?: string;
  actor?: string;
};

export type CollectionCreate = {
  workspaceId: string;
  name: string;
  description?: string;
  actor?: string;
};

export type ItemCollectionRemove = {
  workspaceId: string;
  itemId: string;
  collectionId: string;
  actor?: string;
};

export type CollectionUpdate = {
  workspaceId: string;
  collectionId: string;
  name: string;
  description: string | null;
  actor?: string;
};

export type ItemCollectionAttachResult = {
  membership: {
    collectionId: string;
    itemId: string;
    addedAt: string;
    addedBy: string;
    collection: {
      id: string;
      name: string;
      description: string | null;
    };
  };
  event: {
    id: string;
    eventType: "collection_added";
    createdAt: string;
  };
};

export type ItemCollectionCreateAndAttachResult = ItemCollectionAttachResult & {
  collection: {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    createdAt: string;
  };
};

export type CollectionCreateResult = {
  collection: CollectionIndexItem;
};

export type ItemCollectionRemoveResult = {
  membership: {
    collectionId: string;
    itemId: string;
    addedAt: string;
    addedBy: string;
    removedAt: string;
    removedBy: string;
    collection: {
      id: string;
      name: string;
      description: string | null;
    };
  };
  event: {
    id: string;
    eventType: "collection_removed";
    createdAt: string;
  };
};

export type CollectionUpdateResult = {
  collection: CollectionIndexItem;
};

export type ItemCollectionClient = {
  getCollectionDetail(query: CollectionDetailQuery): Promise<CollectionDetail>;
  listCollectionIndex(query: CollectionIndexQuery): Promise<CollectionIndexItem[]>;
  listCollectionOptions(query: CollectionOptionsQuery): Promise<CollectionOption[]>;
  attachCollection(change: ItemCollectionAttach): Promise<ItemCollectionAttachResult>;
  createCollection(change: CollectionCreate): Promise<CollectionCreateResult>;
  createCollectionAndAttach(change: ItemCollectionCreateAndAttach): Promise<ItemCollectionCreateAndAttachResult>;
  removeCollection(change: ItemCollectionRemove): Promise<ItemCollectionRemoveResult>;
  updateCollection(change: CollectionUpdate): Promise<CollectionUpdateResult>;
};

export type PocketBaseItemCollectionClientOptions = {
  baseUrl: string;
  detailEndpointPath?: string;
  indexEndpointPath?: string;
  optionsEndpointPath?: string;
  attachEndpointPath?: string;
  createEndpointPath?: string;
  removeEndpointPath?: string;
  updateEndpointPath?: string;
  fetcher?: Fetcher;
};

type CollectionDetailResponse = {
  collection: CollectionDetail;
};

type CollectionOptionsResponse = {
  collections: CollectionOption[];
};

type CollectionIndexResponse = {
  collections: CollectionIndexItem[];
};

export function createPocketBaseItemCollectionClient({
  baseUrl,
  detailEndpointPath = "/api/vita/collection-detail",
  indexEndpointPath = "/api/vita/collection-index",
  optionsEndpointPath = "/api/vita/collection-options",
  attachEndpointPath = "/api/vita/item-collection",
  createEndpointPath = "/api/vita/collection-create",
  removeEndpointPath = "/api/vita/item-collection-remove",
  updateEndpointPath = "/api/vita/collection-update",
  fetcher = globalThis.fetch,
}: PocketBaseItemCollectionClientOptions): ItemCollectionClient {
  return {
    async getCollectionDetail(query) {
      const response = await fetcher(buildCollectionDetailUrl(baseUrl, detailEndpointPath, query), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const message = await readPocketBaseErrorMessage(response);
        throw new Error(formatPocketBaseHttpError("PocketBase collection detail read failed", response.status, message));
      }

      const payload = (await response.json()) as CollectionDetailResponse;
      if (!payload.collection) {
        throw new Error("PocketBase collection detail response must include { collection }");
      }

      return {
        ...payload.collection,
        items: payload.collection.items.map((item) => resolveCollectionDetailItem(baseUrl, item)),
        subCollections: (payload.collection.subCollections ?? []).map((collection) => resolveCollectionPreviewUrls(baseUrl, collection)),
      };
    },

    async listCollectionIndex(query) {
      const response = await fetcher(buildCollectionIndexUrl(baseUrl, indexEndpointPath, query), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`PocketBase collection index read failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as CollectionIndexResponse;
      if (!Array.isArray(payload.collections)) {
        throw new Error("PocketBase collection index response must include { collections }");
      }

      return payload.collections.map((collection) => resolveCollectionPreviewUrls(baseUrl, collection));
    },

    async listCollectionOptions(query) {
      const response = await fetcher(buildCollectionOptionsUrl(baseUrl, optionsEndpointPath, query), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`PocketBase collection options read failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as CollectionOptionsResponse;
      if (!Array.isArray(payload.collections)) {
        throw new Error("PocketBase collection options response must include { collections }");
      }

      return payload.collections;
    },

    async attachCollection(change) {
      const response = await fetcher(buildCollectionAttachUrl(baseUrl, attachEndpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          item_id: change.itemId,
          collection_id: change.collectionId,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase collection attach failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemCollectionAttachResult;
      if (!payload.membership || !payload.event) {
        throw new Error("PocketBase collection attach response must include { membership, event }");
      }

      return payload;
    },

    async createCollectionAndAttach(change) {
      const response = await fetcher(buildCollectionCreateUrl(baseUrl, createEndpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          item_id: change.itemId,
          name: change.name,
          description: change.description,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase collection create failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemCollectionCreateAndAttachResult;
      if (!payload.collection || !payload.membership || !payload.event) {
        throw new Error("PocketBase collection create response must include { collection, membership, event }");
      }

      return payload;
    },

    async createCollection(change) {
      const response = await fetcher(buildCollectionCreateUrl(baseUrl, createEndpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          name: change.name,
          description: change.description,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase collection create failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as CollectionCreateResult;
      if (!payload.collection) {
        throw new Error("PocketBase collection create response must include { collection }");
      }

      return payload;
    },

    async removeCollection(change) {
      const response = await fetcher(buildCollectionRemoveUrl(baseUrl, removeEndpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          item_id: change.itemId,
          collection_id: change.collectionId,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase collection remove failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemCollectionRemoveResult;
      if (!payload.membership || !payload.event) {
        throw new Error("PocketBase collection remove response must include { membership, event }");
      }

      return payload;
    },

    async updateCollection(change) {
      const response = await fetcher(buildCollectionUpdateUrl(baseUrl, updateEndpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          collection_id: change.collectionId,
          name: change.name,
          description: change.description,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase collection update failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as CollectionUpdateResult;
      if (!payload.collection) {
        throw new Error("PocketBase collection update response must include { collection }");
      }

      return payload;
    },
  };
}

function buildCollectionDetailUrl(
  baseUrl: string,
  endpointPath: string,
  query: CollectionDetailQuery,
) {
  const url = new URL(endpointPath, normalizeBaseUrl(baseUrl));
  url.searchParams.set("workspace_id", query.workspaceId);
  url.searchParams.set("collection_id", query.collectionId);
  return url;
}

function buildCollectionIndexUrl(
  baseUrl: string,
  endpointPath: string,
  query: CollectionIndexQuery,
) {
  const url = new URL(endpointPath, normalizeBaseUrl(baseUrl));
  url.searchParams.set("workspace_id", query.workspaceId);
  return url;
}

function buildCollectionOptionsUrl(
  baseUrl: string,
  endpointPath: string,
  query: CollectionOptionsQuery,
) {
  const url = new URL(endpointPath, normalizeBaseUrl(baseUrl));
  url.searchParams.set("workspace_id", query.workspaceId);
  if (query.itemId) {
    url.searchParams.set("item_id", query.itemId);
  }
  return url;
}

function buildCollectionAttachUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function buildCollectionCreateUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function buildCollectionRemoveUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function buildCollectionUpdateUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

async function readPocketBaseErrorMessage(response: Response) {
  try {
    const payload = (await response.clone().json()) as { message?: unknown };
    return typeof payload.message === "string" ? payload.message.trim() : "";
  } catch {
    try {
      return (await response.text()).trim();
    } catch {
      return "";
    }
  }
}

function formatPocketBaseHttpError(prefix: string, status: number, message: string) {
  return message ? `${prefix} with HTTP ${status}: ${message}` : `${prefix} with HTTP ${status}`;
}

function resolveCollectionDetailItem(baseUrl: string, item: CollectionDetailItem): CollectionDetailItem {
  const imageUrl = resolvePocketBaseFileUrl(baseUrl, item.imageUrl);
  const assetFileUrl = resolvePocketBaseFileUrl(baseUrl, item.assetFileUrl);
  const ogImageUrl = normalizeRemoteMediaUrl(item.ogImageUrl);
  const mediaPreviewOgImageUrl = normalizeRemoteMediaUrl(item.mediaPreview?.ogImageUrl) ?? ogImageUrl;
  const thumbnailUrl = resolvePocketBaseFileUrl(baseUrl, item.thumbnailUrl) ?? imageUrl ?? ogImageUrl ?? null;
  const videoPosterUrl = resolvePocketBaseFileUrl(baseUrl, item.videoPosterUrl) ?? ogImageUrl ?? null;
  const previewUrl =
    resolvePocketBaseFileUrl(baseUrl, item.previewUrl) ??
    imageUrl ??
    thumbnailUrl ??
    videoPosterUrl ??
    ogImageUrl ??
    assetFileUrl ??
    null;

  return {
    ...item,
    assetFileUrl,
    imageUrl,
    ogImageUrl,
    previewUrl,
    thumbnailUrl,
    videoPosterUrl,
    mediaPreview: {
      ...item.mediaPreview,
      assetFileUrl,
      assetMimeType: item.mediaPreview?.assetMimeType ?? item.assetMimeType,
      imageUrl,
      ogImageUrl: mediaPreviewOgImageUrl,
      previewUrl,
      thumbnailUrl,
      videoPosterUrl,
    },
  };
}

function resolveCollectionPreviewUrls<T extends { previewItems: CollectionPreviewItem[] }>(baseUrl: string, collection: T): T {
  return {
    ...collection,
    previewItems: (collection.previewItems ?? []).map((item) => {
      const imageUrl = resolvePocketBaseFileUrl(baseUrl, item.imageUrl);
      const assetFileUrl = resolvePocketBaseFileUrl(baseUrl, item.assetFileUrl);
      const ogImageUrl = normalizeRemoteMediaUrl(item.ogImageUrl);
      const thumbnailUrl = resolvePocketBaseFileUrl(baseUrl, item.thumbnailUrl) ?? imageUrl ?? ogImageUrl ?? null;
      const videoPosterUrl = resolvePocketBaseFileUrl(baseUrl, item.videoPosterUrl) ?? ogImageUrl ?? null;
      const previewUrl =
        resolvePocketBaseFileUrl(baseUrl, item.previewUrl) ??
        thumbnailUrl ??
        imageUrl ??
        videoPosterUrl ??
        ogImageUrl ??
        assetFileUrl ??
        null;

      return {
        ...item,
        imageUrl,
        ogImageUrl,
        assetFileUrl,
        previewUrl,
        thumbnailUrl,
        videoPosterUrl,
      };
    }),
  };
}
