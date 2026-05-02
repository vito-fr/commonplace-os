export type ItemStatus = "active" | "archived";

export interface StatusIndicatorProps {
  status: ItemStatus;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const className =
    status === "archived" ? "status-indicator status-indicator--archived" : "status-indicator";

  return (
    <span className={className} aria-label={`status: ${status}`}>
      {status}
    </span>
  );
}
