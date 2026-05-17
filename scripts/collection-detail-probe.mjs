const baseUrl = process.env.VITE_POCKETBASE_URL ?? "http://127.0.0.1:8090";
const workspaceId = process.env.VITA_WORKSPACE_ID ?? "seed:ws001";

const indexUrl = new URL("/api/vita/collection-index", baseUrl);
indexUrl.searchParams.set("workspace_id", workspaceId);

const indexResponse = await fetch(indexUrl);
if (!indexResponse.ok) {
  throw new Error(`collection-index failed: ${indexResponse.status}`);
}

const indexPayload = await indexResponse.json();
const collections = Array.isArray(indexPayload.collections) ? indexPayload.collections : [];
if (collections.length === 0) {
  console.log("No collections available for collection-detail probe.");
  process.exit(0);
}

const selected = uniqueById([
  collections.find((collection) => String(collection.id).includes("collection:arena:")),
  collections.find((collection) => !String(collection.id).includes("collection:arena:")),
  collections[0],
]).slice(0, 2);

for (const collection of selected) {
  const detailUrl = new URL("/api/vita/collection-detail", baseUrl);
  detailUrl.searchParams.set("workspace_id", workspaceId);
  detailUrl.searchParams.set("collection_id", collection.id);

  const detailResponse = await fetch(detailUrl);
  if (!detailResponse.ok) {
    throw new Error(`collection-detail failed for ${collection.id}: ${detailResponse.status}`);
  }

  const detailPayload = await detailResponse.json();
  if (!detailPayload.collection?.id) {
    throw new Error(`collection-detail returned an invalid payload for ${collection.id}`);
  }

  console.log(`collection-detail ok: ${detailPayload.collection.name} (${detailPayload.collection.items?.length ?? 0} items)`);
}

function uniqueById(collections) {
  const seen = new Set();
  const unique = [];
  for (const collection of collections) {
    if (!collection || seen.has(collection.id)) {
      continue;
    }
    seen.add(collection.id);
    unique.push(collection);
  }
  return unique;
}
