type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type RelationshipType = "references";

export type ItemRelationshipCreate = {
  workspaceId: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  note?: string;
  actor?: string;
};

export type ItemRelationshipCreateResult = {
  relationship: {
    id: string;
    workspaceId: string;
    fromId: string;
    toId: string;
    type: RelationshipType;
    note: string | null;
    assertedBy: "human";
    createdAt: string;
  };
  events: Array<{
    id: string;
    itemId: string;
    eventType: "relationship_added";
    createdAt: string;
  }>;
};

export type ItemRelationshipWriter = {
  createRelationship(change: ItemRelationshipCreate): Promise<ItemRelationshipCreateResult>;
};

export type PocketBaseItemRelationshipWriterOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

export function createPocketBaseItemRelationshipWriter({
  baseUrl,
  endpointPath = "/api/vita/item-relationship",
  fetcher = globalThis.fetch,
}: PocketBaseItemRelationshipWriterOptions): ItemRelationshipWriter {
  return {
    async createRelationship(change) {
      const response = await fetcher(buildRelationshipUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          from_id: change.fromId,
          to_id: change.toId,
          type: change.type,
          note: change.note,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase relationship write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemRelationshipCreateResult;
      if (!payload.relationship || !Array.isArray(payload.events)) {
        throw new Error("PocketBase relationship response must include { relationship, events }");
      }

      return payload;
    },
  };
}

function buildRelationshipUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
