import type { ItemStatus } from "../components/atoms";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ItemRetirement = {
  workspaceId: string;
  itemId: string;
  replacementId: string;
  actor?: string;
};

export type ItemRetirementResult = {
  item: {
    id: string;
    workspaceId: string;
    status: ItemStatus;
    updatedAt: string;
  };
  relationship: {
    id: string;
    workspaceId: string;
    fromId: string;
    toId: string;
    type: "retired_by";
    assertedBy: "human";
    createdAt: string;
  };
  events: Array<{
    id: string;
    itemId: string;
    eventType: "status_changed" | "relationship_added";
    createdAt: string;
  }>;
};

export type ItemRetirementWriter = {
  retireWithReplacement(change: ItemRetirement): Promise<ItemRetirementResult>;
};

export type PocketBaseItemRetirementWriterOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

export function createPocketBaseItemRetirementWriter({
  baseUrl,
  endpointPath = "/api/vita/item-retirement",
  fetcher = globalThis.fetch,
}: PocketBaseItemRetirementWriterOptions): ItemRetirementWriter {
  return {
    async retireWithReplacement(change) {
      const response = await fetcher(buildItemRetirementUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          item_id: change.itemId,
          replacement_id: change.replacementId,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase item retirement write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemRetirementResult;
      if (!payload.item || !payload.relationship || !Array.isArray(payload.events)) {
        throw new Error(
          "PocketBase item retirement response must include { item, relationship, events }",
        );
      }

      return payload;
    },
  };
}

function buildItemRetirementUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
