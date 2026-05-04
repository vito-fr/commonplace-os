import captionsFixture from "../../seed/fixtures/05_items_caption.json";
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

const items = itemsFixture as FixtureItem[];
const sources = sourcesFixture as FixtureSource[];
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
      image: null,
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
