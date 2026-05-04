import { useState, type FormEvent, type ReactNode } from "react";
import { SourceMark, StatusIndicator, TypeIndicator, type ItemStatus } from "../atoms";
import type { ItemDetail, ItemDetailAIAnnotation } from "../../data/pocketBaseItemDetail";

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
  onAttachCollection?: (input: CollectionAttachInput) => Promise<void> | void;
  collectionActionPending?: boolean;
  collectionActionError?: string | null;
  collectionOptions?: CollectionOption[];
};

export function ItemDetailView({
  item,
  loading,
  error,
  archiveContext,
  archiveFlow = null,
  backLabel = "Back to archive",
  onBack,
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
  onAttachCollection,
  collectionActionPending = false,
  collectionActionError = null,
  collectionOptions = [],
}: ItemDetailViewProps) {
  if (loading) {
    return (
      <section className="item-detail item-detail--loading" aria-busy="true">
        <DetailTopBar archiveContext={archiveContext} backLabel={backLabel} onBack={onBack} />
        <div className="item-detail__loading">Loading archive item.</div>
      </section>
    );
  }

  if (error || !item) {
    return (
      <section className="item-detail">
        <DetailTopBar archiveContext={archiveContext} backLabel={backLabel} onBack={onBack} />
        <p className="proof-empty">{error ?? "Archive item could not be loaded."}</p>
      </section>
    );
  }

  const hasContent = Boolean(item.description || item.summary || item.tags.length > 0);
  const hasFit = Boolean(item.relationships.length > 0 || item.collections.length > 0);
  const sourceLabel =
    item.source?.label ?? item.source?.identifier ?? item.source?.kind ?? "manual";

  return (
    <article className="item-detail" aria-labelledby="item-detail-title">
      <DetailTopBar archiveContext={archiveContext} backLabel={backLabel} onBack={onBack} />

      <div className="item-detail__layout">
        <div className="item-detail__main">
          <section className="item-detail__hero" aria-label="archive item preview">
            {renderHero(item)}
          </section>

          <DetailSectionGroup id="detail-content" title="Content">
            {hasContent ? (
              <>
                <Section title="Description">
                  <ReadableBlock value={item.description} fallback="No description yet." />
                </Section>

                <Section title="Summary">
                  <ReadableBlock value={item.summary} fallback="No summary yet." />
                </Section>

                <Section title="Tags" meta={formatCount(item.tags.length, "tag", "tags")}>
                  {item.tags.length > 0 ? (
                    <div className="tag-row">
                      {item.tags.map((tag) => (
                        <span className={`tag-chip tag-chip--${tag.status}`} key={tag.id}>
                          {tag.name}
                          {tag.status === "pending" ? <span>pending</span> : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <DetailEmptyState label="No tags yet." />
                  )}
                </Section>
              </>
            ) : (
              <DetailEmptyState label="Empty — add description, summary, or tags" />
            )}
          </DetailSectionGroup>

          <DetailSectionGroup id="detail-fit" title="Where it fits">
            {!hasFit ? <DetailEmptyState label="Empty — connect or collect" /> : null}
            <Section
              title="Connected to"
              meta={formatCount(item.relationships.length, "connection", "connections")}
            >
              <CollapsibleAction summary="Connect">
                <RelationshipCreateForm
                  currentItemId={item.id}
                  error={relationshipActionError}
                  onCreateRelationship={onCreateRelationship}
                  pending={relationshipActionPending}
                  targetOptions={relationshipTargetOptions}
                />
              </CollapsibleAction>
              {item.relationships.length > 0 ? (
                <div className="detail-list">
                  {item.relationships.map((relationship) => (
                    <RelationshipRow
                      key={relationship.id}
                      relationship={relationship}
                      onOpenRelatedItem={onOpenRelatedItem}
                    />
                  ))}
                </div>
              ) : !hasFit ? null : (
                <DetailEmptyState label="Not connected to anything yet." />
              )}
            </Section>

            <Section
              title="In collections"
              meta={formatCount(item.collections.length, "collection", "collections")}
            >
              <CollapsibleAction summary="Collect">
                <CollectionAttachForm
                  error={collectionActionError}
                  onAttachCollection={onAttachCollection}
                  options={collectionOptions}
                  pending={collectionActionPending}
                />
              </CollapsibleAction>
              {item.collections.length > 0 ? (
                <div className="tag-row">
                  {item.collections.map((collection) => (
                    <a
                      className="tag-chip tag-chip--link"
                      href={`/collections/${encodeURIComponent(collection.id)}`}
                      key={collection.id}
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
                      {collection.name}
                    </a>
                  ))}
                </div>
              ) : !hasFit ? null : (
                <DetailEmptyState label="Not in any collections yet." />
              )}
            </Section>
          </DetailSectionGroup>

          <DetailSectionGroup id="detail-history-group" title="History">
            <Section title="AI notes" meta={formatCount(item.aiAnnotations.length, "note", "notes")}>
              {item.aiAnnotations.length > 0 ? (
                <div className="annotation-list">
                  {item.aiAnnotations.map((annotation) => (
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
              ) : (
                <DetailEmptyState label="No AI notes yet." />
              )}
            </Section>

            <Section title="History" meta={formatCount(item.events.length, "event", "events")}>
              {item.events.length > 0 ? (
                <div className="detail-list">
                  {item.events.map((event) => (
                    <div className="detail-list__row" key={event.id}>
                      <span className="detail-list__label">{event.eventType}</span>
                      <span>{event.actor}</span>
                      <span className="detail-muted">{formatDate(event.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <DetailEmptyState label="No history yet." />
              )}
            </Section>
          </DetailSectionGroup>
        </div>

        <aside className="item-detail__metadata" aria-label="archive item context">
          <p className="proof-kicker">archive item</p>
          <h1 id="item-detail-title">{item.title ?? `${item.type} item`}</h1>
          <div className="item-detail__signal-row">
            <TypeIndicator type={item.type} />
            <span aria-hidden="true">·</span>
            <StatusIndicator status={item.status} />
            <span aria-hidden="true">·</span>
            <SourceMark source={item.source?.kind ?? "manual"} />
          </div>

          <dl className="item-detail__metadata-list">
            <Metadata label="Created" value={formatDate(item.createdAt)} />
            <Metadata label="Last edited" value={formatDate(item.updatedAt)} />
            <Metadata label="Source" value={sourceLabel} />
            <Metadata
              label="Collections"
              value={
                <CollectionMetaList
                  collections={item.collections}
                  onOpenCollection={onOpenCollection}
                />
              }
            />
            <Metadata label="Rights" value={item.rightsStatus} />
          </dl>

          <div className="item-detail__action-cluster">
            <DownloadAction item={item} />
            <ArchiveAction
              status={item.status}
              pending={statusActionPending}
              error={statusActionError}
              onChangeStatus={onChangeStatus}
            />
            <DeleteAction
              pending={deleteActionPending}
              error={deleteActionError}
              onDelete={onDelete}
            />
          </div>

          <DetailArchiveFlowPanel
            archiveFlow={archiveFlow}
            onOpenArchiveItem={onOpenArchiveItem}
          />
        </aside>
      </div>
    </article>
  );
}

function CollectionMetaList({
  collections,
  onOpenCollection,
}: {
  collections: ItemDetail["collections"];
  onOpenCollection?: (collectionId: string) => void;
}) {
  if (collections.length === 0) {
    return <span className="detail-muted">none</span>;
  }

  return (
    <div className="metadata-chip-row">
      {collections.map((collection) => (
        <a
          className="metadata-chip metadata-chip--link"
          href={`/collections/${encodeURIComponent(collection.id)}`}
          key={collection.id}
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
          {collection.name}
        </a>
      ))}
    </div>
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

function DownloadAction({ item }: { item: ItemDetail }) {
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
  archiveContext,
  backLabel,
  onBack,
}: {
  archiveContext: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="item-detail__topbar" aria-label="archive detail context">
      <button className="text-button" type="button" onClick={onBack}>
        {backLabel}
      </button>
      <div className="item-detail__topbar-context">
        <span>archive detail</span>
        <span>{archiveContext}</span>
      </div>
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
      <div className="collection-attach__fields">
        <label>
          <span>collection</span>
          <select
            disabled={pending || availableOptions.length === 0}
            onChange={(event) => setCollectionId(event.target.value)}
            value={collectionId}
          >
            <option value="">choose collection</option>
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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

function renderHero(item: ItemDetail) {
  if (item.type === "image" && item.content.image?.fileRef) {
    return <img className="item-detail__hero-image" src={item.content.image.fileRef} alt={item.title ?? ""} />;
  }

  if (item.type === "caption") {
    return <p className="item-detail__text-hero">{item.content.caption?.body ?? "Caption body unavailable."}</p>;
  }

  if (item.type === "note") {
    return <p className="item-detail__text-hero">{item.content.note?.body ?? "Note body unavailable."}</p>;
  }

  if (item.type === "link") {
    return (
      <div className="item-detail__link-hero">
        <span className="detail-muted">link</span>
        <p>{item.content.link?.url ?? "Link URL unavailable."}</p>
      </div>
    );
  }

  return <div className="item-detail__media-placeholder">image pending</div>;
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

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-section" aria-labelledby={`detail-${slug(title)}`}>
      <div className="detail-section__header">
        <h2 id={`detail-${slug(title)}`}>{title}</h2>
        {meta ? <span className="detail-section__meta">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function ReadableBlock({ value, fallback }: { value: string | null; fallback: string }) {
  if (!value) {
    return <DetailEmptyState label={fallback} />;
  }

  return <p className="detail-readable">{value}</p>;
}

function DetailEmptyState({ label }: { label: string }) {
  return <div className="detail-empty">{label}</div>;
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
