import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { type ItemStatus } from "../atoms";
import { ArchiveChevronIcon, ArchiveReturnButton } from "../ui/ArchiveControls";
import type { ItemDetail, ItemDetailAIAnnotation } from "../../data/pocketBaseItemDetail";
import type { CollectionIndexItem, CollectionPreviewItem } from "../../data/pocketBaseItemCollection";

type RelationshipTargetOption = {
  id: string;
  label: string;
};

type CollectionOption = {
  id: string;
  label: string;
  alreadyAttached: boolean;
};

type RelationshipCreateInput = {
  toId: string;
  note: string | null;
};

type CollectionAttachInput = {
  collectionId: string;
};

type CollectionRemoveInput = {
  collectionId: string;
};

type NoteFormat = "plain" | "markdown" | "blocknote";

type NoteUpdateInput = {
  body: string;
  format?: NoteFormat;
};

type ItemDetailRelationship = ItemDetail["relationships"][number];

export type DetailArchiveNeighbor = {
  id: string;
  label: string;
  meta: string;
};

export type DetailArchiveFlow = {
  index: number;
  total: number;
  previous: DetailArchiveNeighbor | null;
  next: DetailArchiveNeighbor | null;
};

export type ItemDetailViewProps = {
  item: ItemDetail | null;
  loading: boolean;
  error: string | null;
  archiveContext: string;
  archiveFlow?: DetailArchiveFlow | null;
  backLabel?: string;
  onBack: () => void;
  onExitToArchive?: () => void;
  onOpenArchiveItem?: (itemId: string) => void;
  onOpenCollection?: (collectionId: string) => void;
  onOpenRelatedItem?: (itemId: string) => void;
  onChangeStatus?: (nextStatus: ItemStatus) => void;
  statusActionPending?: boolean;
  statusActionError?: string | null;
  onDelete?: () => Promise<void> | void;
  deleteActionPending?: boolean;
  deleteActionError?: string | null;
  onCreateRelationship?: (input: RelationshipCreateInput) => Promise<void> | void;
  relationshipActionPending?: boolean;
  relationshipActionError?: string | null;
  relationshipTargetOptions?: RelationshipTargetOption[];
  onUpdateNote?: (input: NoteUpdateInput) => Promise<void> | void;
  noteActionPending?: boolean;
  noteActionError?: string | null;
  onAttachCollection?: (input: CollectionAttachInput) => Promise<void> | void;
  onRemoveCollection?: (input: CollectionRemoveInput) => Promise<void> | void;
  collectionActionPending?: boolean;
  collectionActionError?: string | null;
  collectionOptions?: CollectionOption[];
  collectionIndex?: CollectionIndexItem[];
};

export function ItemDetailView({
  item,
  loading,
  error,
  archiveContext,
  archiveFlow = null,
  backLabel = "Back to archive",
  onBack,
  onExitToArchive,
  onOpenArchiveItem,
  onOpenCollection,
  onOpenRelatedItem,
  onChangeStatus,
  statusActionPending = false,
  statusActionError = null,
  onDelete,
  deleteActionPending = false,
  deleteActionError = null,
  onCreateRelationship,
  relationshipActionPending = false,
  relationshipActionError = null,
  relationshipTargetOptions = [],
  onUpdateNote,
  noteActionPending = false,
  noteActionError = null,
  onAttachCollection,
  onRemoveCollection,
  collectionActionPending = false,
  collectionActionError = null,
  collectionOptions = [],
  collectionIndex = [],
}: ItemDetailViewProps) {
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setIsContextPanelOpen((open) => !open);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        (onExitToArchive ?? onBack)();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack, onExitToArchive]);

  if (loading) {
    return (
      <section className="item-detail item-detail--loading" aria-busy="true">
        <DetailTopBar backLabel={backLabel} onBack={onBack} />
        <div className="item-detail__loading">Loading archive item.</div>
      </section>
    );
  }

  if (error || !item) {
    return (
      <section className="item-detail">
        <DetailTopBar backLabel={backLabel} onBack={onBack} />
        <DetailErrorState message={error ?? "Archive item could not be loaded."} />
      </section>
    );
  }

  const sourceUrl = getItemSourceUrl(item);
  const itemFormat = getItemFormat(item);
  const dimensionsLabel = getDimensionsLabel(item);
  const aspectLabel = getAspectRatioLabel(item);

  return (
    <article className={`item-detail item-detail--object item-detail--${item.type}`} aria-labelledby="item-detail-title">
      <DetailTopBar backLabel={backLabel} onBack={onBack} />

      <div
        className="item-detail__object-layout"
        data-right-panel={isContextPanelOpen ? "open" : "closed"}
      >
        <main className="item-detail__object-main">
          <section className="item-detail__media-stage" aria-label="archive item preview">
            <ItemHero
              item={item}
              noteActionError={noteActionError}
              noteActionPending={noteActionPending}
              onUpdateNote={onUpdateNote}
            />
            <DetailArchiveFlowPanel archiveFlow={archiveFlow} onOpenArchiveItem={onOpenArchiveItem} />
          </section>
        </main>

        <aside
          className="item-detail__side-panel item-detail__side-panel--right item-detail__context-rail"
          aria-label="archive item context"
          data-open={isContextPanelOpen ? "true" : "false"}
        >
          <PanelToggle
            label="Info"
            open={isContextPanelOpen}
            side="right"
            onToggle={() => setIsContextPanelOpen((open) => !open)}
          />
          <div className="item-detail__side-panel-inner">
            <ArchiveLabel
              aspectLabel={aspectLabel}
              collections={item.collections}
              collectionActionError={collectionActionError}
              collectionIndex={collectionIndex}
              collectionOptions={collectionOptions}
              dimensionsLabel={dimensionsLabel}
              item={item}
              onAttachCollection={onAttachCollection}
              onOpenCollection={onOpenCollection}
              onRemoveCollection={onRemoveCollection}
              pending={collectionActionPending}
              sourceUrl={sourceUrl}
            />
            <AdvancedPanel
              aspectLabel={aspectLabel}
              deleteActionError={deleteActionError}
              deleteActionPending={deleteActionPending}
              dimensionsLabel={dimensionsLabel}
              item={item}
              itemFormat={itemFormat}
              aiAnnotations={item.aiAnnotations}
              events={item.events}
              onChangeStatus={onChangeStatus}
              onOpenRelatedItem={onOpenRelatedItem}
              onCreateRelationship={onCreateRelationship}
              onDelete={onDelete}
              relationshipActionError={relationshipActionError}
              relationshipActionPending={relationshipActionPending}
              relationshipTargetOptions={relationshipTargetOptions}
              relationships={item.relationships}
              sourceUrl={sourceUrl}
              statusActionError={statusActionError}
              statusActionPending={statusActionPending}
            />
          </div>
        </aside>
      </div>
    </article>
  );
}

