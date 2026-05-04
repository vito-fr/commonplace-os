import type { ItemStatus } from "../components/atoms";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ItemCaptureCreate = {
  workspaceId: string;
  type: "note";
  body: string;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemUrlCaptureCreate = {
  workspaceId: string;
  type: "link";
  url: string;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemImageCaptureCreate = {
  workspaceId: string;
  type: "image";
  file: File;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemCaptureCreateResult = {
  created: boolean;
  item: {
    id: string;
    workspaceId: string;
    type: "note" | "link" | "image";
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

export type ItemUrlCaptureCreateResult = {
  created: boolean;
  item: {
    id: string;
    workspaceId: string;
    type: "link";
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

export type ItemImageCaptureCreateResult = ItemCaptureCreateResult;

export type ItemCaptureWriter = {
  captureNote(change: ItemCaptureCreate): Promise<ItemCaptureCreateResult>;
  captureUrl(change: ItemUrlCaptureCreate): Promise<ItemUrlCaptureCreateResult>;
  captureImage(change: ItemImageCaptureCreate): Promise<ItemImageCaptureCreateResult>;
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
    async captureUrl(change) {
      const response = await fetcher(buildCaptureUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          type: change.type,
          url: change.url,
          source_external_id: change.sourceExternalId,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase URL capture write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemUrlCaptureCreateResult;
      if (!payload.item || typeof payload.created !== "boolean") {
        throw new Error("PocketBase URL capture response must include { created, item }");
      }

      return payload;
    },
    async captureImage(change) {
      const formData = new FormData();
      formData.set("workspace_id", change.workspaceId);
      formData.set("type", change.type);
      formData.set("file", change.file);

      if (change.sourceExternalId) {
        formData.set("source_external_id", change.sourceExternalId);
      }

      if (change.actor) {
        formData.set("actor", change.actor);
      }

      const response = await fetcher(buildCaptureUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`PocketBase image capture write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemImageCaptureCreateResult;
      if (!payload.item || typeof payload.created !== "boolean") {
        throw new Error("PocketBase image capture response must include { created, item }");
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
