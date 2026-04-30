import type { ItemStatus } from "../components/atoms";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ItemCaptureCreate = {
  workspaceId: string;
  type: "note";
  body: string;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemCaptureCreateResult = {
  created: boolean;
  item: {
    id: string;
    workspaceId: string;
    type: "note";
    status: ItemStatus;
    sourceId: string;
    sourceExternalId: string;
    createdAt: string;
    updatedAt: string;
  };
  event: {
    id: string;
    eventType: "imported";
    createdAt: string;
  } | null;
};

export type ItemCaptureWriter = {
  captureNote(change: ItemCaptureCreate): Promise<ItemCaptureCreateResult>;
};

export type PocketBaseItemCaptureWriterOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

export function createPocketBaseItemCaptureWriter({
  baseUrl,
  endpointPath = "/api/vita/item-capture",
  fetcher = globalThis.fetch,
}: PocketBaseItemCaptureWriterOptions): ItemCaptureWriter {
  return {
    async captureNote(change) {
      const response = await fetcher(buildCaptureUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          type: change.type,
          body: change.body,
          source_external_id: change.sourceExternalId,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase capture write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemCaptureCreateResult;
      if (!payload.item || typeof payload.created !== "boolean") {
        throw new Error("PocketBase capture response must include { created, item }");
      }

      return payload;
    },
  };
}

function buildCaptureUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
