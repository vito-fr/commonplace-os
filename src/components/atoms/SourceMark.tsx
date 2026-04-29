export interface SourceMarkProps {
  source: string;
}

export function SourceMark({ source }: SourceMarkProps) {
  const normalizedSource = source.toLowerCase();

  return (
    <span className="source-mark" aria-label={`source: ${normalizedSource}`}>
      {normalizedSource}
    </span>
  );
}
