import annotationsFixture from "../../seed/fixtures/14_ai_annotations.json";
import captionsFixture from "../../seed/fixtures/05_items_caption.json";
import collectionItemsFixture from "../../seed/fixtures/12_collection_items.json";
import collectionsFixture from "../../seed/fixtures/11_collections.json";
import imagesFixture from "../../seed/fixtures/04_items_image.json";
import itemsFixture from "../../seed/fixtures/03_items.json";
import linksFixture from "../../seed/fixtures/07_items_link.json";
import notesFixture from "../../seed/fixtures/06_items_note.json";
import sourcesFixture from "../../seed/fixtures/02_sources.json";
import type {
  CollectionDetail,
  CollectionDetailItem,
  CollectionIndexItem,
  CollectionOption,
  CollectionPreviewItem,
  ItemCollectionClient,
} from "./pocketBaseItemCollection";

type FixtureCollection = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type FixtureCollectionItem = {
  collection_id: string;
  item_id: string;
  added_at: string;
  added_by: string;
};

type FixtureItem = {
  id: string;
  workspace_id: string;
  type: "image" | "caption" | "note" | "link";
  status: string;
  title: string | null;
  description: string | null;
  summary: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

type FixtureImage = {
  item_id: string;
  file_ref: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
};

type FixtureCaption = {
  item_id: string;
  body: string;
};

type FixtureNote = {
  item_id: string;
  body: string;
};

type FixtureLink = {
  item_id: string;
  url: string;
  og_metadata: string | null;
  content_type?: string | null;
};

type FixtureSource = {
  id: string;
  kind: string;
  identifier: string;
  label: string;
};

type FixtureAnnotation = {
  item_id: string;
  review_status: string;
};

const annotations = annotationsFixture as FixtureAnnotation[];
const captions = captionsFixture as FixtureCaption[];
const collectionItems = collectionItemsFixture as FixtureCollectionItem[];
const collections = collectionsFixture as FixtureCollection[];
const images = imagesFixture as FixtureImage[];
const items = itemsFixture as FixtureItem[];
const links = linksFixture as FixtureLink[];
const notes = notesFixture as FixtureNote[];
const sources = sourcesFixture as FixtureSource[];

export const seedFixtureItemCollectionClient: ItemCollectionClient = {
  async attachCollection() {
    throw new Error("Collection writes require live archive mode.");
  },

  async createCollectionAndAttach() {
    throw new Error("Collection writes require live archive mode.");
  },

  async createCollection() {
    throw new Error("Collection writes require live archive mode.");
  },

  async getCollectionDetail({ collectionId, workspaceId }) {
    const collection = collections.find((row) => row.id === collectionId && row.workspace_id === workspaceId);
    if (!collection) {
      throw new Error("collection not found");
    }

    const collectionRows = collectionItems.filter((row) => row.collection_id === collectionId);
    const detailItems = collectionRows
      .map((row) => {
        const item = items.find((candidate) => candidate.id === row.item_id && candidate.workspace_id === workspaceId);
        return item ? toCollectionDetailItem(item, row.added_at) : null;
      })
      .filter((item): item is CollectionDetailItem => Boolean(item));
    const lastUpdatedAt = detailItems.reduce(
      (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
      collection.created_at,
    );

    return {
      id: collection.id,
      workspaceId: collection.workspace_id,
      name: collection.name,
      description: collection.description,
      createdAt: collection.created_at,
      lastUpdatedAt,
      pieceCount: detailItems.length,
      kindSummary: formatKindSummary(detailItems),
      items: detailItems,
      subCollections: [],
    };
  },

  async listCollectionIndex({ workspaceId }) {
    return collections
      .filter((collection) => collection.workspace_id === workspaceId)
      .map((collection) => toCollectionIndexItem(collection, workspaceId))
      .sort((first, second) => second.lastUpdatedAt.localeCompare(first.lastUpdatedAt) || first.name.localeCompare(second.name));
  },

  async listCollectionOptions({ itemId, workspaceId }) {
    return collections
      .filter((collection) => collection.workspace_id === workspaceId)
      .map((collection): CollectionOption => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        alreadyAttached: itemId ? collectionItems.some((row) => row.collection_id === collection.id && row.item_id === itemId) : false,
      }))
      .sort((first, second) => first.name.localeCompare(second.name));
  },

  async removeCollection() {
    throw new Error("Collection writes require live archive mode.");
  },

  async updateCollection() {
    throw new Error("Collection writes require live archive mode.");
  },
};

