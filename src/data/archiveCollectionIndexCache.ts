import type { CollectionIndexItem } from "./pocketBaseItemCollection";

const archiveCollectionIndexCacheVersion = 1;
const archiveCollectionIndexCachePrefix = `vita:archive-collections:v${archiveCollectionIndexCacheVersion}`;
const archiveCollectionIndexCacheTtlMs = 1000 * 60 * 60 * 24 * 7;

type CachedArchiveCollectionIndexPayload = {
  cachedAt: number;
  collections: CollectionIndexItem[];
  version: number;
};

export function readCachedArchiveCollectionIndex(workspaceId: string, cacheScope = "default") {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(getArchiveCollectionIndexCacheKey(workspaceId, cacheScope));
    if (!rawValue) {
      return null;
    }

    const payload = JSON.parse(rawValue) as Partial<CachedArchiveCollectionIndexPayload>;
    if (
      payload.version !== archiveCollectionIndexCacheVersion ||
      !payload.cachedAt ||
      Date.now() - payload.cachedAt > archiveCollectionIndexCacheTtlMs ||
      !Array.isArray(payload.collections)
    ) {
      return null;
    }

    const collections = payload.collections.filter(isCacheableCollectionIndexItem);
    return collections.length > 0 ? collections : null;
  } catch {
    return null;
  }
}

export function writeCachedArchiveCollectionIndex(
  workspaceId: string,
  collections: CollectionIndexItem[],
  cacheScope = "default",
) {
  const storage = getStorage();
  if (!storage || collections.length === 0) {
    return;
  }

  try {
    const payload: CachedArchiveCollectionIndexPayload = {
      cachedAt: Date.now(),
      collections,
      version: archiveCollectionIndexCacheVersion,
    };
    storage.setItem(getArchiveCollectionIndexCacheKey(workspaceId, cacheScope), JSON.stringify(payload));
  } catch {
    // Storage can be unavailable or full; the app should still render from network data.
  }
}

function getArchiveCollectionIndexCacheKey(workspaceId: string, cacheScope: string) {
  return `${archiveCollectionIndexCachePrefix}:${cacheScope}:${workspaceId}`;
}

function isCacheableCollectionIndexItem(value: unknown): value is CollectionIndexItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const collection = value as Partial<CollectionIndexItem>;
  return (
    typeof collection.id === "string" &&
    typeof collection.workspaceId === "string" &&
    typeof collection.name === "string" &&
    typeof collection.createdAt === "string" &&
    typeof collection.lastUpdatedAt === "string" &&
    typeof collection.pieceCount === "number" &&
    Array.isArray(collection.previewItems)
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
