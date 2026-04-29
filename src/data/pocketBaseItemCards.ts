import type { ItemCardProps } from "../components/items";
import type { ItemCardQuery, ItemCardReader } from "./itemCardReader";

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

      return parseItemCardsResponse((await response.json()) as PocketBaseItemCardResponse);
    },
  };
}

function buildItemCardsUrl(baseUrl: string, endpointPath: string, query: ItemCardQuery) {
  const url = new URL(endpointPath, normalizeBaseUrl(baseUrl));
  url.searchParams.set("workspace_id", query.workspaceId);

  if (query.itemIds?.length) {
    url.searchParams.set("item_ids", query.itemIds.join(","));
  }

  return url;
}

function parseItemCardsResponse(payload: PocketBaseItemCardResponse) {
  const rows = Array.isArray(payload) ? payload : payload.items;

  if (!Array.isArray(rows)) {
    throw new Error("PocketBase item card response must be an array or { items: [] }");
  }

  return rows.map((row) => ({
    ...row,
    onNavigate: () => undefined,
  }));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