function toCollectionIndexItem(collection: FixtureCollection, workspaceId: string): CollectionIndexItem {
  const collectionRows = collectionItems.filter((row) => row.collection_id === collection.id);
  const detailItems = collectionRows
    .map((row) => {
      const item = items.find((candidate) => candidate.id === row.item_id && candidate.workspace_id === workspaceId);
      return item ? toCollectionDetailItem(item, row.added_at) : null;
    })
    .filter((item): item is CollectionDetailItem => Boolean(item));
  const lastUpdatedAt = detailItems.reduce(
    (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
    collection.created_at,
  );

  return {
    id: collection.id,
    workspaceId: collection.workspace_id,
    name: collection.name,
    description: collection.description,
    createdAt: collection.created_at,
    lastUpdatedAt,
    pieceCount: detailItems.length,
    kindSummary: formatKindSummary(detailItems),
    previewItems: buildCollectionPreviewItems(detailItems),
  };
}

function toCollectionDetailItem(item: FixtureItem, addedAt: string): CollectionDetailItem {
  const image = images.find((row) => row.item_id === item.id);
  const caption = captions.find((row) => row.item_id === item.id);
  const note = notes.find((row) => row.item_id === item.id);
  const link = links.find((row) => row.item_id === item.id);
  const source = sources.find((row) => row.id === item.source_id);
  const openGraph = parseOpenGraph(link?.og_metadata ?? null);
  const linkContentType = link?.content_type ?? (link ? "website" : null);
  const imageUrl = image?.file_ref ?? null;
  const imageWidth = image?.width ?? null;
  const imageHeight = image?.height ?? null;
  const aspectRatio = getAspectRatio(imageWidth, imageHeight);
  const videoPosterUrl = linkContentType === "video" ? openGraph.image : null;
  const previewUrl = imageUrl ?? openGraph.image ?? videoPosterUrl ?? null;

  return {
    id: item.id,
    type: item.type,
    status: item.status,
    title: item.title,
    description: item.description,
    summary: item.summary,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    addedAt,
    source: {
      kind: source?.kind ?? "manual",
      label: source?.label ?? source?.identifier ?? source?.kind ?? "manual",
    },
    imageUrl,
    imageWidth,
    imageHeight,
    aspectRatio,
    captionText: caption?.body ?? null,
    noteParagraph: note?.body ?? null,
    url: link?.url ?? null,
    linkContentType,
    ogImageUrl: openGraph.image,
    ogTitle: openGraph.title,
    assetFileUrl: null,
    assetMimeType: null,
    previewUrl,
    thumbnailUrl: imageUrl ?? openGraph.image,
    videoPosterUrl,
    mediaPreview: {
      previewUrl,
      imageUrl,
      thumbnailUrl: imageUrl ?? openGraph.image,
      ogImageUrl: openGraph.image,
      videoPosterUrl,
      assetFileUrl: null,
      assetMimeType: null,
      width: imageWidth,
      height: imageHeight,
      aspectRatio,
    },
  };
}

function buildCollectionPreviewItems(detailItems: CollectionDetailItem[]): CollectionPreviewItem[] {
  return [...detailItems]
    .sort((first, second) => getPreviewRank(first) - getPreviewRank(second))
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      title: item.title ?? item.ogTitle,
      kind: item.type,
      format: item.linkContentType,
      thumbnailUrl: item.thumbnailUrl ?? item.imageUrl ?? item.ogImageUrl,
      previewUrl: item.previewUrl,
      imageUrl: item.imageUrl,
      ogImageUrl: item.ogImageUrl,
      videoPosterUrl: item.videoPosterUrl,
      width: item.imageWidth,
      height: item.imageHeight,
      aspectRatio: item.aspectRatio,
      textPreview: item.captionText ?? item.noteParagraph ?? item.summary ?? item.url,
      sourceUrl: item.url,
      source: item.source.kind,
    }));
}

function getPreviewRank(item: CollectionDetailItem) {
  if (item.type === "image" && item.imageUrl) {
    return 0;
  }

  if (item.ogImageUrl) {
    return 1;
  }

  if (item.linkContentType === "pdf") {
    return 2;
  }

  return 3;
}

function formatKindSummary(detailItems: CollectionDetailItem[]) {
  const counts = detailItems.reduce<Record<string, number>>((currentCounts, item) => {
    currentCounts[item.type] = (currentCounts[item.type] ?? 0) + 1;
    return currentCounts;
  }, {});

  return (["image", "caption", "note", "link"] as const)
    .flatMap((type) => {
      const count = counts[type] ?? 0;
      return count > 0 ? [`${count} ${count === 1 ? type : `${type}s`}`] : [];
    })
    .join(" · ") || "no pieces";
}

function parseOpenGraph(value: string | null) {
  if (!value) {
    return { image: null, title: null };
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      image: typeof parsed.image === "string" ? parsed.image : null,
      title: typeof parsed.title === "string" ? parsed.title : null,
    };
  } catch {
    return { image: null, title: null };
  }
}

function getAspectRatio(width: number | null, height: number | null) {
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}
