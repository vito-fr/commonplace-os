export interface UsageBadgeProps {
  count: number;
}

export function UsageBadge({ count }: UsageBadgeProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <span className="usage-badge" aria-label={`used ${count} times`}>
      used {count}×
    </span>
  );
}
