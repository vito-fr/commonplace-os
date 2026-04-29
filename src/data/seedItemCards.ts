import annotationsFixture from "../../seed/fixtures/14_ai_annotations.json";
import captionsFixture from "../../seed/fixtures/05_items_caption.json";
import itemsFixture from "../../seed/fixtures/03_items.json";
import linksFixture from "../../seed/fixtures/07_items_link.json";
import notesFixture from "../../seed/fixtures/06_items_note.json";
import relationshipsFixture from "../../seed/fixtures/13_relationships.json";
import sourcesFixture from "../../seed/fixtures/02_sources.json";
import type { ItemCardProps, RightsStatus } from "../components/items";
import type { ItemStatus, ItemType } from "../components/atoms";

export type ItemCardQuery = {
  workspaceId: string;
  itemIds?: string[];
};

export type ItemCardReader = {
  listItemCards(query: ItemCardQuery): Promise<ItemCardProps[]>;
};

type FixtureItem = {
  id: string;
  workspace_id: string;
  type: ItemType;
  status: ItemStatus;
  title: string | null;
  source_id: string | null;
  rights_status: RightsStatus;
};

type FixtureSource = {
  id: string;
  kind: string;
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
};

type FixtureRelationship = {
  from_id: string;
  type: string;
};

type FixtureAnnotation = {
  item_id: string;
  review_status: string;
};

const defaultProofItemIds = [
  "seed:img001",
  "seed:img004",
  "seed:img008",
  "seed:cap001",
  "seed:cap004",
  "seed:note001",
  "seed:link001",
  "seed:camp001",
];

const items = itemsFixture as FixtureItem[];
const sources = sourcesFixture as FixtureSource[];
const captions = captionsFixture as FixtureCaption[];
const notes = notesFixture as FixtureNote[];
const links = linksFixture as FixtureLink[];
const relationships = relationshipsFixture as FixtureRelationship[];
const annotations = annotationsFixture as FixtureAnnotation[];

export const seedFixtureItemCardReader: ItemCardReader = {
  async listItemCards(query) {
    return getSeedFixtureItemCards(query);
  },
};

function getSeedFixtureItemCards({ workspaceId, itemIds = defaultProofItemIds }: ItemCardQuery) {
  return itemIds.map((id) => {
    const item = requireFixture(items.find((row) => row.id === id), `item ${id}`);
    if (item.workspace_id !== workspaceId) {
      throw new Error(`Seed fixture item ${id} is outside workspace ${workspaceId}`);
    }

    const source = sources.find((row) => row.id === item.source_id);
    const caption = captions.find((row) => row.item_id === item.id);
    const note = notes.find((row) => row.item_id === item.id);
    const link = links.find((row) => row.item_id === item.id);
    const ogMetadata = parseOgMetadata(link?.og_metadata ?? null);

    return {
      id: item.id,
      type: item.type,
      status: item.status,
      source: source?.kind ?? "manual",
      usageCount: relationships.filter(
        (relationship) => relationship.type === "used_in" && relationship.from_id === item.id,
      ).length,
      title: item.title,
      captionText: caption?.body ?? null,
      noteParagraph: note?.body ?? null,
      url: link?.url ?? null,
      ogImageUrl: ogMetadata.image,
      ogTitle: ogMetadata.title,
      hasPendingAIAnnotations: annotations.some(
        (annotation) => annotation.item_id === item.id && annotation.review_status === "pending",
      ),
      rightsStatus: item.rights_status,
      onNavigate: () => undefined,
    };
  });
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
