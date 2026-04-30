import type { ItemStatus } from "../components/atoms";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ItemStatusChange = {
  workspaceId: string;
  itemId: string;
  nextStatus: ItemStatus;
  actor?: string;
};

export type ItemStatusChangeResult = {
  item: {
    id: string;
    workspaceId: string;
    status: ItemStatus;
    updatedAt: string;
  };
  event: {
    id: string;
    eventType: "status_changed";
    createdAt: string;
  };
};

export type ItemStatusWriter = {
  updateItemStatus(change: ItemStatusChange): Promise<ItemStatusChangeResult>;
};

export type PocketBaseItemStatusWriterOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

export function createPocketBaseItemStatusWriter({
  baseUrl,
  endpointPath = "/api/vita/item-status",
  fetcher = globalThis.fetch,
}: PocketBaseItemStatusWriterOptions): ItemStatusWriter {
  return {
    async updateItemStatus(change) {
      const response = await fetcher(buildItemStatusUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          item_id: change.itemId,
          next_status: change.nextStatus,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase item status write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemStatusChangeResult;
      if (!payload.item || !payload.event) {
        throw new Error("PocketBase item status response must include { item, event }");
      }

      return payload;
    },
  };
}

function buildItemStatusUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
