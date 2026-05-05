import type { ItemCardProps } from "../components/items";
import type { ItemStatus, ItemType } from "../components/atoms";

export type ItemSourceFilter =
  | "pinterest"
  | "arena"
  | "url"
  | "local"
  | "ios_capture"
  | "manual";

export type ItemFormatFilter = "pdf" | "video" | "website";

export type ItemCardFilters = {
  status?: ItemStatus;
  type?: ItemType;
  source?: ItemSourceFilter;
  format?: ItemFormatFilter;
  collection?: string;
  text?: string;
};

export type ItemCardQuery = {
  workspaceId: string;
  itemIds?: string[];
  filters?: ItemCardFilters;
};

export type ItemCardReader = {
  listItemCards(query: ItemCardQuery): Promise<ItemCardProps[]>;
};
