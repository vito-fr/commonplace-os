import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { CardActionMenu, CardGlyph, useCardActionMenu } from "./CardActions";
import { CardMediaImage } from "./CardMediaImage";
import { ActionHint } from "../ui/ActionHint";

export type CollectionCardModel = {
  id: string;
  name: string;
  description: string | null;
  createdAt?: string | null;
  pieceCount: number;
  kindSummary: string;
  lastUpdatedAt: string;
  previewItems: CollectionCardPreviewItem[];
  href?: string;
  onConnect?: (collectionId: string) => void;
  onCopy?: (collectionId: string) => Promise<void> | void;
  onDelete?: (collectionId: string) => Promise<void> | void;
  onDownload?: (collectionId: string) => void;
  onEdit?: (collectionId: string) => void;
  onImportInto?: (collectionId: string) => void;
  onNavigate?: (collectionId: string) => void;
};

export type CollectionCardPreviewItem = {
  id: string;
  title?: string | null;
  kind: string;
  format?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  imageUrl?: string | null;
  ogImageUrl?: string | null;
  videoPosterUrl?: string | null;
  dominantColors?: string[] | null;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
  textPreview?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
};

export type CollectionCardProps = {
  collection: CollectionCardModel;
  mediaFetchPriority?: "high" | "low" | "auto";
  mediaLoading?: "eager" | "lazy";
};

const maxCollectionTitleLength = 50;

