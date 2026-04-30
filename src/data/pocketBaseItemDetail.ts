import type { ItemStatus, ItemType } from "../components/atoms";
import type { RightsStatus } from "../components/items";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ItemDetailQuery = {
  workspaceId: string;
  itemId: string;
};

export type ItemDetailSource = {
  id: string;
  kind: string | null;
  identifier: string | null;
  label: string | null;
};

export type ItemDetail = {
  id: string;
  workspaceId: string;
  type: ItemType;
  status: ItemStatus;
  title: string | null;
  description: string | null;
  summary: string | null;
  source: ItemDetailSource | null;
  sourceExternalId: string | null;
  privacyLevel: string | null;
  rightsStatus: RightsStatus | string;
  rightsNote: string | null;
  rightsReviewedAt: string | null;
  updateCount: number;
  createdAt: string;
  updatedAt: string;
  content: ItemDetailContent;
  tags: ItemDetailTag[];
  relationships: ItemDetailRelationship[];
  collections: ItemDetailCollection[];
  campaignAttachments: ItemDetailCampaignAttachment[];
  aiAnnotations: ItemDetailAIAnnotation[];
  events: ItemDetailEvent[];
};

export type ItemDetailContent = {
  kind: ItemType;
  image: {
    fileRef: string | null;
    mimeType: string | null;
    dominantColors: string[] | null;
    perceptualHash: string | null;
    ocrText: string | null;
  } | null;
  caption: {
    body: string | null;
    tone: string | null;
    ctaType: string | null;
    lengthChars: number | null;
  } | null;
  note: {
    body: string | null;
    format: string | null;
  } | null;
  link: {
    url: string | null;
    ogMetadata: Record<string, unknown> | null;
    contentType: string | null;
    fetchedAt: string | null;
  } | null;
  campaign: {
    phase: string | null;
    channel: string | null;
    startAt: string | null;
    endAt: string | null;
    brief: string | null;
    kpiSummary: string | null;
  } | null;
};

export type ItemDetailTag = {
  id: string;
  name: string;
  status: string;
  appliedBy: string;
  appliedAt: string;
};

export type ItemDetailRelationship = {
  id: string;
  type: string;
  typeDescription: string;
  direction: string;
  otherItemId: string;
  otherItemType: string;
  otherItemStatus: string;
  otherItemTitle: string | null;
  weight: number | null;
  note: string | null;
  assertedBy: string;
  createdAt: string;
};

export type ItemDetailCollection = {
  id: string;
  name: string;
  description: string | null;
  addedAt: string;
  addedBy: string;
};

export type ItemDetailCampaignAttachment = {
  id: string;
  campaignId: string;
  campaignTitle: string | null;
  phase: string | null;
  role: string | null;
  createdAt: string;
};

export type ItemDetailAIAnnotation = {
  id: string;
  fieldName: string;
  payload: string;
  modelName: string;
  modelVersion: string | null;
  promptVersion: string | null;
  confidence: number | null;
  reviewStatus: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  supersededAt: string | null;
};

export type ItemDetailEvent = {
  id: string;
  eventType: string;
  actor: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type ItemDetailReader = {
  getItemDetail(query: ItemDetailQuery): Promise<ItemDetail>;
};

export type PocketBaseItemDetailReaderOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

type PocketBaseItemDetailResponse = {
  item: ItemDetail;
};

export function createPocketBaseItemDetailReader({
  baseUrl,
  endpointPath = "/api/vita/item-detail",
  fetcher = globalThis.fetch,
}: PocketBaseItemDetailReaderOptions): ItemDetailReader {
  return {
    async getItemDetail(query) {
      const response = await fetcher(buildItemDetailUrl(baseUrl, endpointPath, query), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`PocketBase item detail read failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as PocketBaseItemDetailResponse;
      if (!payload.item) {
        throw new Error("PocketBase item detail response must include { item }");
      }

      return payload.item;
    },
  };
}

function buildItemDetailUrl(baseUrl: string, endpointPath: string, query: ItemDetailQuery) {
  const url = new URL(endpointPath, normalizeBaseUrl(baseUrl));
  url.searchParams.set("workspace_id", query.workspaceId);
  url.searchParams.set("item_id", query.itemId);
  return url;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