function PanelToggle({
  label,
  onToggle,
  open,
  side,
}: {
  label: string;
  onToggle: () => void;
  open: boolean;
  side: "left" | "right";
}) {
  return (
    <button
      className="item-detail__panel-toggle"
      type="button"
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} ${label.toLowerCase()} panel`}
      data-side={side}
      onClick={onToggle}
    >
      <span>{label}</span>
      <kbd>R</kbd>
      <PanelChevronIcon side={side} open={open} />
    </button>
  );
}

function PanelChevronIcon({ open, side }: { open: boolean; side: "left" | "right" }) {
  const pointsLeft = side === "left" ? open : !open;

  return <ArchiveChevronIcon direction={pointsLeft ? "left" : "right"} />;
}

function DrawerChevronIcon() {
  return (
    <svg className="item-detail__drawer-chevron" aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="m9 12-5-6h10Z" />
    </svg>
  );
}

function DetailDrawer({
  children,
  className = "",
  defaultOpen = true,
  meta,
  title,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  meta?: ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className={`item-detail__drawer ${className}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="item-detail__drawer-summary">
        <span className="item-detail__drawer-title">
          {title}
          {meta ? <small> · {meta}</small> : null}
        </span>
        <DrawerChevronIcon />
      </summary>
      <div className="item-detail__drawer-body">
        {children}
      </div>
    </details>
  );
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function ArchiveLabel({
  aspectLabel,
  collections,
  collectionActionError,
  collectionIndex,
  collectionOptions,
  dimensionsLabel,
  item,
  onAttachCollection,
  onOpenCollection,
  onRemoveCollection,
  pending,
  sourceUrl,
}: {
  aspectLabel: string | null;
  collections: ItemDetail["collections"];
  collectionActionError: string | null;
  collectionIndex: CollectionIndexItem[];
  collectionOptions: CollectionOption[];
  dimensionsLabel: string | null;
  item: ItemDetail;
  onAttachCollection?: (input: CollectionAttachInput) => Promise<void> | void;
  onOpenCollection?: (collectionId: string) => void;
  onRemoveCollection?: (input: CollectionRemoveInput) => Promise<void> | void;
  pending: boolean;
  sourceUrl: string | null;
}) {
  return (
    <div className="item-detail__archive-label">
      <ArchiveLabelIdentity item={item} />
      <ArchiveSourceSection
        aspectLabel={aspectLabel}
        dimensionsLabel={dimensionsLabel}
        item={item}
        sourceUrl={sourceUrl}
      />
      <ArchiveCollectionsSection
        collections={collections}
        collectionActionError={collectionActionError}
        collectionIndex={collectionIndex}
        collectionOptions={collectionOptions}
        onAttachCollection={onAttachCollection}
        onOpenCollection={onOpenCollection}
        onRemoveCollection={onRemoveCollection}
        pending={pending}
      />
      <ArchiveContextSection item={item} />
      <ArchiveActionsSection item={item} sourceUrl={sourceUrl} />
    </div>
  );
}

function ArchiveLabelIdentity({ item }: { item: ItemDetail }) {
  const kindLabel = formatItemType(item);
  const title = getItemDisplayTitle(item, kindLabel);
  const metadata = [
    { value: kindLabel, role: "type" },
    { value: getSourceKindDisplayLabel(item.source?.kind ?? "manual"), role: "source" },
    { value: formatStatusLabel(item.status), role: "status" },
    {
      value: `${item.collections.length} ${pluralize(item.collections.length, "collection")}`,
      role: "in",
    },
  ];

  return (
    <header className="item-detail__label-header">
      <h1 id="item-detail-title">{title}</h1>
      <p className="item-detail__label-grammar" aria-label="item metadata">
        {metadata.map((token) => (
          <span data-role={token.role} key={token.role}>{token.value}</span>
        ))}
      </p>
    </header>
  );
}

