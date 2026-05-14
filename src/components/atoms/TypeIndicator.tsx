export type ItemType = "image" | "caption" | "note" | "link" | "video";

export interface TypeIndicatorProps {
  type: ItemType;
}

const typeGlyphs: Record<ItemType, string> = {
  image: "i",
  caption: "c",
  note: "n",
  link: "l",
  video: "v",
};

export function TypeIndicator({ type }: TypeIndicatorProps) {
  return (
    <span className="type-indicator" role="img" aria-label={`${type} item`}>
      {typeGlyphs[type]}
    </span>
  );
}
