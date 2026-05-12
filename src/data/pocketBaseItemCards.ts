import type { ItemCardProps, ItemMediaPreview } from "../components/items";
import type { ItemCardQuery, ItemCardReader } from "./itemCardReader";
import { normalizeRemoteMediaUrl, resolvePocketBaseFileUrl } from "./pocketBaseFiles";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type RemoteItemCard = Omit<ItemCardProps, "onNavigate">;
type PocketBaseItemCardResponse = RemoteItemCard[] | { items: RemoteItemCard[] };

export type PocketBaseItemCardReaderOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

export function createPocketBaseItemCardReader({
  baseUrl,
  endpointPath = "/api/vita/item-cards",
  fetcher = globalThis.fetch,
}: PocketBaseItemCardReaderOptions): ItemCardReader {
  return {
    async listItemCards(query) {
      const response = await fetcher(buildItemCardsUrl(baseUrl, endpointPath, query), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`PocketBase item card read failed with HTTP ${response.status}`);
      }

      return parseItemCardsResponse((await response.json()) as PocketBaseItemCardResponse, baseUrl);
    },
  };
}

function buildItemCardsUrl(baseUrl: string, endpointPath: string, query: ItemCardQuery) {
  const url = new URL(endpointPath, normalizeBaseUrl(baseUrl));
  url.searchParams.set("workspace_id", query.workspaceId);

  if (query.itemIds?.length) {
    url.searchParams.set("item_ids", query.itemIds.join(","));
  }

  if (query.filters?.status) {
    url.searchParams.set("status", query.filters.status);
  }

  if (query.filters?.type) {
    url.searchParams.set("type", query.filters.type);
  }

  if (query.filters?.source) {
    url.searchParams.set("source", query.filters.source);
  }

  if (query.filters?.format) {
    url.searchParams.set("format", query.filters.format);
  }

  if (query.filters?.collection) {
    url.searchParams.set("collection", query.filters.collection);
  }

  if (query.filters?.text) {
    url.searchParams.set("q", query.filters.text);
  }

  return url;
}

function parseItemCardsResponse(payload: PocketBaseItemCardResponse, baseUrl: string) {
  const rows = Array.isArray(payload) ? payload : payload.items;

  if (!Array.isArray(rows)) {
    throw new Error("PocketBase item card response must be an array or { items: [] }");
  }

  return rows.map((row) => {
    const imageUrl = resolvePocketBaseFileUrl(baseUrl, row.imageUrl);
    const assetFileUrl = resolvePocketBaseFileUrl(baseUrl, row.assetFileUrl);
    const ogImageUrl = normalizeRemoteMediaUrl(row.ogImageUrl);
    const thumbnailUrl = resolvePocketBaseFileUrl(baseUrl, row.thumbnailUrl) ?? imageUrl ?? ogImageUrl ?? null;
    const videoPosterUrl = resolvePocketBaseFileUrl(baseUrl, row.videoPosterUrl) ?? ogImageUrl ?? null;
    const previewUrl =
      resolvePocketBaseFileUrl(baseUrl, row.previewUrl) ??
      imageUrl ??
      thumbnailUrl ??
      videoPosterUrl ??
      ogImageUrl ??
      assetFileUrl ??
      null;
    const mediaPreview = resolveMediaPreview(baseUrl, row.mediaPreview, {
      assetFileUrl,
      assetMimeType: row.assetMimeType ?? null,
      imageUrl,
      ogImageUrl,
      previewUrl,
      thumbnailUrl,
      videoPosterUrl,
    });

    return {
      ...row,
      imageUrl,
      ogImageUrl,
      assetFileUrl,
      previewUrl,
      thumbnailUrl,
      videoPosterUrl,
      mediaPreview,
      onNavigate: () => undefined,
    };
  });
}

function resolveMediaPreview(
  baseUrl: string,
  preview: ItemMediaPreview | null | undefined,
  fallback: Required<Pick<ItemMediaPreview, "assetFileUrl" | "assetMimeType" | "imageUrl" | "ogImageUrl" | "previewUrl" | "thumbnailUrl" | "videoPosterUrl">>,
): ItemMediaPreview {
  const imageUrl = resolvePocketBaseFileUrl(baseUrl, preview?.imageUrl) ?? fallback.imageUrl;
  const assetFileUrl = resolvePocketBaseFileUrl(baseUrl, preview?.assetFileUrl) ?? fallback.assetFileUrl;
  const ogImageUrl = normalizeRemoteMediaUrl(preview?.ogImageUrl) ?? fallback.ogImageUrl;
  const thumbnailUrl = resolvePocketBaseFileUrl(baseUrl, preview?.thumbnailUrl) ?? fallback.thumbnailUrl ?? imageUrl ?? ogImageUrl;
  const videoPosterUrl =
    resolvePocketBaseFileUrl(baseUrl, preview?.videoPosterUrl) ?? fallback.videoPosterUrl ?? ogImageUrl;
  const previewUrl =
    resolvePocketBaseFileUrl(baseUrl, preview?.previewUrl) ??
    fallback.previewUrl ??
    imageUrl ??
    thumbnailUrl ??
    videoPosterUrl ??
    ogImageUrl ??
    assetFileUrl;

  return {
    ...preview,
    assetFileUrl,
    assetMimeType: preview?.assetMimeType ?? fallback.assetMimeType,
    imageUrl,
    ogImageUrl,
    previewUrl,
    thumbnailUrl,
    videoPosterUrl,
  };
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
