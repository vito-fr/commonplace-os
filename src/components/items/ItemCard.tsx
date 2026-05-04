import { type MouseEvent } from "react";
import { type ItemStatus, type ItemType } from "../atoms";

export type RightsStatus =
  | "unknown"
  | "reference_only"
  | "approved_for_internal_use"
  | "approved_for_external_use"
  | "restricted"
  | "expired";

export interface ItemCardProps {
  id: string;
  type: ItemType;
  status: ItemStatus;
  source: string;
  usageCount: number;
  title?: string | null;
  imageUrl?: string | null;
  captionText?: string | null;
  noteParagraph?: string | null;
  url?: string | null;
  ogImageUrl?: string | null;
  ogTitle?: string | null;
  hasPendingAIAnnotations?: boolean;
  rightsStatus?: RightsStatus | string | null;
  isSelected?: boolean;
  detailHref?: string;
  activeFilters?: {
    status?: ItemStatus;
    type?: ItemType;
    source?: string;
    text?: string;
  };
  onNavigate?: (id: string) => void;
}

export function ItemCard({
  id,
  type,
  status,
  source,
  usageCount,
  title = null,
  imageUrl = null,
  captionText = null,
  noteParagraph = null,
  url = null,
  ogImageUrl = null,
  ogTitle = null,
  hasPendingAIAnnotations = false,
  rightsStatus = null,
  isSelected = false,
  detailHref,
  activeFilters,
  onNavigate,
}: ItemCardProps) {
  const hasActiveFilters = Boolean(
    activeFilters?.status ||
      activeFilters?.type ||
      activeFilters?.source ||
      activeFilters?.text?.trim(),
  );
  const showType = hasActiveFilters && activeFilters?.type !== type;
  const showStatus = hasActiveFilters && activeFilters?.status !== status;
  const showSource = hasActiveFilters && activeFilters?.source !== source;
  const ariaLabel = title ? `Open ${title}` : `Open ${type} ${id}`;
  const cardClassName = [
    "item-card",
    isSelected ? "item-card--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const itemHref = detailHref ?? `/items/${encodeURIComponent(id)}`;
  const primaryLabel = title ?? formatLabel(type);
  const signalItems: Array<{ key: string; label: string; tone?: "warning" | "future" }> = [];

  if (showType) {
    signalItems.push({ key: "type", label: formatLabel(type) });
  }

  if (showStatus) {
    signalItems.push({ key: "status", label: formatLabel(status) });
  }

  if (showSource) {
    signalItems.push({ key: "source", label: formatLabel(source) });
  }

  if (usageCount > 0) {
    signalItems.push({ key: "usage", label: `${usageCount} use${usageCount === 1 ? "" : "s"}` });
  }

  if (hasPendingAIAnnotations) {
    signalItems.push({ key: "ai", label: "ai pending", tone: "warning" });
  }

  if (isRightsWarning(rightsStatus)) {
    signalItems.push({ key: "rights", label: formatLabel(rightsStatus), tone: "warning" });
  }

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !onNavigate ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    onNavigate(id);
  };

  return (
    <a
      className={cardClassName}
      href={itemHref}
      data-type={type}
      aria-label={ariaLabel}
      onClick={navigate}
    >
      {hasPendingAIAnnotations ? <span className="item-card__pending-ai" aria-hidden="true" /> : null}
      <span className="item-card__actions" aria-hidden="true">
        <span className="item-card__action-cell">+</span>
        <span className="item-card__action-cell">...</span>
      </span>
      <div className="item-card__content">{renderContent(type, title, imageUrl, captionText, noteParagraph, url, ogImageUrl, ogTitle)}</div>
      <div className="item-card__pill-row">
        <span className="item-card__pill item-card__pill--primary">{primaryLabel}</span>
        {signalItems.map((item) => (
          <span
            className={`item-card__pill${item.tone === "warning" ? " item-card__pill--warning" : ""}${item.tone === "future" ? " item-card__pill--future" : ""}`}
            key={item.key}
          >
            {item.label}
          </span>
        ))}
      </div>
    </a>
  );
}

function renderContent(
  type: ItemType,
  title: string | null,
  imageUrl: string | null,
  captionText: string | null,
  noteParagraph: string | null,
  url: string | null,
  ogImageUrl: string | null,
  ogTitle: string | null,
) {
  if (type === "image") {
    return imageUrl ? (
      <img className="item-card__image" src={imageUrl} alt={title ?? ""} />
    ) : (
      <Placeholder label="image pending" />
    );
  }

  if (type === "caption") {
    return captionText ? (
      <p className="item-card__text item-card__text--caption">{captionText}</p>
    ) : (
      <Placeholder label="caption pending" />
    );
  }

  if (type === "note") {
    return noteParagraph ? (
      <p className="item-card__text item-card__text--note">{noteParagraph}</p>
    ) : (
      <Placeholder label="note pending" />
    );
  }

  return (
    <div className="item-card__link-preview">
      {ogImageUrl ? <img className="item-card__image" src={ogImageUrl} alt={ogTitle ?? title ?? ""} /> : <Placeholder label="link preview" />}
      {ogTitle ? <p className="item-card__link-title">{ogTitle}</p> : <p className="item-card__link-domain">{getDomain(url)}</p>}
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return <div className="item-card__placeholder">{label}</div>;
}

function getDomain(url: string | null) {
  if (!url) {
    return "link";
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function isRightsWarning(rightsStatus: RightsStatus | string | null | undefined) {
  return rightsStatus === "restricted" || rightsStatus === "expired";
}
