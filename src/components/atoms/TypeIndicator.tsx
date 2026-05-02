export type ItemType = "image" | "caption" | "note" | "link";

export interface TypeIndicatorProps {
  type: ItemType;
}

const typeGlyphs: Record<ItemType, string> = {
  image: "i",
  caption: "c",
  note: "n",
  link: "l",
};

export function TypeIndicator({ type }: TypeIndicatorProps) {
  return (
    <span className="type-indicator" role="img" aria-label={`${type} item`}>
      {typeGlyphs[type]}
    </span>
  );
}