function ArchiveLabelSection({
  children,
  className = "",
  defaultOpen = true,
  meta,
  title,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  meta?: ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className={`item-detail__label-section ${className}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="item-detail__label-summary">
        <span>
          <strong>{title}</strong>
          {meta ? <small> · {meta}</small> : null}
        </span>
        <DrawerChevronIcon />
      </summary>
      <div className="item-detail__label-body">
        {children}
      </div>
    </details>
  );
}

function ArchiveSourceSection({
  aspectLabel,
  dimensionsLabel,
  item,
  sourceUrl,
}: {
  aspectLabel: string | null;
  dimensionsLabel: string | null;
  item: ItemDetail;
  sourceUrl: string | null;
}) {
  const sourceKind = item.source?.kind ?? "manual";
  const sourceTypeLabel = getSourceKindDisplayLabel(sourceKind);
  const sourceDetail = sourceUrl ? getDomain(sourceUrl) : item.source?.label ?? item.source?.identifier ?? sourceKind;
  const sourceLines = [
    sourceDetail,
    `${sourceKind === "local" ? "Imported" : "Captured"} ${formatDate(item.createdAt)}`,
    dimensionsLabel && aspectLabel ? `${dimensionsLabel} · ${aspectLabel} ratio` : dimensionsLabel,
  ].filter((value): value is string => Boolean(value));

  return (
    <ArchiveLabelSection className="item-detail__source-panel" meta={sourceTypeLabel} title="Source">
      <div className="item-detail__source-lines">
        {sourceLines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
      {sourceUrl ? (
        <div className="item-detail__label-action-row">
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Open source
          </a>
        </div>
      ) : null}
    </ArchiveLabelSection>
  );
}

function ArchiveCollectionsSection({
  collections,
  collectionActionError,
  collectionIndex,
  collectionOptions,
  onAttachCollection,
  onOpenCollection,
  onRemoveCollection,
  pending,
}: {
  collections: ItemDetail["collections"];
  collectionActionError: string | null;
  collectionIndex: CollectionIndexItem[];
  collectionOptions: CollectionOption[];
  onAttachCollection?: (input: CollectionAttachInput) => Promise<void> | void;
  onOpenCollection?: (collectionId: string) => void;
  onRemoveCollection?: (input: CollectionRemoveInput) => Promise<void> | void;
  pending: boolean;
}) {
  return (
    <ArchiveLabelSection
      className="item-detail__collections-panel"
      meta={collections.length}
      title="Collections"
    >
      {collections.length > 0 ? (
        <CollectionMembershipList
          collections={collections}
          collectionIndex={collectionIndex}
          onOpenCollection={onOpenCollection}
          onRemoveCollection={onRemoveCollection}
          pending={pending}
        />
      ) : (
        <p className="detail-muted">Not collected yet.</p>
      )}
      <CollapsibleAction summary="Add to collection">
        <CollectionAttachForm
          error={collectionActionError}
          onAttachCollection={onAttachCollection}
          options={collectionOptions}
          pending={pending}
        />
      </CollapsibleAction>
    </ArchiveLabelSection>
  );
}

function ArchiveContextSection({ item }: { item: ItemDetail }) {
  const blocks = getContextBlocks(item);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <ArchiveLabelSection
      className="item-detail__note-panel"
      title={item.type === "caption" ? "Caption" : item.type === "note" ? "Note" : "Context"}
    >
      {blocks.map((block) => (
        <div className="item-detail__note-block" key={block.label}>
          <span>{block.label}</span>
          <p>{block.value}</p>
        </div>
      ))}
    </ArchiveLabelSection>
  );
}

function ArchiveActionsSection({
  item,
  sourceUrl,
}: {
  item: ItemDetail;
  sourceUrl: string | null;
}) {
  return (
    <section className="item-detail__action-strip" aria-label="item actions">
      <div className="item-detail__primary-actions">
        <OpenSourceAction sourceUrl={sourceUrl} />
        <DownloadItemAction item={item} />
        <CopyReferenceAction item={item} />
      </div>
    </section>
  );
}

function getContextBlocks(item: ItemDetail) {
  const blocks: Array<{ label: string; value: string }> = [];

  if (item.description) {
    blocks.push({ label: "Description", value: item.description });
  }

  if (item.summary) {
    blocks.push({ label: "Summary", value: item.summary });
  }

  if (item.content.image?.ocrText) {
    blocks.push({ label: "OCR", value: item.content.image.ocrText });
  }

  return blocks;
}

function SourcePanel({
  aspectLabel,
  dimensionsLabel,
  item,
  sourceUrl,
}: {
  aspectLabel: string | null;
  dimensionsLabel: string | null;
  item: ItemDetail;
  sourceUrl: string | null;
}) {
  const sourceKind = item.source?.kind ?? "manual";
  const sourceTypeLabel = getSourceKindDisplayLabel(sourceKind);
  const sourceDetail = sourceUrl ? getDomain(sourceUrl) : item.source?.label ?? item.source?.identifier ?? sourceKind;
  const sourceRows = [
    { label: getSourceLocationLabel(item, sourceKind, sourceUrl), value: sourceDetail },
    { label: sourceKind === "local" ? "imported" : "captured", value: formatDate(item.createdAt) },
    item.type === "image" ? { label: "dimensions", value: dimensionsLabel } : null,
    item.type === "image" ? { label: "ratio", value: aspectLabel } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row?.value));

  return (
    <DetailDrawer className="item-detail__source-panel" meta={sourceTypeLabel} title="Source">
      <dl className="item-detail__source-meta">
        {sourceRows.map((row) => (
          <Metadata key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>
      {sourceUrl ? (
        <div className="item-detail__drawer-action">
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Open source
          </a>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function ItemIdentity({
  item,
}: {
  item: ItemDetail;
}) {
  const kindLabel = formatItemType(item);
  const title = getItemDisplayTitle(item, kindLabel);
  const metadata = [
    { value: kindLabel, role: "kind" },
    { value: getSourceDisplayLabel(item), role: "origin" },
    { value: formatStatusLabel(item.status), role: "state" },
  ];

  return (
    <header className="item-detail__identity">
      <h1 id="item-detail-title">{title}</h1>
      <p className="item-detail__identity-meta" aria-label="item metadata">
        {metadata.map((token) => (
          <span data-role={token.role} key={token.role}>
            {token.value}
          </span>
        ))}
      </p>
    </header>
  );
}

function CollectionContextPanel({
  collections,
  collectionActionError,
  collectionOptions,
  onAttachCollection,
  onOpenCollection,
  onRemoveCollection,
  pending,
}: {
  collections: ItemDetail["collections"];
  collectionActionError: string | null;
  collectionOptions: CollectionOption[];
  onAttachCollection?: (input: CollectionAttachInput) => Promise<void> | void;
  onOpenCollection?: (collectionId: string) => void;
  onRemoveCollection?: (input: CollectionRemoveInput) => Promise<void> | void;
  pending: boolean;
}) {
  return (
    <DetailDrawer
      className="item-detail__collections-panel"
      meta={collections.length}
      title="Collections"
    >
      {collections.length > 0 ? (
        <CollectionMembershipList
          collections={collections}
          onOpenCollection={onOpenCollection}
          onRemoveCollection={onRemoveCollection}
          pending={pending}
        />
      ) : (
        <p className="detail-muted">Not collected yet.</p>
      )}
      <CollapsibleAction summary="Add to collection">
        <CollectionAttachForm
          error={collectionActionError}
          onAttachCollection={onAttachCollection}
          options={collectionOptions}
          pending={pending}
        />
      </CollapsibleAction>
    </DetailDrawer>
  );
}

function CollectionMembershipList({
  collections,
  collectionIndex = [],
  onOpenCollection,
  onRemoveCollection,
  pending,
}: {
  collections: ItemDetail["collections"];
  collectionIndex?: CollectionIndexItem[];
  onOpenCollection?: (collectionId: string) => void;
  onRemoveCollection?: (input: CollectionRemoveInput) => Promise<void> | void;
  pending: boolean;
}) {
  return (
    <div
      className="collection-membership-list"
      aria-label="collection memberships"
      data-overflow={collections.length > 3 ? "true" : "false"}
    >
      {collections.map((collection) => {
        const indexEntry = collectionIndex.find((entry) => entry.id === collection.id);

        return (
          <div className="collection-membership-row" key={collection.id}>
            <CollectionMembershipThumb
              label={collection.name}
              previewItems={indexEntry?.previewItems ?? []}
            />
            <div className="collection-membership-row__main">
              <span className="collection-membership-row__name">{collection.name}</span>
              <span className="detail-muted">
                added {formatDate(collection.addedAt)}
              </span>
            </div>
            <div className="collection-membership-row__actions">
              <a
                className="collection-membership-row__action"
                href={`/collections/${encodeURIComponent(collection.id)}`}
                onClick={(event) => {
                  if (
                    !onOpenCollection ||
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
                  onOpenCollection(collection.id);
                }}
              >
                Open
              </a>
              <button
                className="collection-membership-row__action collection-membership-row__action--remove"
                disabled={pending || !onRemoveCollection}
                type="button"
                onClick={async () => {
                  try {
                    await onRemoveCollection?.({ collectionId: collection.id });
                  } catch {
                    // Parent owns the persisted write error message.
                  }
                }}
              >
                {pending ? "Saving" : "Remove"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollectionMembershipThumb({
  label,
  previewItems,
}: {
  label: string;
  previewItems: CollectionPreviewItem[];
}) {
  const slots = previewItems.slice(0, 4);

  while (slots.length < 4) {
    slots.push({ id: `empty-${slots.length}`, kind: "empty" });
  }

  return (
    <span className="collection-membership-row__thumb" aria-hidden="true">
      {slots.map((item, index) => {
        const imageUrl = getCollectionPreviewImageUrl(item);

        if (imageUrl) {
          return <img alt="" decoding="async" loading="lazy" key={`${item.id}:${index}`} src={imageUrl} />;
        }

        return <span key={`${item.id}:${index}`}>{index === 0 && previewItems.length === 0 ? getCollectionThumbLabel(label) : null}</span>;
      })}
    </span>
  );
}

function getCollectionPreviewImageUrl(item: CollectionPreviewItem) {
  return item.thumbnailUrl || item.imageUrl || item.ogImageUrl || item.videoPosterUrl || null;
}

function getCollectionThumbLabel(name: string) {
  const letters = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return letters || "+";
}

function ItemContextNote({ item }: { item: ItemDetail }) {
  const blocks: Array<{ label: string; value: string }> = [];

  if (item.description) {
    blocks.push({ label: "Description", value: item.description });
  }

  if (item.summary) {
    blocks.push({ label: "Summary", value: item.summary });
  }

  if (item.content.image?.ocrText) {
    blocks.push({ label: "OCR", value: item.content.image.ocrText });
  }

  if (blocks.length === 0) {
    return null;
  }

  return (
    <DetailDrawer
      className="item-detail__note-panel"
      title={item.type === "caption" ? "Caption" : item.type === "note" ? "Note" : "Context"}
    >
      {blocks.map((block) => (
        <div className="item-detail__note-block" key={block.label}>
          <span>{block.label}</span>
          <p>{block.value}</p>
        </div>
      ))}
    </DetailDrawer>
  );
}

function PrimaryActionCluster({
  item,
  sourceUrl,
}: {
  item: ItemDetail;
  sourceUrl: string | null;
}) {
  return (
    <DetailDrawer className="item-detail__actions-panel" title="Actions">
      <div className="item-detail__primary-actions">
        <OpenSourceAction sourceUrl={sourceUrl} />
        <CopyReferenceAction item={item} />
      </div>
    </DetailDrawer>
  );
}

function AdvancedPanel({
  aiAnnotations,
  aspectLabel,
  deleteActionError,
  deleteActionPending,
  dimensionsLabel,
  events,
  item,
  itemFormat,
  onChangeStatus,
  onCreateRelationship,
  onDelete,
  onOpenRelatedItem,
  relationshipActionError,
  relationshipActionPending,
  relationshipTargetOptions,
  relationships,
  sourceUrl,
  statusActionError,
  statusActionPending,
}: {
  aiAnnotations: ItemDetail["aiAnnotations"];
  aspectLabel: string | null;
  deleteActionError: string | null;
  deleteActionPending: boolean;
  dimensionsLabel: string | null;
  events: ItemDetail["events"];
  item: ItemDetail;
  itemFormat: string;
  onChangeStatus?: (nextStatus: ItemStatus) => void;
  onCreateRelationship?: (input: RelationshipCreateInput) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onOpenRelatedItem?: (itemId: string) => void;
  relationshipActionError: string | null;
  relationshipActionPending: boolean;
  relationshipTargetOptions: RelationshipTargetOption[];
  relationships: ItemDetail["relationships"];
  sourceUrl: string | null;
  statusActionError: string | null;
  statusActionPending: boolean;
}) {
  return (
    <details className="item-detail__drawer item-detail__advanced">
      <summary className="item-detail__drawer-summary">
        <span>More</span>
        <DrawerChevronIcon />
      </summary>
      <div className="item-detail__advanced-body">
        <TechnicalDetails
          aspectLabel={aspectLabel}
          dimensionsLabel={dimensionsLabel}
          item={item}
          itemFormat={itemFormat}
        />
        <div className="item-detail__advanced-actions">
          {sourceUrl ? <CopyTextAction label="Copy source URL" copiedLabel="Copied" text={sourceUrl} /> : null}
          <CopyTextAction label="Copy internal link" copiedLabel="Copied" text={getItemInternalHref(item)} />
          <CopyPayloadAction item={item} />
          <CopyItemIdAction item={item} />
          <CopyRawJsonAction item={item} />
          <ArchiveAction
            status={item.status}
            pending={statusActionPending}
            error={statusActionError}
            onChangeStatus={onChangeStatus}
          />
          <CollapsibleAction summary="Connect manually">
            <RelationshipCreateForm
              currentItemId={item.id}
              error={relationshipActionError}
              onCreateRelationship={onCreateRelationship}
              pending={relationshipActionPending}
              targetOptions={relationshipTargetOptions}
            />
          </CollapsibleAction>
          <DeleteAction
            pending={deleteActionPending}
            error={deleteActionError}
            onDelete={onDelete}
          />
        </div>
        <LowerContextPanel
          aiAnnotations={aiAnnotations}
          events={events}
          relationships={relationships}
          onOpenRelatedItem={onOpenRelatedItem}
        />
      </div>
    </details>
  );
}

function TechnicalDetails({
  aspectLabel,
  dimensionsLabel,
  item,
  itemFormat,
}: {
  aspectLabel: string | null;
  dimensionsLabel: string | null;
  item: ItemDetail;
  itemFormat: string;
}) {
  const fileSize = getFileSizeLabel(item);
  const rows = [
    { label: "Format", value: itemFormat },
    { label: "MIME", value: getMimeType(item) },
    { label: "File size", value: fileSize },
    { label: "Rights", value: String(item.rightsStatus) },
    { label: "Item ID", value: item.id },
    { label: "Source ID", value: item.source?.id ?? null },
    { label: "Source external ID", value: item.sourceExternalId },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <dl className="item-detail__technical-list">
      {rows.map((row) => (
        <Metadata label={row.label} value={row.value} key={row.label} />
      ))}
    </dl>
  );
}

function LowerContextPanel({
  aiAnnotations,
  events,
  relationships,
  onOpenRelatedItem,
}: {
  aiAnnotations: ItemDetail["aiAnnotations"];
  events: ItemDetail["events"];
  relationships: ItemDetail["relationships"];
  onOpenRelatedItem?: (itemId: string) => void;
}) {
  if (relationships.length === 0 && aiAnnotations.length === 0 && events.length === 0) {
    return null;
  }

  return (
    <section className="item-detail__lower-context" aria-label="secondary item context">
      {relationships.length > 0 ? (
        <DetailSectionGroup id="detail-links" title="Connections">
          <div className="detail-list">
            {relationships.map((relationship) => (
              <RelationshipRow
                key={relationship.id}
                relationship={relationship}
                onOpenRelatedItem={onOpenRelatedItem}
              />
            ))}
          </div>
        </DetailSectionGroup>
      ) : null}

      {aiAnnotations.length > 0 ? (
        <DetailSectionGroup id="detail-ai-notes" title="AI notes">
          <div className="annotation-list">
            {aiAnnotations.map((annotation) => (
              <article
                className={`annotation-row annotation-row--${annotation.reviewStatus}`}
                key={annotation.id}
              >
                <div className="annotation-row__header">
                  <span>{annotation.fieldName}</span>
                  <ProvenanceMark annotation={annotation} />
                </div>
                <pre>{formatPayload(annotation.payload)}</pre>
              </article>
            ))}
          </div>
        </DetailSectionGroup>
      ) : null}

      {events.length > 0 ? (
        <DetailSectionGroup id="detail-history-group" title="History">
          <div className="detail-list">
            {events.map((event) => (
              <div className="detail-list__row" key={event.id}>
                <span className="detail-list__label">{event.eventType}</span>
                <span>{event.actor}</span>
                <span className="detail-muted">{formatDate(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </DetailSectionGroup>
      ) : null}
    </section>
  );
}

function CollapsibleAction({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="detail-collapsible">
      <summary className="detail-collapsible__summary">{summary}</summary>
      <div className="detail-collapsible__body">{children}</div>
    </details>
  );
}

function OpenSourceAction({ sourceUrl }: { sourceUrl: string | null }) {
  if (!sourceUrl) {
    return null;
  }

  return (
    <a className="status-action status-action--link" href={sourceUrl} target="_blank" rel="noreferrer">
      Open source
    </a>
  );
}

function DownloadItemAction({ item }: { item: ItemDetail }) {
  const download = getItemDownloadTarget(item);
  const [error, setError] = useState<string | null>(null);

  if (!download) {
    return null;
  }

  const handleClick = () => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      const anchor = document.createElement("a");
      anchor.href = download.url;
      anchor.download = download.filename;
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setError(null);
    } catch {
      setError("Could not download.");
    }
  };

  return (
    <div className="detail-download">
      <button className="status-action" type="button" onClick={handleClick}>
        Download
      </button>
      {error ? <p className="detail-error">{error}</p> : null}
    </div>
  );
}

function CopyReferenceAction({ item }: { item: ItemDetail }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reference = getItemReferencePayload(item);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy.");
    }
  };

  return (
    <div className="detail-download">
      <button
        className={`status-action${copied ? " status-action--copied" : ""}`}
        type="button"
        onClick={handleClick}
      >
        {copied ? "Copied" : "Copy reference"}
      </button>
      {error ? <p className="detail-error">{error}</p> : null}
    </div>
  );
}

function getItemDownloadTarget(item: ItemDetail): { filename: string; url: string } | null {
  const kindLabel = formatItemType(item);
  const title = getItemDisplayTitle(item, kindLabel);

  if (item.type === "image" && item.content.image?.fileRef) {
    return {
      filename: getDownloadFilename(item.content.image.fileRef, title, item.content.image.mimeType, "jpg"),
      url: item.content.image.fileRef,
    };
  }

  const asset = item.content.link?.asset ?? null;
  if (asset?.fileUrl) {
    return {
      filename:
        asset.originalName ||
        getDownloadFilename(asset.fileUrl, title, asset.mimeType ?? item.content.link?.contentType ?? null, "bin"),
      url: asset.fileUrl,
    };
  }

  const sourceUrl = getItemSourceUrl(item);
  if (sourceUrl && (isDirectImageUrl(sourceUrl) || item.content.link?.contentType === "pdf")) {
    return {
      filename: getDownloadFilename(sourceUrl, title, item.content.link?.contentType ?? null, "bin"),
      url: sourceUrl,
    };
  }

  return null;
}

function getDownloadFilename(url: string, title: string, mimeType: string | null | undefined, fallbackExtension: string) {
  const fromUrl = getFileNameFromUrl(url);
  if (fromUrl) {
    return fromUrl;
  }

  const normalizedTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const extension = getExtensionFromMimeType(mimeType) ?? fallbackExtension;

  return `${normalizedTitle || "archive-item"}.${extension}`;
}

function getExtensionFromMimeType(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("png")) {
    return "png";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("gif")) {
    return "gif";
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }
  if (normalized.includes("pdf")) {
    return "pdf";
  }

  return null;
}

function CopyPayloadAction({ item }: { item: ItemDetail }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = getDownloadPayload(item);

  if (!payload) {
    return null;
  }

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(payload.text);
      setError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy.");
    }
  };

  return (
    <div className="detail-download">
      <button
        className={`status-action${copied ? " status-action--copied" : ""}`}
        type="button"
        onClick={handleClick}
      >
        {copied ? "Copied" : payload.label}
      </button>
      {error ? <p className="detail-error">{error}</p> : null}
    </div>
  );
}

function CopyItemIdAction({ item }: { item: ItemDetail }) {
  return <CopyTextAction label="Copy item ID" copiedLabel="Copied" text={item.id} />;
}

function CopyRawJsonAction({ item }: { item: ItemDetail }) {
  return <CopyTextAction label="Copy raw JSON" copiedLabel="Copied" text={JSON.stringify(item, null, 2)} />;
}

function CopyTextAction({
  copiedLabel,
  label,
  text,
}: {
  copiedLabel: string;
  label: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy.");
    }
  };

  return (
    <div className="detail-download">
      <button
        className={`status-action${copied ? " status-action--copied" : ""}`}
        type="button"
        onClick={handleClick}
      >
        {copied ? copiedLabel : label}
      </button>
      {error ? <p className="detail-error">{error}</p> : null}
    </div>
  );
}

function ArchiveAction({
  status,
  pending,
  error,
  onChangeStatus,
}: {
  status: ItemStatus;
  pending: boolean;
  error: string | null;
  onChangeStatus?: (nextStatus: ItemStatus) => void;
}) {
  if (!onChangeStatus) {
    return null;
  }

  const nextStatus: ItemStatus = status === "active" ? "archived" : "active";
  const label = status === "active" ? "Archive" : "Move to active";

  return (
    <div className="detail-archive-action">
      <button
        className="status-action"
        disabled={pending}
        type="button"
        onClick={() => onChangeStatus(nextStatus)}
      >
        {pending ? "Saving" : label}
      </button>
      {error ? <p className="detail-error">{error}</p> : null}
    </div>
  );
}

function DeleteAction({
  pending,
  error,
  onDelete,
}: {
  pending: boolean;
  error: string | null;
  onDelete?: () => Promise<void> | void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!onDelete) {
    return null;
  }

  if (!confirming) {
    return (
      <div className="detail-delete">
        <button
          className="status-action status-action--delete"
          disabled={pending}
          type="button"
          onClick={() => setConfirming(true)}
        >
          Delete
        </button>
        {error ? <p className="detail-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="detail-delete detail-delete--confirming">
      <p className="detail-delete__warning">Permanent. Cascades to relationships, tags, and history.</p>
      <div className="detail-delete__actions">
        <button
          className="status-action status-action--delete"
          disabled={pending}
          type="button"
          onClick={async () => {
            try {
              await onDelete();
            } catch {
              // Parent owns the persisted write error message.
            }
          }}
        >
          {pending ? "Deleting" : "Confirm delete"}
        </button>
        <button
          className="text-button"
          disabled={pending}
          type="button"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </div>
      {error ? <p className="detail-error">{error}</p> : null}
    </div>
  );
}

function getDownloadPayload(item: ItemDetail): { label: string; text: string } | null {
  if (item.type === "caption" && item.content.caption?.body) {
    return { label: "Copy caption", text: item.content.caption.body };
  }

  if (item.type === "note" && item.content.note?.body) {
    return { label: "Copy note", text: item.content.note.body };
  }

  if (item.type === "link" && item.content.link?.url) {
    return { label: "Copy link", text: item.content.link.url };
  }

  return null;
}

function DetailArchiveFlowPanel({
  archiveFlow,
  onOpenArchiveItem,
}: {
  archiveFlow: DetailArchiveFlow | null;
  onOpenArchiveItem?: (itemId: string) => void;
}) {
  if (!archiveFlow) {
    return null;
  }

  return (
    <nav className="item-detail__archive-flow" aria-label="archive set navigation">
      <div className="item-detail__archive-flow-header">
        <span>archive set</span>
        <span>
          {archiveFlow.index} / {archiveFlow.total}
        </span>
      </div>
      <div className="item-detail__archive-flow-actions">
        <ArchiveFlowStep
          direction="previous"
          neighbor={archiveFlow.previous}
          onOpenArchiveItem={onOpenArchiveItem}
        />
        <ArchiveFlowStep
          direction="next"
          neighbor={archiveFlow.next}
          onOpenArchiveItem={onOpenArchiveItem}
        />
      </div>
    </nav>
  );
}

function ArchiveFlowStep({
  direction,
  neighbor,
  onOpenArchiveItem,
}: {
  direction: "previous" | "next";
  neighbor: DetailArchiveNeighbor | null;
  onOpenArchiveItem?: (itemId: string) => void;
}) {
  return (
    <button
      className="item-detail__archive-step"
      disabled={!neighbor || !onOpenArchiveItem}
      type="button"
      onClick={() => {
        if (neighbor) {
          onOpenArchiveItem?.(neighbor.id);
        }
      }}
    >
      <span>{direction}</span>
      <span>{neighbor?.label ?? "none"}</span>
      {neighbor ? <span>{neighbor.meta}</span> : null}
    </button>
  );
}

function DetailTopBar({
  backLabel,
  onBack,
}: {
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="item-detail__topbar" aria-label="archive detail context">
      <ArchiveReturnButton className="item-detail__return-button" onClick={onBack} ariaLabel={backLabel} />
    </div>
  );
}

function RelationshipRow({
  relationship,
  onOpenRelatedItem,
}: {
  relationship: ItemDetailRelationship;
  onOpenRelatedItem?: (itemId: string) => void;
}) {
  const directionLabel = relationship.direction === "outgoing" ? "to" : "from";
  const targetLabel = relationship.otherItemTitle ?? `${relationship.otherItemType} item`;
  const targetMeta = [relationship.otherItemType, relationship.otherItemStatus].join(" · ");

  return (
    <div className="detail-list__row relationship-row">
      <span className="detail-list__label">{relationship.type}</span>
      <div className="relationship-row__target">
        <button
          className="relationship-target"
          disabled={!onOpenRelatedItem}
          type="button"
          onClick={() => onOpenRelatedItem?.(relationship.otherItemId)}
        >
          <span>{directionLabel}</span>
          {targetLabel}
        </button>
        <span className="detail-muted">{targetMeta}</span>
      </div>
      <span className="detail-muted">{relationship.assertedBy}</span>
      {relationship.typeDescription ? <p>{relationship.typeDescription}</p> : null}
      {relationship.note ? <p>{relationship.note}</p> : null}
    </div>
  );
}

function CollectionAttachForm({
  error,
  onAttachCollection,
  options,
  pending,
}: {
  error: string | null;
  onAttachCollection?: (input: CollectionAttachInput) => Promise<void> | void;
  options: CollectionOption[];
  pending: boolean;
}) {
  const [collectionId, setCollectionId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const availableOptions = options.filter((option) => !option.alreadyAttached);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCollectionId = collectionId.trim();

    if (!normalizedCollectionId) {
      setLocalError("Collection is required.");
      return;
    }

    if (!onAttachCollection) {
      setLocalError("Adding to a collection requires live archive mode.");
      return;
    }

    setLocalError(null);

    try {
      await onAttachCollection({ collectionId: normalizedCollectionId });
      setCollectionId("");
    } catch {
      // Parent owns the persisted write error message.
    }
  };

  return (
    <form className="collection-attach" aria-label="add to collection" onSubmit={submit}>
      <div className="collection-attach__picker" role="listbox" aria-label="available collections">
        {availableOptions.map((option) => (
          <button
            aria-selected={collectionId === option.id}
            className="collection-attach__option"
            disabled={pending}
            key={option.id}
            onClick={() => setCollectionId(option.id)}
            type="button"
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <button
        className="status-action"
        disabled={pending || availableOptions.length === 0}
        type="submit"
      >
        {pending ? "Adding" : "Add to collection"}
      </button>
      {availableOptions.length === 0 ? (
        <p className="detail-muted">No collections available.</p>
      ) : null}
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
  );
}

function ItemHero({
  item,
  noteActionError,
  noteActionPending,
  onUpdateNote,
}: {
  item: ItemDetail;
  noteActionError: string | null;
  noteActionPending: boolean;
  onUpdateNote?: (input: NoteUpdateInput) => Promise<void> | void;
}) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  if (item.type === "image") {
    if (item.content.image?.fileRef) {
      const imageAlt = item.title ?? "";
      return (
        <figure className="item-detail__media-figure">
          <img
            className="item-detail__hero-image"
            decoding="async"
            src={item.content.image.fileRef}
            alt={imageAlt}
          />
          <button
            className="item-detail__media-action item-detail__media-expand"
            type="button"
            aria-label="Enlarge image"
            onClick={() => setExpandedImage(item.content.image?.fileRef ?? null)}
          >
            <ExpandImageIcon />
          </button>
          {expandedImage ? (
            <div className="item-detail__lightbox" role="dialog" aria-modal="true" aria-label="enlarged image">
              <button
                className="item-detail__lightbox-close"
                type="button"
                aria-label="Close enlarged image"
                onClick={() => setExpandedImage(null)}
              >
                <PanelChevronIcon open side="right" />
              </button>
              <img src={expandedImage} alt={imageAlt} />
            </div>
          ) : null}
        </figure>
      );
    }

    return <ImageMissingHero item={item} />;
  }

  if (item.type === "caption") {
    const body = item.content.caption?.body ?? "Caption body unavailable.";
    return (
      <div className="item-detail__text-hero" data-length={getTextLengthClass(body)}>
        <span>caption</span>
        <p>{body}</p>
      </div>
    );
  }

  if (item.type === "note") {
    return (
      <EditableNoteHero
        body={item.content.note?.body ?? ""}
        error={noteActionError}
        format={normalizeNoteFormat(item.content.note?.format)}
        pending={noteActionPending}
        onUpdateNote={onUpdateNote}
      />
    );
  }

  if (item.type === "link") {
    const pdfUrl = getPdfUrl(item);

    if (pdfUrl) {
      const pdfLabel = item.title ?? item.content.link?.asset?.originalName ?? "PDF preview";

      return (
        <div className="item-detail__pdf-hero">
          <iframe
            className="item-detail__pdf-frame"
            src={buildPdfPreviewUrl(pdfUrl, pdfLabel)}
            title={pdfLabel}
          />
          <a
            className="item-detail__media-action item-detail__media-open-pdf"
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open PDF"
          >
            <OpenMediaIcon />
          </a>
        </div>
      );
    }

    return <LinkHero item={item} />;
  }

  return <div className="item-detail__media-placeholder">Preview unavailable</div>;
}

function ExpandImageIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="M6.75 4.75H4.75V6.75" />
      <path d="M11.25 4.75H13.25V6.75" />
      <path d="M13.25 11.25V13.25H11.25" />
      <path d="M4.75 11.25V13.25H6.75" />
    </svg>
  );
}

function OpenMediaIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="M6.75 5.25h6v6" />
      <path d="M12.5 5.5 5.25 12.75" />
    </svg>
  );
}

function ImageMissingHero({ item }: { item: ItemDetail }) {
  const dimensionsLabel = getDimensionsLabel(item);
  const fallbackTitle = item.title ?? "Image preview unavailable";

  return (
    <div className="item-detail__media-placeholder item-detail__media-placeholder--image">
      <span className="item-detail__missing-glyph" aria-hidden="true">image</span>
      <strong>{fallbackTitle}</strong>
      <small>{dimensionsLabel ? `No local preview · ${dimensionsLabel}` : "No local preview file available"}</small>
    </div>
  );
}

function EditableNoteHero({
  body,
  error,
  format,
  onUpdateNote,
  pending,
}: {
  body: string;
  error: string | null;
  format: NoteFormat;
  onUpdateNote?: (input: NoteUpdateInput) => Promise<void> | void;
  pending: boolean;
}) {
  return (
    <NoteEditor
      body={body}
      className="item-detail__text-hero item-detail__text-hero--editable"
      emptyLabel="Click to write this note."
      error={error}
      format={format}
      label="note"
      mode="hero"
      onUpdateNote={onUpdateNote}
      pending={pending}
    />
  );
}

function NoteEditor({
  body,
  className,
  emptyLabel,
  error,
  format,
  label,
  mode,
  onUpdateNote,
  pending,
}: {
  body: string;
  className: string;
  emptyLabel: string;
  error: string | null;
  format: NoteFormat;
  label: string;
  mode: "hero" | "rail";
  onUpdateNote?: (input: NoteUpdateInput) => Promise<void> | void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState(body);
  const [draftFormat, setDraftFormat] = useState<NoteFormat>(format);
  const [localError, setLocalError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lengthClass = getTextLengthClass(draft || body);
  const canEdit = Boolean(onUpdateNote);
  const hasChanges = draft !== body || draftFormat !== format;

  useEffect(() => {
    setDraft(body);
    setDraftFormat(format);
    setLocalError(null);
  }, [body, format]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft, lengthClass]);

  const cancel = () => {
    setDraft(body);
    setDraftFormat(format);
    setLocalError(null);
  };

  const save = async () => {
    if (!onUpdateNote) {
      setLocalError("Note editing requires live archive mode.");
      return;
    }

    setLocalError(null);
    try {
      await onUpdateNote({ body: draft, format: draftFormat });
    } catch {
      // Parent owns the persisted write error message.
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void save();
    }
  };

  const applyMarkdown = (command: NoteToolbarCommand) => {
    const textarea = textareaRef.current;
    setDraftFormat("markdown");

    if (!textarea) {
      setDraft((currentDraft) => applyMarkdownCommand(currentDraft, command, 0, currentDraft.length));
      return;
    }

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const nextDraft = applyMarkdownCommand(draft, command, selectionStart, selectionEnd);
    setDraft(nextDraft);
    requestAnimationFrame(() => textarea.focus());
  };

  return (
    <form
      className={`${className} item-detail__note-edit-form item-detail__note-edit-form--inline`}
      data-dirty={hasChanges ? "true" : "false"}
      data-editable={canEdit ? "true" : "false"}
      data-length={lengthClass}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <span>{label}</span>
      <div className="item-detail__note-canvas-controls" aria-label="note controls">
        <NoteToolbar disabled={pending || !canEdit} onCommand={applyMarkdown} />
        <div className="item-detail__note-edit-actions">
          <button className="status-action" disabled={pending || !hasChanges || !canEdit} type="submit">
            {pending ? "Saving" : "Save"}
          </button>
          <button className="text-button" disabled={pending || !hasChanges} type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        aria-label="edit note"
        disabled={pending}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={emptyLabel}
        readOnly={!canEdit}
        rows={getNoteEditorRows(draft, mode)}
        value={draft}
      />
      <small className="item-detail__note-hint">{hasChanges ? "Cmd/Ctrl+Enter saves · Esc reverts" : "Click into the text to edit"}</small>
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
  );
}

type NoteToolbarCommand = "bold" | "italic" | "link" | "bullet" | "heading1" | "heading2" | "heading3" | "quote";

function NoteToolbar({
  disabled,
  onCommand,
}: {
  disabled: boolean;
  onCommand: (command: NoteToolbarCommand) => void;
}) {
  const commands: Array<{ command: NoteToolbarCommand; label: string }> = [
    { command: "bold", label: "B" },
    { command: "italic", label: "I" },
    { command: "link", label: "Link" },
    { command: "bullet", label: "•" },
    { command: "heading1", label: "H1" },
    { command: "heading2", label: "H2" },
    { command: "heading3", label: "H3" },
    { command: "quote", label: "Quote" },
  ];

  return (
    <div className="item-detail__note-toolbar" aria-label="note formatting">
      {commands.map((command) => (
        <button
          disabled={disabled}
          key={command.command}
          type="button"
          onClick={() => onCommand(command.command)}
        >
          {command.label}
        </button>
      ))}
    </div>
  );
}

function applyMarkdownCommand(
  value: string,
  command: NoteToolbarCommand,
  selectionStart: number,
  selectionEnd: number,
) {
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const fallback = selected || "text";

  if (command === "bold") {
    return `${before}**${fallback}**${after}`;
  }

  if (command === "italic") {
    return `${before}_${fallback}_${after}`;
  }

  if (command === "link") {
    return `${before}[${fallback}](https://)${after}`;
  }

  if (command === "bullet") {
    return `${before}${prefixLines(fallback, "- ")}${after}`;
  }

  if (command === "heading1") {
    return `${before}${prefixLines(fallback, "# ")}${after}`;
  }

  if (command === "heading2") {
    return `${before}${prefixLines(fallback, "## ")}${after}`;
  }

  if (command === "heading3") {
    return `${before}${prefixLines(fallback, "### ")}${after}`;
  }

  return `${before}${prefixLines(fallback, "> ")}${after}`;
}

function prefixLines(value: string, prefix: string) {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function getTextLengthClass(value: string) {
  const length = value.trim().length;

  if (length > 900) {
    return "long";
  }

  if (length > 320) {
    return "medium";
  }

  return "short";
}

function pluralize(count: number, singular: string) {
  return count === 1 ? singular : `${singular}s`;
}

function getNoteEditorRows(value: string, mode: "hero" | "rail") {
  const lineCount = value.split("\n").length;
  const estimatedLines = Math.ceil(value.length / (mode === "hero" ? 72 : 42));
  const minRows = mode === "hero" ? 8 : 5;
  const maxRows = mode === "hero" ? 18 : 10;
  return Math.min(maxRows, Math.max(minRows, lineCount, estimatedLines));
}

function normalizeNoteFormat(value: string | null | undefined): NoteFormat {
  return value === "markdown" || value === "blocknote" ? value : "plain";
}

function LinkHero({ item }: { item: ItemDetail }) {
  const link = item.content.link;
  const url = link?.url ?? null;
  const og = getOpenGraph(link?.ogMetadata ?? null);
  const isImageReference = isDirectImageUrl(url);
  const previewImage = isImageReference ? url : og.image;
  const title =
    item.title ??
    og.title ??
    (isImageReference ? getFileNameFromUrl(url) : null) ??
    getDomain(url) ??
    (isImageReference ? "Image reference" : "Website");
  const description = isImageReference
    ? getDomain(url) ?? url ?? "Remote image URL"
    : og.description ?? url ?? "Source URL unavailable.";
  const linkKindLabel = isImageReference
    ? "Image reference"
    : link?.contentType === "video"
      ? "Video"
      : "Website";
  const heroClassName = [
    "item-detail__link-hero",
    previewImage ? "item-detail__link-hero--with-preview" : "item-detail__link-hero--fallback",
    isImageReference ? "item-detail__link-hero--image-reference" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={heroClassName}>
      {previewImage ? <img src={previewImage} alt={title} /> : <span className="item-detail__link-glyph">URL</span>}
      <div>
        <span className="detail-muted">{linkKindLabel}</span>
        <p>{title}</p>
        <small>{description}</small>
      </div>
    </div>
  );
}

function getPdfUrl(item: ItemDetail) {
  if (item.type !== "link" || item.content.link?.contentType !== "pdf") {
    return null;
  }

  if (item.content.link.asset?.fileUrl) {
    return item.content.link.asset.fileUrl;
  }

  const url = item.content.link.url;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function buildPdfPreviewUrl(src: string, name: string) {
  const searchParams = new URLSearchParams();
  searchParams.set("src", src);
  searchParams.set("name", name);
  return `/pdf-preview?${searchParams.toString()}`;
}

function DetailSectionGroup({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="detail-section-group" id={id}>
      <div className="detail-section-group__header">
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DetailErrorState({ message }: { message: string }) {
  const [title, ...copy] = message.split("\n");

  return (
    <div className="item-detail__error-state">
      <strong>{title || "This item could not be found."}</strong>
      {copy.length > 0 ? <span>{copy.join(" ")}</span> : null}
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProvenanceMark({ annotation }: { annotation: ItemDetailAIAnnotation }) {
  const parts = [
    annotation.modelName,
    annotation.modelVersion,
    annotation.confidence === null ? null : annotation.confidence.toFixed(2),
    annotation.reviewStatus,
  ].filter(Boolean);

  return <span className="provenance-mark">{parts.join(" · ")}</span>;
}

function RelationshipCreateForm({
  currentItemId,
  error,
  onCreateRelationship,
  pending,
  targetOptions,
}: {
  currentItemId: string;
  error: string | null;
  onCreateRelationship?: (input: RelationshipCreateInput) => Promise<void> | void;
  pending: boolean;
  targetOptions: RelationshipTargetOption[];
}) {
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const dataListId = `relationship-targets-${slug(currentItemId)}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedToId = toId.trim();

    if (!normalizedToId) {
      setLocalError("Archive ID is required.");
      return;
    }

    if (normalizedToId === currentItemId) {
      setLocalError("Choose a different item.");
      return;
    }

    if (!onCreateRelationship) {
      setLocalError("Connecting items requires live archive mode.");
      return;
    }

    setLocalError(null);

    try {
      await onCreateRelationship({
        toId: normalizedToId,
        note: note.trim() || null,
      });
      setToId("");
      setNote("");
    } catch {
      // Parent owns the persisted write error message.
    }
  };

  return (
    <form className="relationship-create" aria-label="connect item" onSubmit={submit}>
      <div className="relationship-create__fields">
        <label>
          <input
            aria-label="archive id"
            autoComplete="off"
            disabled={pending}
            list={targetOptions.length > 0 ? dataListId : undefined}
            onChange={(event) => setToId(event.target.value)}
            placeholder="archive id"
            type="text"
            value={toId}
          />
        </label>
        {targetOptions.length > 0 ? (
          <datalist id={dataListId}>
            {targetOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </datalist>
        ) : null}
        <label>
          <span>note</span>
          <textarea
            disabled={pending}
            onChange={(event) => setNote(event.target.value)}
            placeholder="optional"
            rows={2}
            value={note}
          />
        </label>
      </div>
      <button className="status-action" disabled={pending} type="submit">
        {pending ? "Connecting" : "Connect item"}
      </button>
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
  );
}

function getPrimaryTextBody(item: ItemDetail) {
  if (item.type === "caption") {
    return item.content.caption?.body ?? null;
  }

  if (item.type === "note") {
    return item.content.note?.body ?? null;
  }

  return null;
}

function getItemSourceUrl(item: ItemDetail) {
  const url = item.content.link?.url ?? null;
  if (isHttpUrl(url)) {
    return url;
  }

  const identifier = item.source?.identifier ?? null;
  return isHttpUrl(identifier) ? identifier : null;
}

function getItemFormat(item: ItemDetail) {
  if (item.type === "image") {
    return item.content.image?.mimeType ?? "image";
  }

  if (item.type === "link") {
    if (item.content.link?.contentType === "pdf") {
      return item.content.link.asset?.mimeType ?? "PDF";
    }

    if (item.content.link?.contentType === "video") {
      return "video";
    }

    return item.content.link?.contentType ?? "website";
  }

  if (item.type === "note") {
    return item.content.note?.format ?? "note";
  }

  if (item.type === "caption") {
    return item.content.caption?.tone ?? "caption";
  }

  return item.type;
}

function getMimeType(item: ItemDetail) {
  if (item.type === "image") {
    return item.content.image?.mimeType ?? null;
  }

  if (item.type === "link") {
    return item.content.link?.asset?.mimeType ?? null;
  }

  return null;
}

function getFileSizeLabel(item: ItemDetail) {
  const size = item.content.link?.asset?.sizeBytes ?? null;

  if (!size || size <= 0) {
    return null;
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatItemType(item: ItemDetail) {
  if (item.type === "image") {
    return "Image";
  }

  if (item.type === "note") {
    return "Note";
  }

  if (item.type === "caption") {
    return "Caption";
  }

  if (item.type === "link" && item.content.link?.contentType === "pdf") {
    return "PDF";
  }

  if (item.type === "link") {
    if (item.content.link?.contentType === "video") {
      return "Video";
    }

    if (isDirectImageUrl(item.content.link?.url)) {
      return "Image reference";
    }

    return "Website";
  }

  return item.type;
}

function getDimensionsLabel(item: ItemDetail) {
  if (item.type !== "image") {
    return null;
  }

  const width = item.content.image?.width;
  const height = item.content.image?.height;

  if (!width || !height) {
    return null;
  }

  return `${width} × ${height}`;
}

function getAspectRatioLabel(item: ItemDetail) {
  const ratio = item.content.image?.aspectRatio;

  if (!ratio || !Number.isFinite(ratio)) {
    return null;
  }

  return ratio.toFixed(3);
}

function getOpenGraph(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return { title: null, description: null, image: null };
  }

  const title = firstString(metadata, ["title", "og:title", "ogTitle"]);
  const description = firstString(metadata, ["description", "og:description", "ogDescription"]);
  const image = firstString(metadata, ["image", "og:image", "ogImage", "imageUrl"]);

  return {
    title,
    description,
    image: isHttpUrl(image) ? image : null,
  };
}

function firstString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function isDirectImageUrl(value: string | null | undefined) {
  return Boolean(value && /\.(avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value));
}

function isHttpUrl(value: string | null | undefined) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function getSourceDisplayLabel(item: ItemDetail) {
  const sourceKind = item.source?.kind ?? "manual";

  if (item.type === "image" && sourceKind === "local") {
    return "Local upload";
  }

  if (item.type === "link" && isDirectImageUrl(item.content.link?.url)) {
    return "Remote image";
  }

  if (sourceKind === "url" && item.type === "link") {
    return getDomain(item.content.link?.url) ?? "URL";
  }

  return item.source?.label ?? getSourceKindDisplayLabel(sourceKind);
}

function getSourceKindDisplayLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "local" || normalized === "upload") {
    return "Local upload";
  }

  if (normalized === "arena" || normalized === "are.na") {
    return "Are.na";
  }

  if (normalized === "pinterest") {
    return "Pinterest";
  }

  if (normalized === "manual") {
    return "Manual";
  }

  if (normalized === "url" || normalized === "website") {
    return "Website";
  }

  return value;
}

function getSourceLocationLabel(
  item: ItemDetail,
  sourceKind: string,
  sourceUrl: string | null,
) {
  const normalized = sourceKind.trim().toLowerCase();

  if (normalized === "pinterest") {
    return "board";
  }

  if (normalized === "arena" || normalized === "are.na") {
    return "channel";
  }

  if (normalized === "local" || normalized === "upload") {
    return "file source";
  }

  if (sourceUrl || item.type === "link") {
    return "domain";
  }

  return "where";
}

function getItemDisplayTitle(item: ItemDetail, kindLabel = formatItemType(item)) {
  const explicitTitle = item.title?.trim();

  if (explicitTitle) {
    return formatDisplayTitle(explicitTitle);
  }

  if (item.type === "note") {
    return getTextPreviewTitle(item.content.note?.body, "Untitled note");
  }

  if (item.type === "caption") {
    return getTextPreviewTitle(item.content.caption?.body, "Untitled caption");
  }

  if (item.type === "link") {
    const og = getOpenGraph(item.content.link?.ogMetadata ?? null);
    return (
      og.title ??
      getFileNameFromUrl(item.content.link?.url) ??
      getDomain(item.content.link?.url) ??
      `Untitled ${kindLabel.toLowerCase()}`
    );
  }

  if (item.type === "image") {
    const sourceLabel = item.source?.label?.trim();

    if (sourceLabel && !["image", "local", "local upload", "manual"].includes(sourceLabel.toLowerCase())) {
      return `Image from ${sourceLabel}`;
    }

    return "Untitled image";
  }

  return `Untitled ${kindLabel.toLowerCase()}`;
}

function formatDisplayTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return value;
  }

  if (!looksLikeFileName(normalized)) {
    return normalized;
  }

  return normalized
    .replace(/\.[a-z0-9]{2,6}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\bScreenshot\b/i, "Screenshot")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeFileName(value: string) {
  return /\.[a-z0-9]{2,6}$/i.test(value) || /[_-]{2,}/.test(value);
}

function getTextPreviewTitle(value: string | null | undefined, fallback: string) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 58 ? `${normalized.slice(0, 55)}…` : normalized;
}

function formatStatusLabel(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return "Unknown";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getFileNameFromUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const pathname = new URL(value).pathname;
    const filename = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "");
    return filename || null;
  } catch {
    return null;
  }
}

function getDomain(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function getItemReferencePayload(item: ItemDetail) {
  const title = getItemDisplayTitle(item);
  const href = getItemInternalHref(item);
  return `[${title}](${href})`;
}

function getItemInternalHref(item: ItemDetail) {
  const path = `/items/${encodeURIComponent(item.id)}`;
  return typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatPayload(payload: string) {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
