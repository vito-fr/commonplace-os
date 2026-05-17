import type { ItemStatus, ItemType } from "../components/atoms";
import type { RightsStatus } from "../components/items";
import { resolvePocketBaseFileUrl } from "./pocketBaseFiles";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ItemDetailQuery = {
  workspaceId: string;
  itemId: string;
};

export type ItemNoteUpdate = {
  workspaceId: string;
  itemId: string;
  body: string;
  format?: "plain" | "markdown" | "blocknote";
  actor?: string;
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
  aiAnnotations: ItemDetailAIAnnotation[];
  events: ItemDetailEvent[];
};

export type ItemDetailContent = {
  kind: ItemType;
  image: {
    fileRef: string | null;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    aspectRatio: number | null;
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
    asset: {
      fileRef: string | null;
      fileUrl: string | null;
      originalName: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
    } | null;
    thumbnail: {
      fileRef: string | null;
      fileUrl: string | null;
      originalName: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
    } | null;
  } | null;
  video?: {
    fileRef: string | null;
    fileUrl?: string | null;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    posterFileRef: string | null;
    posterUrl?: string | null;
    dominantColors: string[] | null;
    perceptualHash: string | null;
    aspectRatio: number | null;
    asset: {
      fileRef: string | null;
      fileUrl: string | null;
      originalName: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
    } | null;
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

export type ItemNoteUpdateResult = {
  item: {
    id: string;
    workspaceId: string;
    updatedAt: string;
    updateCount: number;
    content: {
      note: {
        body: string;
        format: string;
      };
    };
  };
  event: {
    id: string;
    eventType: "note_updated";
    createdAt: string;
  };
};

export type ItemNoteWriter = {
  updateItemNote(change: ItemNoteUpdate): Promise<ItemNoteUpdateResult>;
};

export type PocketBaseItemDetailReaderOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

export type PocketBaseItemNoteWriterOptions = {
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

      return resolveItemDetailFileRefs(payload.item, baseUrl);
    },
  };
}

export function createPocketBaseItemNoteWriter({
  baseUrl,
  endpointPath = "/api/vita/item-note",
  fetcher = globalThis.fetch,
}: PocketBaseItemNoteWriterOptions): ItemNoteWriter {
  return {
    async updateItemNote(change) {
      const response = await fetcher(buildItemNoteUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          item_id: change.itemId,
          body: change.body,
          format: change.format ?? "plain",
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase item note write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemNoteUpdateResult;
      if (!payload.item || !payload.event) {
        throw new Error("PocketBase item note response must include { item, event }");
      }

      return payload;
    },
  };
}

function buildItemDetailUrl(baseUrl: string, endpointPath: string, query: ItemDetailQuery) {
  const url = new URL(endpointPath, normalizeBaseUrl(baseUrl));
  url.searchParams.set("workspace_id", query.workspaceId);
  url.searchParams.set("item_id", query.itemId);
  return url;
}

function buildItemNoteUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function resolveItemDetailFileRefs(item: ItemDetail, baseUrl: string): ItemDetail {
  const resolvedImage = item.content.image
    ? {
        ...item.content.image,
        fileRef: resolvePocketBaseFileUrl(baseUrl, item.content.image.fileRef),
      }
    : null;
  const resolvedLink = item.content.link
    ? {
        ...item.content.link,
        asset: item.content.link.asset
          ? {
              ...item.content.link.asset,
              fileUrl: resolvePocketBaseFileUrl(baseUrl, item.content.link.asset.fileRef),
            }
          : null,
        thumbnail: item.content.link.thumbnail
          ? {
              ...item.content.link.thumbnail,
              fileUrl: resolvePocketBaseFileUrl(baseUrl, item.content.link.thumbnail.fileRef),
            }
          : null,
      }
    : null;
  const resolvedVideo = item.content.video
    ? {
        ...item.content.video,
        fileUrl: resolvePocketBaseFileUrl(baseUrl, item.content.video.fileRef),
        posterUrl: resolvePocketBaseFileUrl(baseUrl, item.content.video.posterFileRef),
        asset: item.content.video.asset
          ? {
              ...item.content.video.asset,
              fileUrl: resolvePocketBaseFileUrl(baseUrl, item.content.video.asset.fileRef),
            }
          : null,
      }
    : null;

  if (!resolvedImage && !resolvedLink && !resolvedVideo) {
    return item;
  }

  return {
    ...item,
    content: {
      ...item.content,
      image: resolvedImage,
      link: resolvedLink,
      video: resolvedVideo,
    },
  };
}
