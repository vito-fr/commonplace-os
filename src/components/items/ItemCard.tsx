import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type SyntheticEvent } from "react";
import { type ItemStatus, type ItemType } from "../atoms";
import { CardActionMenu, CardGlyph, emitCardActionSurfaceOpen, useCardActionMenu } from "./CardActions";
import { CardMediaImage } from "./CardMediaImage";
import { PdfCanvasPreview } from "./PdfCanvasPreview";
import { VideoCard } from "./VideoCard";
import { downloadArchiveFile } from "../../data/archiveDownload";
import { ActionHint } from "../ui/ActionHint";
import { useCardFrameTagMotion } from "./useCardFrameTagMotion";

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
  dominantColors?: string[] | null;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
};

export type CardMediaLoading = "eager" | "lazy";
export type CardMediaFetchPriority = "high" | "low" | "auto";

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
  videoDurationMs?: number | null;
  ogImageUrl?: string | null;
  ogTitle?: string | null;
  assetFileUrl?: string | null;
  assetMimeType?: string | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  videoPosterUrl?: string | null;
  dominantColors?: string[] | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  aspectRatio?: number | null;
  mediaPreview?: ItemMediaPreview | null;
  mediaFetchPriority?: CardMediaFetchPriority;
  mediaLoading?: CardMediaLoading;
  measuredAspectRatio?: number | null;
  variant?: "gallery" | "masonry";
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
  onDelete?: (id: string) => Promise<void> | void;
  onMediaAspectRatio?: (id: string, aspectRatio: number, sourceUrl: string | null) => void;
  onNavigate?: (id: string) => void;
  onSelectToggle?: (id: string) => void;
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
  videoDurationMs = null,
  ogImageUrl = null,
  ogTitle = null,
  assetFileUrl = null,
  assetMimeType = null,
  previewUrl = null,
  thumbnailUrl = null,
  videoPosterUrl = null,
  dominantColors = null,
  imageWidth = null,
  imageHeight = null,
  aspectRatio = null,
  mediaPreview = null,
  mediaFetchPriority = "auto",
  mediaLoading = "lazy",
  measuredAspectRatio = null,
  variant = "gallery",
  hasPendingAIAnnotations = false,
  rightsStatus = null,
  isSelected = false,
  isCollectionPickerOpen = false,
  detailHref,
  activeFilters,
  onAddToCollection,
  onDelete,
  onMediaAspectRatio,
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
    variant === "masonry" ? "item-card--masonry" : "",
    isSelected ? "item-card--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const itemHref = detailHref ?? `/items/${encodeURIComponent(id)}`;
  const primaryLabel = getPrimaryLabel({ type, title, url, ogTitle });
  const ariaLabel = `Open ${primaryLabel}`;
  const relativeAddedTime = formatAddedTime(createdAt);
  const isPdf = type === "link" && linkContentType === "pdf";
  const [isShareIslandOpen, setIsShareIslandOpen] = useState(false);
  const [copiedShareAction, setCopiedShareAction] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const actionMenu = useCardActionMenu({
    id: `item:${id}`,
    onClose: () => {
      setIsShareIslandOpen(false);
      setIsDeleteConfirming(false);
      setMenuError(null);
    },
  });
  const mediaSourceSignature = [
    id,
    mediaPreview?.thumbnailUrl,
    thumbnailUrl,
    imageUrl,
    mediaPreview?.imageUrl,
    mediaPreview?.previewUrl,
    previewUrl,
    ogImageUrl,
    mediaPreview?.ogImageUrl,
    mediaPreview?.videoPosterUrl,
    videoPosterUrl,
    mediaPreview?.assetFileUrl,
    assetFileUrl,
    assetMimeType,
    videoDurationMs ?? "",
    url,
  ].join("|");
  const [failedMediaUrls, setFailedMediaUrls] = useState<string[]>([]);

  useEffect(() => {
    setFailedMediaUrls([]);
  }, [mediaSourceSignature]);

  const markMediaUrlFailed = useCallback((failedUrl: string) => {
    setFailedMediaUrls((currentUrls) =>
      currentUrls.includes(failedUrl) ? currentUrls : [...currentUrls, failedUrl],
    );
  }, []);

  const resolvedImageUrl = getFirstAvailableMediaUrl(
    [
      mediaPreview?.thumbnailUrl,
      thumbnailUrl,
      imageUrl,
      mediaPreview?.imageUrl,
      mediaPreview?.previewUrl,
      previewUrl,
    ],
    failedMediaUrls,
  );
  const resolvedOgImageUrl = getFirstAvailableMediaUrl(
    [
      ogImageUrl,
      mediaPreview?.ogImageUrl,
      mediaPreview?.videoPosterUrl,
      videoPosterUrl,
      mediaPreview?.thumbnailUrl,
      previewUrl,
      thumbnailUrl,
    ],
    failedMediaUrls,
  );
  const resolvedVideoPosterUrl = getFirstAvailableMediaUrl(
    [
      videoPosterUrl,
      mediaPreview?.videoPosterUrl,
      thumbnailUrl,
      mediaPreview?.thumbnailUrl,
      previewUrl,
      mediaPreview?.previewUrl,
      ogImageUrl,
      mediaPreview?.ogImageUrl,
    ],
    failedMediaUrls,
  );
  const resolvedAssetFileUrl = assetFileUrl ?? mediaPreview?.assetFileUrl ?? null;
  const resolvedAspectRatio = getMediaAspectRatio({
    aspectRatio,
    height: imageHeight,
    mediaPreview,
    measuredAspectRatio,
    width: imageWidth,
  });
  const isRemoteImageReference = type === "link" && isDirectImageUrl(url);
  const directRemoteImageUrl = isRemoteImageReference && url && !failedMediaUrls.includes(url) ? url : null;
  const masonryPreviewImageUrl =
    type === "image"
      ? resolvedImageUrl
      : type === "video"
        ? resolvedVideoPosterUrl
        : linkContentType === "pdf"
          ? null
          : resolvedOgImageUrl || directRemoteImageUrl;
  const masonryImageRatioState = variant === "masonry" ? (resolvedAspectRatio ? "reserved" : "fallback") : undefined;
  const masonryAspectRatio =
    variant === "masonry"
      ? masonryImageRatioState === "reserved" && resolvedAspectRatio
        ? `${resolvedAspectRatio} / 1`
        : masonryImageRatioState === "fallback" || masonryPreviewImageUrl
          ? getMasonryFallbackRatio({
              captionText,
              linkContentType,
              noteParagraph,
              ogImageUrl: resolvedOgImageUrl,
              type,
            })
          : null
      : null;
  const contentStyle =
    masonryAspectRatio
      ? ({ "--item-media-ratio": masonryAspectRatio } as CSSProperties)
      : undefined;
  const downloadUrl = resolvedAssetFileUrl ?? resolvedImageUrl;
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

  const frameTagsRef = useRef<HTMLSpanElement | null>(null);
  const [isFrameTagSurfaceActive, setIsFrameTagSurfaceActive] = useState(false);
  const frameTagSignature = frameTags.map((item) => `${item.key}:${item.label}:${item.tone ?? ""}`).join("|");

  useCardFrameTagMotion(
    frameTagsRef,
    isFrameTagSurfaceActive || actionMenu.isOpen || isCollectionPickerOpen,
    frameTagSignature,
  );

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
    emitCardActionSurfaceOpen(`item:${id}`, "collection");
    actionMenu.close();
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
  const downloadItem = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!downloadUrl) {
      return;
    }

    const downloaded = await downloadArchiveFile({
      filename: getDownloadFilename(downloadUrl, primaryLabel, type, linkContentType),
      url: downloadUrl,
    });
    setMenuError(downloaded ? null : "Download failed");
    if (downloaded) {
      actionMenu.close();
    }
  };
  const openShareIsland = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setCopiedShareAction(null);
    setIsDeleteConfirming(false);
    setIsShareIslandOpen((currentlyOpen) => !currentlyOpen);
  };
  const deleteItem = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!onDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setMenuError(null);

    try {
      await onDelete(id);
      actionMenu.close();
    } catch {
      setMenuError("Delete failed");
    } finally {
      setIsDeleting(false);
    }
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
  const reportMediaAspectRatio = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      if (variant !== "masonry" || !onMediaAspectRatio) {
        return;
      }

      const image = event.currentTarget;
      const ratio = ratioFromDimensions(image.naturalWidth, image.naturalHeight);
      if (!ratio) {
        return;
      }

      onMediaAspectRatio(id, Math.round(ratio * 1000) / 1000, image.currentSrc || image.src || null);
    },
    [id, onMediaAspectRatio, variant],
  );
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
      data-menu-open={actionMenu.isOpen ? "true" : "false"}
      data-type={type}
      onPointerEnter={() => setIsFrameTagSurfaceActive(true)}
      onPointerLeave={(event) => {
        setIsFrameTagSurfaceActive(false);
        actionMenu.close();
        if (event.pointerType === "mouse") {
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLElement && event.currentTarget.contains(activeElement)) {
            activeElement.blur();
          }
        }
      }}
      onFocus={() => setIsFrameTagSurfaceActive(true)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsFrameTagSurfaceActive(false);
        }
      }}
    >
      <a className="item-card__link" href={itemHref} aria-label={ariaLabel} onClick={navigate}>
        {hasPendingAIAnnotations ? <span className="item-card__pending-ai" aria-hidden="true" /> : null}
        <div className="item-card__content" data-ratio={masonryImageRatioState} style={contentStyle}>
          {renderContent(
            type,
            title,
            resolvedImageUrl,
            captionText,
            noteParagraph,
            directRemoteImageUrl,
            linkContentType,
            resolvedAssetFileUrl,
            assetMimeType ?? mediaPreview?.assetMimeType ?? null,
            resolvedOgImageUrl,
            resolvedVideoPosterUrl,
            ogTitle,
            mediaPreview?.dominantColors ?? dominantColors,
            mediaPreview?.width ?? imageWidth,
            mediaPreview?.height ?? imageHeight,
            mediaFetchPriority,
            mediaLoading,
            markMediaUrlFailed,
            reportMediaAspectRatio,
          )}
          <span className="item-card__frame-tags" aria-hidden="true" ref={frameTagsRef}>
            {frameTags.map((item) => (
              <span
                className={`item-card__frame-tag${item.tone === "warning" ? " item-card__frame-tag--warning" : ""}${item.tone === "upload" ? " item-card__frame-tag--upload" : ""}${item.tone === "collection" ? " item-card__frame-tag--collection" : ""}`}
                data-card-frame-tag="true"
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
      <ActionHint className="item-card__select-hint" label={isSelected ? "Deselect" : "Select"} side="right">
        <button
          className="item-card__select"
          type="button"
          aria-label={`${isSelected ? "Deselect" : "Select"} ${primaryLabel}`}
          aria-pressed={isSelected}
          data-press-feedback="true"
          disabled={!onSelectToggle}
          onClick={toggleSelection}
        >
          <span aria-hidden="true" data-press-target="true" />
        </button>
      </ActionHint>
      <span
        className="item-card__actions"
        data-menu-open={actionMenu.isOpen ? "true" : "false"}
        aria-label="card actions"
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            actionMenu.close();
          }
        }}
      >
        <CardActionMenu
          ariaLabel={`More actions for ${primaryLabel}`}
          buttonRef={actionMenu.buttonRef}
          isOpen={actionMenu.isOpen}
          menuRef={actionMenu.menuRef}
          onToggle={actionMenu.toggle}
          tooltipLabel="More actions"
        >
          <button
            className="item-card__menu-action item-card__menu-action--download"
            type="button"
            role="menuitem"
            disabled={!downloadUrl}
            data-press-feedback="true"
            onClick={downloadItem}
          >
            <CardGlyph name="download" className="item-card__menu-icon" />
            <span className="item-card__menu-label">Download</span>
          </button>
          <button
            className="item-card__menu-action item-card__menu-action--share"
            type="button"
            role="menuitem"
            onClick={openShareIsland}
            aria-expanded={isShareIslandOpen}
            data-press-feedback="true"
          >
            <CardGlyph name="share" className="item-card__menu-icon" />
            <span className="item-card__menu-label">Share</span>
          </button>
          <button
            className="item-card__menu-action item-card__menu-action--delete"
            type="button"
            role="menuitem"
            disabled={!onDelete || isDeleting}
            onClick={deleteItem}
            data-confirming={isDeleteConfirming ? "true" : "false"}
            data-press-feedback="true"
          >
            <CardGlyph name="delete" className="item-card__menu-icon" />
            <span className="item-card__menu-label">
              {isDeleting ? "Deleting" : isDeleteConfirming ? "Confirm" : "Delete"}
            </span>
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
          {menuError ? <span className="item-card__menu-status">{menuError}</span> : null}
        </CardActionMenu>
        <ActionHint className="item-card__add-hint" label="Add to collection" side="left">
          <button
            className="item-card__action-cell item-card__action-cell--add"
            type="button"
            onClick={addToCollection}
            aria-label={`Add ${primaryLabel} to collection`}
            aria-expanded={isCollectionPickerOpen}
            data-active={isCollectionPickerOpen ? "true" : "false"}
            data-press-feedback="true"
            disabled={!onAddToCollection}
          >
            <CardGlyph name="add" className="item-card__plus-icon" />
          </button>
        </ActionHint>
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

