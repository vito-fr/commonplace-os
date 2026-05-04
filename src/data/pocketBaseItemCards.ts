import type { ItemCardProps } from "../components/items";
import type { ItemCardQuery, ItemCardReader } from "./itemCardReader";
import { resolvePocketBaseFileUrl } from "./pocketBaseFiles";

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

  return rows.map((row) => ({
    ...row,
    imageUrl: resolvePocketBaseFileUrl(baseUrl, row.imageUrl),
    assetFileUrl: resolvePocketBaseFileUrl(baseUrl, row.assetFileUrl),
    onNavigate: () => undefined,
  }));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
