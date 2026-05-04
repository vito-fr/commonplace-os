import { type MouseEvent } from "react";
import { type ItemStatus, type ItemType } from "../atoms";

export type ItemCardActionAnchor = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

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
  collectionCount?: number;
  createdAt?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  captionText?: string | null;
  noteParagraph?: string | null;
  url?: string | null;
  linkContentType?: string | null;
  ogImageUrl?: string | null;
  ogTitle?: string | null;
  assetFileUrl?: string | null;
  assetMimeType?: string | null;
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
  onAddToCollection?: (id: string, anchor: ItemCardActionAnchor) => void;
  onNavigate?: (id: string) => void;
}

export function ItemCard({
  id,
  type,
  status,
  source,
  usageCount,
  collectionCount = 0,
  createdAt = null,
  title = null,
  imageUrl = null,
  captionText = null,
  noteParagraph = null,
  url = null,
  linkContentType = null,
  ogImageUrl = null,
  ogTitle = null,
  assetFileUrl = null,
  hasPendingAIAnnotations = false,
  rightsStatus = null,
  isSelected = false,
  detailHref,
  activeFilters,
  onAddToCollection,
  onNavigate,
}: ItemCardProps) {
  const hasActiveFilters = Boolean(
    activeFilters?.status ||
      activeFilters?.type ||
      activeFilters?.source ||
      activeFilters?.text?.trim(),
  );
  const showStatus = hasActiveFilters && activeFilters?.status !== status;
  const cardClassName = [
    "item-card",
    isSelected ? "item-card--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const itemHref = detailHref ?? `/items/${encodeURIComponent(id)}`;
  const primaryLabel = getPrimaryLabel({ type, title, url, ogTitle });
  const ariaLabel = `Open ${primaryLabel}`;
  const relativeAddedTime = formatAddedTime(createdAt);
  const isPdf = type === "link" && linkContentType === "pdf";
  const frameTags: Array<{ key: string; label: string; tone?: "warning" | "upload" | "collection" }> = [
    { key: "source", label: formatLabel(source), tone: source === "local" ? "upload" : undefined },
    {
      key: "type",
      label: isPdf ? "pdf" : formatLabel(type),
      tone: (type === "image" || isPdf) && source === "local" ? "upload" : undefined,
    },
  ];

  if (showStatus) {
    frameTags.push({ key: "status", label: formatLabel(status) });
  }

  if (usageCount > 0) {
    frameTags.push({ key: "usage", label: `${usageCount} use${usageCount === 1 ? "" : "s"}` });
  }

  if (collectionCount > 0) {
    frameTags.push({
      key: "collections",
      label: `${collectionCount} collection${collectionCount === 1 ? "" : "s"}`,
      tone: "collection",
    });
  }

  if (hasPendingAIAnnotations) {
    frameTags.push({ key: "ai", label: "ai pending", tone: "warning" });
  }

  if (isRightsWarning(rightsStatus)) {
    frameTags.push({ key: "rights", label: formatLabel(rightsStatus), tone: "warning" });
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
  const addToCollection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    onAddToCollection?.(id, {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    });
  };

  const resolvedCardClassName = [
    cardClassName,
    relativeAddedTime ? "item-card--has-added-time" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={resolvedCardClassName}
      data-type={type}
    >
      <a className="item-card__link" href={itemHref} aria-label={ariaLabel} onClick={navigate}>
        {hasPendingAIAnnotations ? <span className="item-card__pending-ai" aria-hidden="true" /> : null}
        <div className="item-card__content">
          {renderContent(type, title, imageUrl, captionText, noteParagraph, url, linkContentType, assetFileUrl, ogImageUrl, ogTitle)}
          <span className="item-card__frame-tags" aria-hidden="true">
            {frameTags.map((item) => (
              <span
                className={`item-card__frame-tag${item.tone === "warning" ? " item-card__frame-tag--warning" : ""}${item.tone === "upload" ? " item-card__frame-tag--upload" : ""}${item.tone === "collection" ? " item-card__frame-tag--collection" : ""}`}
                key={item.key}
              >
                {item.label}
              </span>
            ))}
          </span>
        </div>
        <span className="item-card__label" title={primaryLabel}>
          <span className="item-card__label-text">{primaryLabel}</span>
          {relativeAddedTime ? <span className="item-card__label-time">{relativeAddedTime}</span> : null}
        </span>
      </a>
      <span className="item-card__actions" aria-label="card actions">
        <button
          className="item-card__action-cell item-card__action-cell--add"
          type="button"
          onClick={addToCollection}
          aria-label={`Add ${primaryLabel} to collection`}
          disabled={!onAddToCollection}
        >
          <span className="item-card__plus-icon" aria-hidden="true" />
        </button>
        <span className="item-card__action-cell item-card__action-cell--more" aria-hidden="true">
          <span className="item-card__dots-icon" />
        </span>
      </span>
    </article>
  );
}

function getPrimaryLabel({
  ogTitle,
  title,
  type,
  url,
}: {
  ogTitle: string | null;
  title: string | null;
  type: ItemType;
  url: string | null;
}) {
  if (title) {
    return title;
  }

  if (ogTitle) {
    return ogTitle;
  }

  if (type === "link") {
    return getDomain(url);
  }

  return formatLabel(type);
}

function formatAddedTime(createdAt: string | null) {
  if (!createdAt) {
    return null;
  }

  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const elapsedSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (elapsedSeconds >= seconds) {
      const value = Math.floor(elapsedSeconds / seconds);
      return `added ${value} ${unit}${value === 1 ? "" : "s"} ago`;
    }
  }

  return "added just now";
}

function renderContent(
  type: ItemType,
  title: string | null,
  imageUrl: string | null,
  captionText: string | null,
  noteParagraph: string | null,
  url: string | null,
  linkContentType: string | null,
  assetFileUrl: string | null,
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

  if (linkContentType === "pdf" && assetFileUrl) {
    const previewUrl = buildPdfPreviewUrl(assetFileUrl, title ?? ogTitle ?? "PDF preview");

    return (
      <div className="item-card__pdf-preview" aria-label="PDF preview">
        <iframe
          className="item-card__pdf-frame"
          src={previewUrl}
          title={title ?? ogTitle ?? "PDF preview"}
          tabIndex={-1}
        />
      </div>
    );
  }

  return (
    <div className="item-card__link-preview">
      {ogImageUrl ? <img className="item-card__image" src={ogImageUrl} alt={ogTitle ?? title ?? ""} /> : <Placeholder label="link preview" />}
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return <div className="item-card__placeholder">{label}</div>;
}

function buildPdfPreviewUrl(src: string, name: string) {
  const searchParams = new URLSearchParams();
  searchParams.set("src", src);
  searchParams.set("name", name);
  return `/pdf-preview?${searchParams.toString()}`;
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