function getMediaAspectRatio({
  aspectRatio,
  height,
  mediaPreview,
  measuredAspectRatio,
  width,
}: {
  aspectRatio: number | null;
  height: number | null;
  mediaPreview: ItemMediaPreview | null;
  measuredAspectRatio: number | null;
  width: number | null;
}) {
  const ratio =
    mediaPreview?.aspectRatio ??
    aspectRatio ??
    ratioFromDimensions(mediaPreview?.width, mediaPreview?.height) ??
    ratioFromDimensions(width, height) ??
    measuredAspectRatio;

  return Number.isFinite(ratio) && ratio && ratio > 0 ? Math.round(ratio * 1000) / 1000 : null;
}

function getMasonryFallbackRatio({
  captionText,
  linkContentType,
  noteParagraph,
  ogImageUrl,
  type,
}: {
  captionText: string | null;
  linkContentType: string | null;
  noteParagraph: string | null;
  ogImageUrl: string | null;
  type: ItemType;
}) {
  if (type === "caption" || type === "note") {
    const textLength = (type === "caption" ? captionText : noteParagraph)?.length ?? 0;
    if (textLength > 420) {
      return "1 / 1.45";
    }
    if (textLength > 220) {
      return "1 / 1.28";
    }
    return type === "caption" ? "1 / 1.12" : "1 / 1.24";
  }

  if (type === "video") {
    return "16 / 9";
  }
  if (linkContentType === "pdf") {
    return "3 / 4";
  }
  if (linkContentType === "video") {
    return "16 / 9";
  }
  if (ogImageUrl || linkContentType === "website") {
    return "1.2 / 1";
  }

  return "4 / 5";
}

