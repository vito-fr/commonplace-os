import { resolvePocketBaseFileUrl } from "./pocketBaseFiles";

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
  type: "image" | "caption" | "note" | "link";
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
  captionText: string | null;
  noteParagraph: string | null;
  url: string | null;
  ogImageUrl: string | null;
  ogTitle: string | null;
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

export type ItemCollectionRemove = {
  workspaceId: string;
  itemId: string;
  collectionId: string;
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

export type ItemCollectionClient = {
  getCollectionDetail(query: CollectionDetailQuery): Promise<CollectionDetail>;
  listCollectionIndex(query: CollectionIndexQuery): Promise<CollectionIndexItem[]>;
  listCollectionOptions(query: CollectionOptionsQuery): Promise<CollectionOption[]>;
  attachCollection(change: ItemCollectionAttach): Promise<ItemCollectionAttachResult>;
  createCollectionAndAttach(change: ItemCollectionCreateAndAttach): Promise<ItemCollectionCreateAndAttachResult>;
  removeCollection(change: ItemCollectionRemove): Promise<ItemCollectionRemoveResult>;
};

export type PocketBaseItemCollectionClientOptions = {
  baseUrl: string;
  detailEndpointPath?: string;
  indexEndpointPath?: string;
  optionsEndpointPath?: string;
  attachEndpointPath?: string;
  createEndpointPath?: string;
  removeEndpointPath?: string;
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
  fetcher = globalThis.fetch,
}: PocketBaseItemCollectionClientOptions): ItemCollectionClient {
  return {
    async getCollectionDetail(query) {
      const response = await fetcher(buildCollectionDetailUrl(baseUrl, detailEndpointPath, query), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`PocketBase collection detail read failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as CollectionDetailResponse;
      if (!payload.collection) {
        throw new Error("PocketBase collection detail response must include { collection }");
      }

      return {
        ...payload.collection,
        items: payload.collection.items.map((item) => ({
          ...item,
          imageUrl: resolvePocketBaseFileUrl(baseUrl, item.imageUrl),
        })),
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

      return payload.collections;
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

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
