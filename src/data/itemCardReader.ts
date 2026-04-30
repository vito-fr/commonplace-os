import type { ItemCardProps } from "../components/items";
import type { ItemStatus, ItemType } from "../components/atoms";

export type ItemSourceFilter =
  | "pinterest"
  | "arena"
  | "url"
  | "local"
  | "ios_capture"
  | "manual";

export type ItemCardFilters = {
  status?: ItemStatus;
  type?: ItemType;
  source?: ItemSourceFilter;
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