function ratioFromDimensions(width: number | null | undefined, height: number | null | undefined) {
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  return width / height;
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
  directImageUrl: string | null,
  linkContentType: string | null,
  assetFileUrl: string | null,
  assetMimeType: string | null,
  ogImageUrl: string | null,
  videoPosterUrl: string | null,
  ogTitle: string | null,
  dominantColors: string[] | null | undefined,
  width: number | null | undefined,
  height: number | null | undefined,
  mediaFetchPriority: CardMediaFetchPriority,
  mediaLoading: CardMediaLoading,
  onMediaError: (url: string) => void,
  onMediaLoad?: (event: SyntheticEvent<HTMLImageElement>) => void,
) {
  if (type === "image") {
    return imageUrl ? (
      <CardMediaImage
        className="item-card__image"
        src={imageUrl}
        alt={title ?? ""}
        loading={mediaLoading}
        decoding="async"
        fetchPriority={mediaFetchPriority}
        width={width ?? undefined}
        height={height ?? undefined}
        placeholderColors={dominantColors}
        onMediaError={onMediaError}
        onLoad={onMediaLoad}
      />
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

  if (type === "video") {
    return (
      <VideoCard
        src={assetFileUrl}
        posterUrl={videoPosterUrl || ogImageUrl || directImageUrl}
        title={title ?? ogTitle}
        mimeType={assetMimeType}
        width={width ?? undefined}
        height={height ?? undefined}
        placeholderColors={dominantColors}
        loading={mediaLoading}
        fetchPriority={mediaFetchPriority}
        onMediaError={onMediaError}
        onPosterLoad={onMediaLoad}
      />
    );
  }

  const previewImageUrl = imageUrl || ogImageUrl || directImageUrl;

  if (linkContentType === "pdf" && previewImageUrl) {
    return (
      <div className="item-card__link-preview item-card__link-preview--pdf" aria-label="PDF preview" data-preview-kind="pdf">
        <CardMediaImage
          className="item-card__image"
          src={previewImageUrl}
          alt={ogTitle ?? title ?? "PDF preview"}
          loading={mediaLoading}
          decoding="async"
          fetchPriority={mediaFetchPriority}
          width={width ?? undefined}
          height={height ?? undefined}
          placeholderColors={dominantColors}
          onMediaError={onMediaError}
          onLoad={onMediaLoad}
        />
      </div>
    );
  }

  if (linkContentType === "pdf" && assetFileUrl) {
    return (
      <div className="item-card__pdf-preview" aria-label="PDF preview" data-preview-kind="pdf">
        <PdfCanvasPreview src={assetFileUrl} title={ogTitle ?? title ?? "PDF preview"} variant="card" />
      </div>
    );
  }

  const isVideoPreview = linkContentType === "video" || Boolean(assetMimeType?.startsWith("video/"));

  return (
    <div
      className={`item-card__link-preview${isVideoPreview ? " item-card__video-preview" : ""}`}
      aria-label={isVideoPreview ? "Video preview" : undefined}
      data-preview-kind={isVideoPreview ? "video" : undefined}
    >
      {previewImageUrl ? (
        <CardMediaImage
          className="item-card__image"
          src={previewImageUrl}
          alt={ogTitle ?? title ?? ""}
          loading={mediaLoading}
          decoding="async"
          fetchPriority={mediaFetchPriority}
          width={width ?? undefined}
          height={height ?? undefined}
          placeholderColors={dominantColors}
          onMediaError={onMediaError}
          onLoad={onMediaLoad}
        />
      ) : (
        <Placeholder label={isVideoPreview ? "video preview" : "link preview"} />
      )}
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return <div className="item-card__placeholder">{label}</div>;
}

function getFirstAvailableMediaUrl(
  candidates: Array<string | null | undefined>,
  failedUrls: string[],
) {
  return (
    candidates.find(
      (candidate): candidate is string => candidate != null && candidate !== "" && !failedUrls.includes(candidate),
    ) ?? null
  );
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
  const extension = linkContentType === "pdf" ? "pdf" : type === "image" ? "jpg" : type === "video" ? "mp4" : "txt";

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
