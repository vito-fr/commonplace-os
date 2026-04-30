type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CollectionOption = {
  id: string;
  name: string;
  description: string | null;
  alreadyAttached: boolean;
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

export type ItemCollectionClient = {
  listCollectionOptions(query: CollectionOptionsQuery): Promise<CollectionOption[]>;
  attachCollection(change: ItemCollectionAttach): Promise<ItemCollectionAttachResult>;
};

export type PocketBaseItemCollectionClientOptions = {
  baseUrl: string;
  optionsEndpointPath?: string;
  attachEndpointPath?: string;
  fetcher?: Fetcher;
};

type CollectionOptionsResponse = {
  collections: CollectionOption[];
};

export function createPocketBaseItemCollectionClient({
  baseUrl,
  optionsEndpointPath = "/api/vita/collection-options",
  attachEndpointPath = "/api/vita/item-collection",
  fetcher = globalThis.fetch,
}: PocketBaseItemCollectionClientOptions): ItemCollectionClient {
  return {
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
  };
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

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
