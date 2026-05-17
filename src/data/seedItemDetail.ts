import captionsFixture from "../../seed/fixtures/05_items_caption.json";
import imagesFixture from "../../seed/fixtures/04_items_image.json";
import itemsFixture from "../../seed/fixtures/03_items.json";
import linksFixture from "../../seed/fixtures/07_items_link.json";
import notesFixture from "../../seed/fixtures/06_items_note.json";
import sourcesFixture from "../../seed/fixtures/02_sources.json";
import type { ItemStatus, ItemType } from "../components/atoms";
import type { RightsStatus } from "../components/items";
import type { ItemDetail, ItemDetailQuery, ItemDetailReader } from "./pocketBaseItemDetail";

type FixtureItem = {
  id: string;
  workspace_id: string;
  type: ItemType;
  status: ItemStatus;
  title: string | null;
  description: string | null;
  summary: string | null;
  source_id: string | null;
  source_external_id: string | null;
  rights_status: RightsStatus;
  rights_note: string | null;
  rights_reviewed_at: string | null;
  privacy_level: string | null;
  update_count: number;
  created_at: string;
  updated_at: string;
};

type FixtureSource = {
  id: string;
  kind: string;
  identifier: string;
  label: string;
};

type FixtureCaption = {
  item_id: string;
  body: string;
  tone?: string | null;
  cta_type?: string | null;
  length_chars?: number | null;
};

type FixtureNote = {
  item_id: string;
  body: string;
  format?: string | null;
};

type FixtureLink = {
  item_id: string;
  url: string;
  og_metadata?: string | null;
  content_type?: string | null;
  fetched_at?: string | null;
};

type FixtureImage = {
  item_id: string;
  file_ref: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  dominant_colors: string | null;
  perceptual_hash: string | null;
  ocr_text: string | null;
};

const items = itemsFixture as FixtureItem[];
const sources = sourcesFixture as FixtureSource[];
const images = imagesFixture as FixtureImage[];
const captions = captionsFixture as FixtureCaption[];
const notes = notesFixture as FixtureNote[];
const links = linksFixture as FixtureLink[];

export const seedFixtureItemDetailReader: ItemDetailReader = {
  async getItemDetail(query) {
    return getSeedFixtureItemDetail(query);
  },
};

function getSeedFixtureItemDetail({ workspaceId, itemId }: ItemDetailQuery): ItemDetail {
  const item = items.find((row) => row.id === itemId && row.workspace_id === workspaceId);
  if (!item) {
    throw new Error(`Seed fixture item ${itemId} not found in workspace ${workspaceId}`);
  }

  const source = item.source_id
    ? sources.find((row) => row.id === item.source_id) ?? null
    : null;

  const caption = captions.find((row) => row.item_id === item.id);
  const note = notes.find((row) => row.item_id === item.id);
  const link = links.find((row) => row.item_id === item.id);
  const image = images.find((row) => row.item_id === item.id);

  return {
    id: item.id,
    workspaceId: item.workspace_id,
    type: item.type,
    status: item.status,
    title: item.title,
    description: item.description,
    summary: item.summary,
    source: source
      ? {
          id: source.id,
          kind: source.kind,
          identifier: source.identifier,
          label: source.label,
        }
      : null,
    sourceExternalId: item.source_external_id ?? null,
    privacyLevel: item.privacy_level ?? null,
    rightsStatus: item.rights_status,
    rightsNote: item.rights_note ?? null,
    rightsReviewedAt: item.rights_reviewed_at ?? null,
    updateCount: item.update_count ?? 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    content: {
      kind: item.type,
      image:
        item.type === "image"
          ? {
              fileRef: image?.file_ref ?? null,
              mimeType: image?.mime_type ?? null,
              width: image?.width ?? null,
              height: image?.height ?? null,
              aspectRatio: getAspectRatio(image?.width ?? null, image?.height ?? null),
              dominantColors: parseOgMetadata(image?.dominant_colors) as string[] | null,
              perceptualHash: image?.perceptual_hash ?? null,
              ocrText: image?.ocr_text ?? null,
            }
          : null,
      caption: caption
        ? {
            body: caption.body ?? null,
            tone: caption.tone ?? null,
            ctaType: caption.cta_type ?? null,
            lengthChars: caption.length_chars ?? null,
          }
        : null,
      note: note ? { body: note.body ?? null, format: note.format ?? null } : null,
      link: link
        ? {
            url: link.url ?? null,
            ogMetadata: parseOgMetadata(link.og_metadata),
            contentType: link.content_type ?? null,
            fetchedAt: link.fetched_at ?? null,
            asset: null,
            thumbnail: null,
          }
        : null,
    },
    tags: [],
    relationships: [],
    collections: [],
    aiAnnotations: [],
    events: [],
  };
}

function getAspectRatio(width: number | null, height: number | null) {
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
}

function parseOgMetadata(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
