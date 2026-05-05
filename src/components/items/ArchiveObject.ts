import type { CollectionCardModel } from "./CollectionCard";
import type { ItemCardProps } from "./ItemCard";

export type ArchiveObject =
  | { objectType: "item"; item: ItemCardProps }
  | { objectType: "collection"; collection: CollectionCardModel };
