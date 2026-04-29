import type { ItemCardProps } from "../components/items";

export type ItemCardQuery = {
  workspaceId: string;
  itemIds?: string[];
};

export type ItemCardReader = {
  listItemCards(query: ItemCardQuery): Promise<ItemCardProps[]>;
};
