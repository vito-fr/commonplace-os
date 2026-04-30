import type { ItemCardProps } from "../components/items";
import type { ItemStatus, ItemType } from "../components/atoms";

export type ItemCardFilters = {
  status?: ItemStatus;
  type?: ItemType;
};

export type ItemCardQuery = {
  workspaceId: string;
  itemIds?: string[];
  filters?: ItemCardFilters;
};

export type ItemCardReader = {
  listItemCards(query: ItemCardQuery): Promise<ItemCardProps[]>;
};
