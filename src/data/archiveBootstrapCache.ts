import type { ItemCardProps } from "../components/items";
import type { ItemCardQuery } from "./itemCardReader";

const archiveBootstrapCacheVersion = 1;
const archiveBootstrapCachePrefix = `vita:archive-bootstrap:v${archiveBootstrapCacheVersion}`;
const archiveBootstrapCacheTtlMs = 1000 * 60 * 60 * 24 * 7;

type CachedArchivePayload = {
  cachedAt: number;
  items: ItemCardProps[];
  version: number;
};

export function readCachedArchiveItemCards(query: ItemCardQuery) {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(getArchiveCacheKey(query));
    if (!rawValue) {
      return null;
    }

    const payload = JSON.parse(rawValue) as Partial<CachedArchivePayload>;
    if (
      payload.version !== archiveBootstrapCacheVersion ||
      !payload.cachedAt ||
      Date.now() - payload.cachedAt > archiveBootstrapCacheTtlMs ||
      !Array.isArray(payload.items)
    ) {
      return null;
    }

    const items = payload.items.filter(isCacheableItemCard);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

export function writeCachedArchiveItemCards(query: ItemCardQuery, items: ItemCardProps[]) {
  const storage = getStorage();
  if (!storage || items.length === 0) {
    return;
  }

  try {
    const payload: CachedArchivePayload = {
      cachedAt: Date.now(),
      items: items.map(toSerializableItemCard),
      version: archiveBootstrapCacheVersion,
    };
    storage.setItem(getArchiveCacheKey(query), JSON.stringify(payload));
  } catch {
    // Storage can be unavailable or full; the app should still render from network data.
  }
}

function getArchiveCacheKey(query: ItemCardQuery) {
  return `${archiveBootstrapCachePrefix}:${query.cacheScope ?? "default"}:${query.workspaceId}:${stableStringify(query.filters ?? {})}:${(query.itemIds ?? []).join(",")}`;
}

function stableStringify(value: Record<string, unknown>) {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const nextValue = value[key];
        if (nextValue !== undefined && nextValue !== null && nextValue !== "") {
          accumulator[key] = nextValue;
        }
        return accumulator;
      }, {}),
  );
}

function toSerializableItemCard(item: ItemCardProps): ItemCardProps {
  const {
    onAddToCollection: _onAddToCollection,
    onDelete: _onDelete,
    onNavigate: _onNavigate,
    onSelectToggle: _onSelectToggle,
    ...serializableItem
  } = item;

  return serializableItem;
}

function isCacheableItemCard(value: unknown): value is ItemCardProps {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ItemCardProps>;
  return (
    typeof item.id === "string" &&
    typeof item.type === "string" &&
    typeof item.status === "string" &&
    typeof item.source === "string"
  );
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