export function CollectionCard({ collection, mediaFetchPriority = "auto", mediaLoading = "lazy" }: CollectionCardProps) {
  const href = collection.href ?? `/collections/${encodeURIComponent(collection.id)}`;
  const editHref = `${href}#collection-title`;
  const displayTitle = formatCollectionTitle(collection.name);
  const relativeAddedTime = formatAddedTime(collection.createdAt ?? null);
  const cardClassName = ["collection-card", relativeAddedTime ? "collection-card--has-added-time" : ""]
    .filter(Boolean)
    .join(" ");
  const [copied, setCopied] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const previewSourceSignature = collection.previewItems
    .map((item) => [item.id, item.thumbnailUrl, item.imageUrl, item.ogImageUrl, item.videoPosterUrl].join("|"))
    .join(";");
  const [failedPreviewUrls, setFailedPreviewUrls] = useState<string[]>([]);
  const actionMenu = useCardActionMenu({ id: `collection:${collection.id}` });

  useEffect(() => {
    setFailedPreviewUrls([]);
  }, [collection.id, previewSourceSignature]);

  const markPreviewUrlFailed = useCallback((failedUrl: string) => {
    setFailedPreviewUrls((currentUrls) =>
      currentUrls.includes(failedUrl) ? currentUrls : [...currentUrls, failedUrl],
    );
  }, []);

  const openCollectionTarget = (event: MouseEvent<HTMLAnchorElement>, targetId?: string) => {
    if (
      !collection.onNavigate ||
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
    collection.onNavigate(collection.id);

    if (targetId && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.history.replaceState(null, "", `${href}#${targetId}`);
        window.setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ block: "center", behavior: "smooth" });
          if (targetId === "collection-title") {
            const input = document.querySelector<HTMLInputElement>("#collection-title input");
            input?.focus();
            input?.select();
          }
        }, 80);
      });
    }
  };
  const openCollection = (event: MouseEvent<HTMLAnchorElement>) => {
    openCollectionTarget(event);
  };
  const copyLink = async () => {
    const link = typeof window === "undefined" ? href : new URL(href, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  const copyCollectionLink = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (collection.onCopy) {
      void collection.onCopy(collection.id);
      actionMenu.close();
      return;
    }

    void copyLink();
  };
  const editCollection = (event: MouseEvent<HTMLAnchorElement>) => {
    if (collection.onEdit) {
      event.preventDefault();
      event.stopPropagation();
      collection.onEdit(collection.id);
      actionMenu.close();
      return;
    }

    openCollectionTarget(event, "collection-title");
  };
  const connectCollection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    collection.onConnect?.(collection.id);
    actionMenu.close();
  };
  const downloadCollection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    collection.onDownload?.(collection.id);
    actionMenu.close();
  };
  const deleteCollection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDeleteConfirming) {
      setIsDeleteConfirming(true);
      return;
    }

    void collection.onDelete?.(collection.id);
    setIsDeleteConfirming(false);
    actionMenu.close();
  };

  return (
    <article
      className={cardClassName}
      data-menu-open={actionMenu.isOpen ? "true" : "false"}
      onPointerLeave={(event) => {
        actionMenu.close();
        if (event.pointerType === "mouse") {
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLElement && event.currentTarget.contains(activeElement)) {
            activeElement.blur();
          }
        }
      }}
    >
      <a className="collection-card__link" href={href} onClick={openCollection} aria-label={`Open ${collection.name}`}>
        <div className="collection-card__cover" aria-hidden="true" data-empty={collection.previewItems.length === 0 ? "true" : "false"}>
          {renderCoverTiles(collection, mediaLoading, mediaFetchPriority, failedPreviewUrls, markPreviewUrlFailed)}
        </div>
        <div className="collection-card__body">
          <h2 title={collection.name}>
            <span className="collection-card__title-text">{displayTitle}</span>
            {relativeAddedTime ? <span className="collection-card__title-time">{relativeAddedTime}</span> : null}
          </h2>
          <span className="collection-card__count">{formatPieceCount(collection.pieceCount)}</span>
        </div>
      </a>
      <div
        className="collection-card__actions"
        data-menu-open={actionMenu.isOpen ? "true" : "false"}
        aria-label={`${collection.name} collection actions`}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            actionMenu.close();
          }
        }}
      >
        <ActionHint className="item-card__add-hint collection-card__add-hint" label="Connect collection" shortcut="C" side="left">
          <button
            className="item-card__action-cell item-card__action-cell--add collection-card__action-cell collection-card__action-cell--add"
            type="button"
            disabled={!collection.onConnect}
            onClick={connectCollection}
            aria-label={`Connect ${collection.name} to another collection`}
            data-press-feedback="true"
          >
            <CardGlyph name="add" className="item-card__plus-icon" />
          </button>
        </ActionHint>
        <CardActionMenu
          ariaLabel={`More actions for ${collection.name}`}
          buttonClassName="collection-card__action-cell collection-card__action-cell--more"
          buttonRef={actionMenu.buttonRef}
          controlClassName="collection-card__more-control"
          isOpen={actionMenu.isOpen}
          menuClassName="collection-card__more-menu"
          menuRef={actionMenu.menuRef}
          onToggle={actionMenu.toggle}
          tooltipLabel="More actions"
        >
          <a
            className="item-card__menu-action item-card__menu-action--edit collection-card__more-menu-link"
            href={editHref}
            onClick={editCollection}
            role="menuitem"
            data-press-feedback="true"
          >
            <CardGlyph name="edit" className="item-card__menu-icon" />
            <span className="item-card__menu-label">Edit</span>
          </a>
          <button
            className="item-card__menu-action item-card__menu-action--copy"
            type="button"
            role="menuitem"
            onClick={copyCollectionLink}
            data-press-feedback="true"
          >
            <CardGlyph name="copy" className="item-card__menu-icon" />
            <span className="item-card__menu-label">{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            className="item-card__menu-action item-card__menu-action--download"
            type="button"
            role="menuitem"
            disabled={!collection.onDownload}
            onClick={downloadCollection}
            data-press-feedback="true"
          >
            <CardGlyph name="download" className="item-card__menu-icon" />
            <span className="item-card__menu-label">Download</span>
          </button>
          <button
            className="item-card__menu-action item-card__menu-action--delete"
            type="button"
            role="menuitem"
            disabled={!collection.onDelete}
            onClick={deleteCollection}
            data-confirming={isDeleteConfirming ? "true" : "false"}
            data-press-feedback="true"
          >
            <CardGlyph name="delete" className="item-card__menu-icon" />
            <span className="item-card__menu-label">{isDeleteConfirming ? "Confirm" : "Delete"}</span>
          </button>
        </CardActionMenu>
      </div>
    </article>
  );
}

