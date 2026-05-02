type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ItemDeletion = {
  workspaceId: string;
  itemId: string;
  actor?: string;
};

export type ItemDeletionResult = {
  itemId: string;
  cascade: {
    relationships: number;
    itemTags: number;
    collectionItems: number;
    aiAnnotations: number;
    itemEvents: number;
    embeddings: number;
  };
};

export type ItemDeleteWriter = {
  deleteItem(deletion: ItemDeletion): Promise<ItemDeletionResult>;
};

export type PocketBaseItemDeleteWriterOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

export function createPocketBaseItemDeleteWriter({
  baseUrl,
  endpointPath = "/api/vita/item-delete",
  fetcher = globalThis.fetch,
}: PocketBaseItemDeleteWriterOptions): ItemDeleteWriter {
  return {
    async deleteItem(deletion) {
      const response = await fetcher(buildItemDeleteUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: deletion.workspaceId,
          item_id: deletion.itemId,
          actor: deletion.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase item delete write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemDeletionResult;
      if (!payload.itemId || !payload.cascade) {
        throw new Error("PocketBase item delete response must include { itemId, cascade }");
      }

      return payload;
    },
  };
}

function buildItemDeleteUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
