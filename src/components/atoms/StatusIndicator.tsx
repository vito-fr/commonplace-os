export type ItemStatus = "inbox" | "triaged" | "active" | "archived" | "retired";

export interface StatusIndicatorProps {
  status: ItemStatus;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const className =
    status === "retired" ? "status-indicator status-indicator--retired" : "status-indicator";

  return (
    <span className={className} aria-label={`status: ${status}`}>
      {status}
    </span>
  );
}