export function NewCollectionCard({ disabled = false, onCreate }: { disabled?: boolean; onCreate: () => void }) {
  return (
    <article className="collection-card collection-card--create">
      <ActionHint label="Create collection" side="top">
        <button className="collection-card__create-button" disabled={disabled} type="button" onClick={onCreate} data-press-feedback="true">
          <div className="collection-card__cover collection-card__cover--create" aria-hidden="true" data-empty="true">
            <span className="collection-card__create-affordance">
              <span className="collection-card__create-icon">
                <CardGlyph name="add" className="collection-card__create-glyph" />
              </span>
              <small>create set</small>
            </span>
          </div>
          <div className="collection-card__body">
            <h2>New Collection</h2>
            <span className="collection-card__count">Create</span>
          </div>
        </button>
      </ActionHint>
    </article>
  );
}

function renderCoverTiles(
  collection: CollectionCardModel,
  mediaLoading: "eager" | "lazy",
  mediaFetchPriority: "high" | "low" | "auto",
  failedPreviewUrls: string[],
  onMediaError: (url: string) => void,
) {
  if (collection.previewItems.length === 0) {
    return (
      <span className="collection-card__cover-empty">
        <strong>{getCoverLabel(collection.name)}</strong>
        <small>empty collection</small>
      </span>
    );
  }

  const slots = collection.previewItems.slice(0, 4);
  while (slots.length < 4) {
    slots.push({
      id: `empty-slot-${slots.length}`,
      kind: "empty",
      textPreview: "",
    });
  }

  return slots.map((item, index) => {
    const imageUrl = getFirstAvailablePreviewUrl(
      [item.thumbnailUrl, item.imageUrl, item.ogImageUrl, item.videoPosterUrl],
      failedPreviewUrls,
    );
    const tileLoading = index === 0 ? mediaLoading : "lazy";
    const tileFetchPriority = index === 0 ? mediaFetchPriority : "auto";

    if (imageUrl) {
      return (
        <span className="collection-card__preview-tile collection-card__preview-tile--visual" key={`${item.id}:${index}`}>
          <CardMediaImage
            src={imageUrl}
            alt=""
            loading={tileLoading}
            decoding="async"
            fetchPriority={tileFetchPriority}
            width={item.width ?? undefined}
            height={item.height ?? undefined}
            placeholderColors={item.dominantColors}
            onMediaError={onMediaError}
          />
        </span>
      );
    }

    if (item.kind === "empty") {
      return <span className="collection-card__preview-tile collection-card__preview-tile--ghost" key={item.id} />;
    }

    const previewText = getPreviewText(item);

    return (
      <span
        className="collection-card__preview-tile collection-card__preview-tile--text"
        data-kind={item.format || item.kind}
        key={`${item.id}:${index}`}
      >
        {previewText ? <small>{previewText}</small> : null}
      </span>
    );
  });
}

function getPreviewText(item: CollectionCardPreviewItem) {
  const text = item.title || item.textPreview || getDomain(item.sourceUrl) || "";
  return text.trim();
}

function getCoverLabel(name: string) {
  const letters = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return letters || "C";
}

function getFirstAvailablePreviewUrl(
  candidates: Array<string | null | undefined>,
  failedUrls: string[],
) {
  return (
    candidates.find(
      (candidate): candidate is string => candidate != null && candidate !== "" && !failedUrls.includes(candidate),
    ) ?? null
  );
}

function getDomain(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatPieceCount(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
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

function formatCollectionTitle(name: string) {
  const normalizedName = name.trim();
  if (normalizedName.length <= maxCollectionTitleLength) {
    return normalizedName;
  }

  return `${normalizedName.slice(0, maxCollectionTitleLength - 1).trimEnd()}…`;
}
