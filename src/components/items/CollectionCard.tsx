import { useState, type MouseEvent } from "react";
import { CardActionMenu, useCardActionMenu } from "./CardActions";

export type CollectionCardModel = {
  id: string;
  name: string;
  description: string | null;
  pieceCount: number;
  kindSummary: string;
  lastUpdatedAt: string;
  previewItems: CollectionCardPreviewItem[];
  href?: string;
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
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
  textPreview?: string | null;
  sourceUrl?: string | null;
  source?: string | null;
};

export type CollectionCardProps = {
  collection: CollectionCardModel;
};

const maxCollectionTitleLength = 50;

export function CollectionCard({ collection }: CollectionCardProps) {
  const href = collection.href ?? `/collections/${encodeURIComponent(collection.id)}`;
  const addItemsHref = `${href}#add-to-collection`;
  const editHref = `${href}#collection-title`;
  const displayTitle = formatCollectionTitle(collection.name);
  const [copied, setCopied] = useState(false);
  const actionMenu = useCardActionMenu({ id: `collection:${collection.id}` });

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
    void copyLink();
  };

  return (
    <article className="collection-card" onMouseLeave={() => actionMenu.close()}>
      <a className="collection-card__link" href={href} onClick={openCollection} aria-label={`Open ${collection.name}`}>
        <div className="collection-card__cover" aria-hidden="true" data-empty={collection.previewItems.length === 0 ? "true" : "false"}>
          {renderCoverTiles(collection)}
        </div>
        <div className="collection-card__body">
          <h2 title={collection.name}>{displayTitle}</h2>
          <span className="collection-card__count">{formatPieceCount(collection.pieceCount)}</span>
        </div>
      </a>
      <div
        className="collection-card__actions"
        aria-label={`${collection.name} collection actions`}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
            actionMenu.close();
          }
        }}
      >
        <CardActionMenu
          ariaLabel={`More actions for ${collection.name}`}
          buttonClassName="collection-card__action-cell collection-card__action-cell--more"
          buttonRef={actionMenu.buttonRef}
          controlClassName="collection-card__more-control"
          isOpen={actionMenu.isOpen}
          menuClassName="collection-card__more-menu"
          menuRef={actionMenu.menuRef}
          onToggle={actionMenu.toggle}
        >
          <a className="item-card__more-menu-item collection-card__more-menu-link" href={href} onClick={openCollection} role="menuitem">
            Open collection
          </a>
          <a
            className="item-card__more-menu-item collection-card__more-menu-link"
            href={addItemsHref}
            onClick={(event) => openCollectionTarget(event, "add-to-collection")}
            role="menuitem"
          >
            Add files or note
          </a>
          <a
            className="item-card__more-menu-item collection-card__more-menu-link"
            href={editHref}
            onClick={(event) => openCollectionTarget(event, "collection-title")}
            role="menuitem"
          >
            Rename / describe
          </a>
          <button className="item-card__more-menu-item" type="button" role="menuitem" onClick={copyCollectionLink}>
            {copied ? "Copied" : "Copy collection link"}
          </button>
        </CardActionMenu>
      </div>
    </article>
  );
}

export function NewCollectionCard({ disabled = false, onCreate }: { disabled?: boolean; onCreate: () => void }) {
  return (
    <article className="collection-card collection-card--create">
      <button className="collection-card__create-button" disabled={disabled} type="button" onClick={onCreate}>
        <div className="collection-card__cover collection-card__cover--create" aria-hidden="true" data-empty="true">
          <span className="collection-card__cover-empty">
            <strong>+</strong>
            <small>empty set</small>
          </span>
        </div>
        <div className="collection-card__body">
          <h2>New Collection</h2>
          <span className="collection-card__count">Create</span>
        </div>
      </button>
    </article>
  );
}

function renderCoverTiles(collection: CollectionCardModel) {
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
    const imageUrl = item.thumbnailUrl || item.imageUrl || item.ogImageUrl || item.videoPosterUrl || null;
    if (imageUrl) {
      return (
        <span className="collection-card__preview-tile collection-card__preview-tile--visual" key={`${item.id}:${index}`}>
          <img src={imageUrl} alt="" />
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

function formatCollectionTitle(name: string) {
  const normalizedName = name.trim();
  if (normalizedName.length <= maxCollectionTitleLength) {
    return normalizedName;
  }

  return `${normalizedName.slice(0, maxCollectionTitleLength - 1).trimEnd()}…`;
}
