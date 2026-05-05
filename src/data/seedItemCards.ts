import annotationsFixture from "../../seed/fixtures/14_ai_annotations.json";
import captionsFixture from "../../seed/fixtures/05_items_caption.json";
import collectionItemsFixture from "../../seed/fixtures/12_collection_items.json";
import itemsFixture from "../../seed/fixtures/03_items.json";
import imagesFixture from "../../seed/fixtures/04_items_image.json";
import linksFixture from "../../seed/fixtures/07_items_link.json";
import notesFixture from "../../seed/fixtures/06_items_note.json";
import relationshipsFixture from "../../seed/fixtures/13_relationships.json";
import sourcesFixture from "../../seed/fixtures/02_sources.json";
import type { RightsStatus } from "../components/items";
import type { ItemStatus, ItemType } from "../components/atoms";
import type { ItemCardQuery, ItemCardReader, ItemFormatFilter, ItemSourceFilter } from "./itemCardReader";

type FixtureItem = {
  id: string;
  workspace_id: string;
  type: ItemType;
  status: ItemStatus;
  title: string | null;
  description: string | null;
  summary: string | null;
  source_id: string | null;
  rights_status: RightsStatus;
  created_at: string;
};

type FixtureSource = {
  id: string;
  kind: ItemSourceFilter;
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

type FixtureImage = {
  item_id: string;
  file_ref: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
};

type FixtureRelationship = {
  from_id: string;
  type: string;
};

type FixtureAnnotation = {
  item_id: string;
  review_status: string;
};

type FixtureCollectionItem = {
  item_id: string;
};

const defaultProofItemIds = [
  "seed:img004",
  "seed:img005",
  "seed:img008",
  "seed:cap001",
  "seed:cap002",
  "seed:note001",
  "seed:note003",
  "seed:link001",
];

const items = itemsFixture as FixtureItem[];
const sources = sourcesFixture as FixtureSource[];
const captions = captionsFixture as FixtureCaption[];
const notes = notesFixture as FixtureNote[];
const links = linksFixture as FixtureLink[];
const images = imagesFixture as FixtureImage[];
const relationships = relationshipsFixture as FixtureRelationship[];
const annotations = annotationsFixture as FixtureAnnotation[];
const collectionItems = collectionItemsFixture as FixtureCollectionItem[];

export const seedFixtureItemCardReader: ItemCardReader = {
  async listItemCards(query) {
    return getSeedFixtureItemCards(query);
  },
};

function getSeedFixtureItemCards({ workspaceId, itemIds = defaultProofItemIds, filters }: ItemCardQuery) {
  return itemIds.flatMap((id) => {
    const item = requireFixture(items.find((row) => row.id === id), `item ${id}`);
    if (item.workspace_id !== workspaceId) {
      throw new Error(`Seed fixture item ${id} is outside workspace ${workspaceId}`);
    }

    if (filters?.status && item.status !== filters.status) {
      return [];
    }

    if (filters?.type && item.type !== filters.type) {
      return [];
    }

    const source = sources.find((row) => row.id === item.source_id);
    const sourceKind = source?.kind ?? "manual";

    if (filters?.source && sourceKind !== filters.source) {
      return [];
    }

    const caption = captions.find((row) => row.item_id === item.id);
    const note = notes.find((row) => row.item_id === item.id);
    const link = links.find((row) => row.item_id === item.id);
    const image = images.find((row) => row.item_id === item.id);
    const ogMetadata = parseOgMetadata(link?.og_metadata ?? null);
    const linkContentType = getLinkContentType(link);
    const imageWidth = image?.width ?? null;
    const imageHeight = image?.height ?? null;
    const aspectRatio = getAspectRatio(imageWidth, imageHeight);
    const imageUrl = image?.file_ref ?? null;
    const assetFileUrl = null;
    const videoPosterUrl = linkContentType === "video" ? ogMetadata.image : null;
    const previewUrl = imageUrl ?? ogMetadata.image ?? videoPosterUrl ?? assetFileUrl;

    if (filters?.format && !matchesFormatFilter(filters.format, item.type, linkContentType)) {
      return [];
    }

    if (
      filters?.text &&
      !matchesTextQuery(filters.text, [
        item.title,
        item.description,
        item.summary,
        caption?.body,
        note?.body,
        link?.url,
        link?.og_metadata,
      ])
    ) {
      return [];
    }

    return {
      id: item.id,
      type: item.type,
      status: item.status,
      source: sourceKind,
      usageCount: relationships.filter(
        (relationship) => relationship.type === "used_in" && relationship.from_id === item.id,
      ).length,
      collectionCount: collectionItems.filter((collectionItem) => collectionItem.item_id === item.id).length,
      title: item.title,
      createdAt: item.created_at,
      imageUrl,
      captionText: caption?.body ?? null,
      noteParagraph: note?.body ?? null,
      url: link?.url ?? null,
      linkContentType,
      ogImageUrl: ogMetadata.image,
      ogTitle: ogMetadata.title,
      assetFileUrl,
      assetMimeType: null,
      previewUrl,
      thumbnailUrl: imageUrl ?? ogMetadata.image,
      videoPosterUrl,
      imageWidth,
      imageHeight,
      aspectRatio,
      mediaPreview: {
        previewUrl,
        imageUrl,
        thumbnailUrl: imageUrl ?? ogMetadata.image,
        ogImageUrl: ogMetadata.image,
        videoPosterUrl,
        assetFileUrl,
        assetMimeType: null,
        width: imageWidth,
        height: imageHeight,
        aspectRatio,
      },
      hasPendingAIAnnotations: annotations.some(
        (annotation) => annotation.item_id === item.id && annotation.review_status === "pending",
      ),
      rightsStatus: item.rights_status,
      onNavigate: () => undefined,
    };
  });
}

function getAspectRatio(width: number | null, height: number | null) {
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}

function getLinkContentType(link: FixtureLink | undefined) {
  if (!link) {
    return null;
  }

  return link.content_type ?? "website";
}

function matchesFormatFilter(format: ItemFormatFilter, itemType: ItemType, linkContentType: string | null) {
  if (itemType !== "link") {
    return false;
  }

  if (format === "website") {
    return !linkContentType || linkContentType === "unknown" || linkContentType === "website";
  }

  return linkContentType === format;
}

function matchesTextQuery(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function requireFixture<T>(value: T | undefined, label: string) {
  if (!value) {
    throw new Error(`Missing seed fixture row: ${label}`);
  }

  return value;
}

function parseOgMetadata(value: string | null): { image: string | null; title: string | null } {
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
