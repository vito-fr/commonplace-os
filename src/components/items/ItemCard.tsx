import { useEffect, useRef, useState, type MouseEvent } from "react";
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

export type ItemMediaPreview = {
  previewUrl?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  ogImageUrl?: string | null;
  videoPosterUrl?: string | null;
  assetFileUrl?: string | null;
  assetMimeType?: string | null;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
};

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
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  videoPosterUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  aspectRatio?: number | null;
  mediaPreview?: ItemMediaPreview | null;
  hasPendingAIAnnotations?: boolean;
  rightsStatus?: RightsStatus | string | null;
  isSelected?: boolean;
  isCollectionPickerOpen?: boolean;
  detailHref?: string;
  activeFilters?: {
    status?: ItemStatus;
    type?: ItemType;
    source?: string;
    text?: string;
  };
  onAddToCollection?: (id: string, anchor: ItemCardActionAnchor) => void;
  onNavigate?: (id: string) => void;
  onSelectToggle?: (id: string) => void;
}

const itemCardSurfaceEvent = "vita:item-card-surface-open";
type ItemCardSurfaceDetail = {
  itemId: string;
  surface: "actions" | "collection";
};

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
  isCollectionPickerOpen = false,
  detailHref,
  activeFilters,
  onAddToCollection,
  onNavigate,
  onSelectToggle,
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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isShareIslandOpen, setIsShareIslandOpen] = useState(false);
  const [copiedShareAction, setCopiedShareAction] = useState<string | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const downloadUrl = assetFileUrl ?? imageUrl;
  const frameTags: Array<{
    key: string;
    label: string;
    source?: string;
    tone?: "warning" | "upload" | "collection";
  }> = [
    {
      key: "source",
      label: formatLabel(source),
      source,
      tone: source === "local" ? "upload" : undefined,
    },
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

  useEffect(() => {
    if (!isMoreMenuOpen) {
      return;
    }

    const onPointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (moreButtonRef.current?.contains(target) || moreMenuRef.current?.contains(target)) {
        return;
      }

      setIsMoreMenuOpen(false);
      setIsShareIslandOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMoreMenuOpen(false);
        setIsShareIslandOpen(false);
        moreButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMoreMenuOpen]);

  useEffect(() => {
    const onSurfaceOpen = (event: Event) => {
      const detail = (event as CustomEvent<ItemCardSurfaceDetail>).detail;
      if (!detail || detail.itemId === id && detail.surface === "actions") {
        return;
      }

      setIsMoreMenuOpen(false);
      setIsShareIslandOpen(false);
    };

    window.addEventListener(itemCardSurfaceEvent, onSurfaceOpen);
    return () => window.removeEventListener(itemCardSurfaceEvent, onSurfaceOpen);
  }, [id]);

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
  const toggleSelection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectToggle?.(id);
  };
  const toggleMoreMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    setIsMoreMenuOpen((currentlyOpen) => {
      const nextOpen = !currentlyOpen;
      if (nextOpen) {
        window.dispatchEvent(new CustomEvent<ItemCardSurfaceDetail>(itemCardSurfaceEvent, {
          detail: { itemId: id, surface: "actions" },
        }));
      } else {
        setIsShareIslandOpen(false);
      }
      return nextOpen;
    });
  };
  const downloadItem = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!downloadUrl || typeof document === "undefined") {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = getDownloadFilename(downloadUrl, primaryLabel, type, linkContentType);
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setIsMoreMenuOpen(false);
  };
  const editItem = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsMoreMenuOpen(false);

    if (onNavigate) {
      onNavigate(id);
      return;
    }

    if (typeof window !== "undefined") {
      window.location.assign(itemHref);
    }
  };
  const openShareIsland = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setCopiedShareAction(null);
    setIsShareIslandOpen((currentlyOpen) => !currentlyOpen);
  };
  const copyShareValue = async (shareAction: string, value: string | null) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedShareAction(shareAction);
    } catch {
      setCopiedShareAction("copy failed");
    }
  };
  const openSourceUrl = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!url || typeof window === "undefined") {
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };
  const shareUrl = getAbsoluteItemUrl(itemHref);
  const markdownReference = `[${primaryLabel}](${shareUrl})`;

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
                data-source={item.source}
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
      <button
        className="item-card__select"
        type="button"
        aria-label={`${isSelected ? "Deselect" : "Select"} ${primaryLabel}`}
        aria-pressed={isSelected}
        disabled={!onSelectToggle}
        onClick={toggleSelection}
      >
        <span aria-hidden="true" />
      </button>
      <span
        className="item-card__actions"
        aria-label="card actions"
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            setIsMoreMenuOpen(false);
            setIsShareIslandOpen(false);
          }
        }}
      >
        <span className="item-card__more-control">
          <button
            className="item-card__action-cell item-card__action-cell--more"
            type="button"
            onClick={toggleMoreMenu}
            aria-label={`More actions for ${primaryLabel}`}
            aria-haspopup="menu"
            aria-expanded={isMoreMenuOpen}
            ref={moreButtonRef}
          >
            <span className="item-card__dots-icon" />
          </button>
          {isMoreMenuOpen ? (
            <div className="item-card__more-menu" role="menu" ref={moreMenuRef}>
              <button
                className="item-card__more-menu-item"
                type="button"
                role="menuitem"
                disabled={!downloadUrl}
                onClick={downloadItem}
              >
                Download
              </button>
              <button className="item-card__more-menu-item" type="button" role="menuitem" onClick={editItem}>
                Edit
              </button>
              <button
                className="item-card__more-menu-item"
                type="button"
                role="menuitem"
                onClick={openShareIsland}
                aria-expanded={isShareIslandOpen}
              >
                Share
              </button>
              {isShareIslandOpen ? (
                <div className="item-card__share-island" role="group" aria-label="share item">
                  <button type="button" onClick={() => void copyShareValue("Item link", shareUrl)}>
                    Copy item link
                  </button>
                  {url ? (
                    <>
                      <button type="button" onClick={() => void copyShareValue("Source URL", url)}>
                        Copy source URL
                      </button>
                      <button type="button" onClick={openSourceUrl}>
                        Open source
                      </button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => void copyShareValue("Title", primaryLabel)}>
                    Copy title
                  </button>
                  <button type="button" onClick={() => void copyShareValue("Markdown", markdownReference)}>
                    Copy markdown
                  </button>
                  {downloadUrl ? (
                    <button type="button" onClick={() => void copyShareValue("File URL", downloadUrl)}>
                      Copy file URL
                    </button>
                  ) : null}
                  {copiedShareAction ? <span>{copiedShareAction === "copy failed" ? "Copy failed" : `${copiedShareAction} copied`}</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </span>
        <button
          className="item-card__action-cell item-card__action-cell--add"
          type="button"
          onClick={addToCollection}
          aria-label={`Add ${primaryLabel} to collection`}
          aria-expanded={isCollectionPickerOpen}
          data-active={isCollectionPickerOpen ? "true" : "false"}
          disabled={!onAddToCollection}
        >
          <span className="item-card__plus-icon" aria-hidden="true" />
        </button>
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
          scrolling="no"
        />
      </div>
    );
  }

  const previewImageUrl = ogImageUrl || (isDirectImageUrl(url) ? url : null);

  return (
    <div className="item-card__link-preview">
      {previewImageUrl ? <img className="item-card__image" src={previewImageUrl} alt={ogTitle ?? title ?? ""} /> : <Placeholder label="link preview" />}
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
  searchParams.set("surface", "card");
  return `/pdf-preview?${searchParams.toString()}`;
}

function getAbsoluteItemUrl(itemHref: string) {
  if (typeof window === "undefined") {
    return itemHref;
  }

  return new URL(itemHref, window.location.origin).toString();
}

function getDownloadFilename(url: string, primaryLabel: string, type: ItemType, linkContentType: string | null) {
  const fromUrl = getFilenameFromUrl(url);
  if (fromUrl) {
    return fromUrl;
  }

  const label = primaryLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const extension = linkContentType === "pdf" ? "pdf" : type === "image" ? "jpg" : "txt";

  return `${label || "archive-item"}.${extension}`;
}

function getFilenameFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const filename = decodeURIComponent(parsedUrl.pathname.split("/").filter(Boolean).at(-1) ?? "");

    return filename.includes(".") ? filename : null;
  } catch {
    return null;
  }
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

function isDirectImageUrl(url: string | null) {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname.toLowerCase();

    return (
      parsedUrl.hostname === "i.pinimg.com" ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".png") ||
      path.endsWith(".webp") ||
      path.endsWith(".gif") ||
      path.endsWith(".avif")
    );
  } catch {
    return false;
  }
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function isRightsWarning(rightsStatus: RightsStatus | string | null | undefined) {
  return rightsStatus === "restricted" || rightsStatus === "expired";
}
