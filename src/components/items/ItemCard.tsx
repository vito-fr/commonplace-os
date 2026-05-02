import { Fragment, type MouseEvent, type ReactNode } from "react";
import {
  SourceMark,
  StatusIndicator,
  TypeIndicator,
  UsageBadge,
  type ItemStatus,
  type ItemType,
} from "../atoms";

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
  campaignCoverUrl?: string | null;
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
  campaignCoverUrl = null,
  hasPendingAIAnnotations = false,
  rightsStatus = null,
  isSelected = false,
  detailHref,
  activeFilters,
  onNavigate,
}: ItemCardProps) {
  const isRetired = status === "retired";
  const showRightsMark = rightsStatus === "restricted" || rightsStatus === "expired";
  const hasActiveFilters = Boolean(
    activeFilters?.status ||
      activeFilters?.type ||
      activeFilters?.source ||
      activeFilters?.text?.trim(),
  );
  const showType = hasActiveFilters && activeFilters?.type !== type;
  const showStatus = hasActiveFilters && activeFilters?.status !== status;
  const showSource = hasActiveFilters && activeFilters?.source !== source;
  const ariaLabel = title ? `Open ${title}` : `Open ${type} item ${id}`;
  const cardClassName = [
    "item-card",
    isRetired ? "item-card--retired" : "",
    isSelected ? "item-card--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const itemHref = detailHref ?? `/items/${encodeURIComponent(id)}`;
  const signalItems: Array<{ key: string; node: ReactNode }> = [];

  if (showType) {
    signalItems.push({ key: "type", node: <TypeIndicator type={type} /> });
  }

  if (showStatus || showRightsMark) {
    signalItems.push({
      key: "status",
      node: (
        <span className="item-card__status-cluster">
          {showStatus ? <StatusIndicator status={status} /> : null}
          {showRightsMark ? (
            <span className="item-card__rights-mark" aria-label={`rights: ${rightsStatus}`}>
              rights
            </span>
          ) : null}
        </span>
      ),
    });
  }

  if (showSource) {
    signalItems.push({ key: "source", node: <SourceMark source={source} /> });
  }

  if (usageCount > 0) {
    signalItems.push({ key: "usage", node: <UsageBadge count={usageCount} /> });
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
      aria-label={ariaLabel}
      onClick={navigate}
    >
      {hasPendingAIAnnotations ? <span className="item-card__pending-ai" aria-hidden="true" /> : null}
      <div className="item-card__content">{renderContent(type, title, imageUrl, captionText, noteParagraph, url, ogImageUrl, ogTitle, campaignCoverUrl)}</div>
      {signalItems.length > 0 ? (
        <div className="item-card__signal-row">
          {signalItems.map((item, index) => (
            <Fragment key={item.key}>
              {index > 0 ? <span aria-hidden="true">·</span> : null}
              {item.node}
            </Fragment>
          ))}
        </div>
      ) : null}
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
  campaignCoverUrl: string | null,
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

  if (type === "link") {
    return (
      <div className="item-card__link-preview">
        {ogImageUrl ? <img className="item-card__image" src={ogImageUrl} alt={ogTitle ?? title ?? ""} /> : <Placeholder label="link preview" />}
        {ogTitle ? <p className="item-card__link-title">{ogTitle}</p> : <p className="item-card__link-domain">{getDomain(url)}</p>}
      </div>
    );
  }

  return (
    <div className="item-card__campaign">
      {campaignCoverUrl ? (
        <img className="item-card__image" src={campaignCoverUrl} alt={title ?? ""} />
      ) : (
        <Placeholder label="campaign cover" />
      )}
      {title ? <span className="item-card__campaign-title">{title}</span> : null}
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
