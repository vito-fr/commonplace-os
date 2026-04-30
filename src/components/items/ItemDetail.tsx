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

type CampaignOption = {
  id: string;
  label: string;
  phase: string | null;
  alreadyAttached: boolean;
};

type RelationshipCreateInput = {
  toId: string;
  note: string | null;
};

type RetirementInput = {
  replacementId: string;
};

type CollectionAttachInput = {
  collectionId: string;
};

type CampaignRole = "primary" | "supporting" | "reference";

type CampaignAttachInput = {
  campaignId: string;
  role: CampaignRole;
  rightsOverrideNote: string | null;
};

type ItemDetailRelationship = ItemDetail["relationships"][number];

export type ItemDetailViewProps = {
  item: ItemDetail | null;
  loading: boolean;
  error: string | null;
  archiveContext: string;
  onBack: () => void;
  onOpenRelatedItem?: (itemId: string) => void;
  onChangeStatus?: (nextStatus: ItemStatus) => void;
  statusActionPending?: boolean;
  statusActionError?: string | null;
  onRetireWithReplacement?: (input: RetirementInput) => Promise<void> | void;
  retirementActionPending?: boolean;
  retirementActionError?: string | null;
  retirementTargetOptions?: RelationshipTargetOption[];
  onCreateRelationship?: (input: RelationshipCreateInput) => Promise<void> | void;
  relationshipActionPending?: boolean;
  relationshipActionError?: string | null;
  relationshipTargetOptions?: RelationshipTargetOption[];
  onAttachCollection?: (input: CollectionAttachInput) => Promise<void> | void;
  collectionActionPending?: boolean;
  collectionActionError?: string | null;
  collectionOptions?: CollectionOption[];
  onAttachCampaign?: (input: CampaignAttachInput) => Promise<void> | void;
  campaignActionPending?: boolean;
  campaignActionError?: string | null;
  campaignOptions?: CampaignOption[];
};

export function ItemDetailView({
  item,
  loading,
  error,
  archiveContext,
  onBack,
  onOpenRelatedItem,
  onChangeStatus,
  statusActionPending = false,
  statusActionError = null,
  onRetireWithReplacement,
  retirementActionPending = false,
  retirementActionError = null,
  retirementTargetOptions = [],
  onCreateRelationship,
  relationshipActionPending = false,
  relationshipActionError = null,
  relationshipTargetOptions = [],
  onAttachCollection,
  collectionActionPending = false,
  collectionActionError = null,
  collectionOptions = [],
  onAttachCampaign,
  campaignActionPending = false,
  campaignActionError = null,
  campaignOptions = [],
}: ItemDetailViewProps) {
  if (loading) {
    return (
      <section className="item-detail item-detail--loading" aria-busy="true">
        <DetailTopBar archiveContext={archiveContext} onBack={onBack} />
        <div className="item-detail__loading">Loading item.</div>
      </section>
    );
  }

  if (error || !item) {
    return (
      <section className="item-detail">
        <DetailTopBar archiveContext={archiveContext} onBack={onBack} />
        <p className="proof-empty">{error ?? "Item could not be loaded."}</p>
      </section>
    );
  }

  const showsLifecycleActions = hasLifecycleActions(
    item.status,
    statusActionError,
    retirementActionError,
  );

  return (
    <article className="item-detail" aria-labelledby="item-detail-title">
      <DetailTopBar archiveContext={archiveContext} onBack={onBack} />

      <div className="item-detail__layout">
        <div className="item-detail__main">
          <section className="item-detail__hero" aria-label="item preview">
            {renderHero(item)}
          </section>

          <DetailSectionGroup title="Content" meta="description, summary, tags">
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
          </DetailSectionGroup>

          <DetailSectionGroup title="Connections" meta="relationships, collections, campaigns">
          <Section title="Relationships" meta={formatCount(item.relationships.length, "relationship", "relationships")}>
            <DetailActionGroup id="detail-action-relationship" title="Add relationship" meta="reference another item">
              <RelationshipCreateForm
                currentItemId={item.id}
                error={relationshipActionError}
                onCreateRelationship={onCreateRelationship}
                pending={relationshipActionPending}
                targetOptions={relationshipTargetOptions}
              />
            </DetailActionGroup>
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
            ) : (
              <DetailEmptyState label="No relationships yet." />
            )}
          </Section>

          <Section title="Collections" meta={formatCount(item.collections.length, "membership", "memberships")}>
            <DetailActionGroup id="detail-action-collection" title="Add to collection" meta="organize this item">
              <CollectionAttachForm
                error={collectionActionError}
                onAttachCollection={onAttachCollection}
                options={collectionOptions}
                pending={collectionActionPending}
              />
            </DetailActionGroup>
            {item.collections.length > 0 ? (
              <div className="tag-row">
                {item.collections.map((collection) => (
                  <span className="tag-chip" key={collection.id}>
                    {collection.name}
                  </span>
                ))}
              </div>
            ) : (
              <DetailEmptyState label="Not in any collections yet." />
            )}
          </Section>

          <Section title="Campaign attachments" meta={formatCount(item.campaignAttachments.length, "attachment", "attachments")}>
            <DetailActionGroup id="detail-action-campaign" title="Attach to campaign" meta="campaign memory">
              <CampaignAttachForm
                error={campaignActionError}
                onAttachCampaign={onAttachCampaign}
                options={campaignOptions}
                pending={campaignActionPending}
                rightsStatus={item.rightsStatus}
              />
            </DetailActionGroup>
            {item.campaignAttachments.length > 0 ? (
              <div className="detail-list">
                {item.campaignAttachments.map((attachment) => (
                  <div className="detail-list__row" key={attachment.id}>
                    <span className="detail-list__label">{attachment.role ?? "attached"}</span>
                    <span>{attachment.campaignTitle ?? attachment.campaignId}</span>
                    {attachment.phase ? <span className="detail-muted">{attachment.phase}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <DetailEmptyState label="Not attached to any campaigns yet." />
            )}
          </Section>
          </DetailSectionGroup>

          <DetailSectionGroup title="History" meta="annotations and events">
          <Section title="AI annotations" meta={formatCount(item.aiAnnotations.length, "annotation", "annotations")}>
            {item.aiAnnotations.length > 0 ? (
              <div className="annotation-list">
                {item.aiAnnotations.map((annotation) => (
                  <article className={`annotation-row annotation-row--${annotation.reviewStatus}`} key={annotation.id}>
                    <div className="annotation-row__header">
                      <span>{annotation.fieldName}</span>
                      <ProvenanceMark annotation={annotation} />
                    </div>
                    <pre>{formatPayload(annotation.payload)}</pre>
                  </article>
                ))}
              </div>
            ) : (
              <DetailEmptyState label="No AI annotations yet." />
            )}
          </Section>

          <Section title="Event timeline" meta={formatCount(item.events.length, "event", "events")}>
            {item.events.length > 0 ? (
              <div className="detail-list">
                {item.events.map((event) => (
                  <div className="detail-list__row" key={event.id}>
                    <span className="detail-list__label">{event.eventType}</span>
                    <span>{event.actor}</span>
                    <span className="detail-muted">{event.createdAt}</span>
                  </div>
                ))}
              </div>
            ) : (
              <DetailEmptyState label="No event history yet." />
            )}
          </Section>
          </DetailSectionGroup>
        </div>

        <aside className="item-detail__metadata" aria-label="item facts">
          <p className="proof-kicker">item</p>
          <h1 id="item-detail-title">{item.title ?? `${item.type} item`}</h1>
          <div className="item-detail__signal-row">
            <TypeIndicator type={item.type} />
            <span aria-hidden="true">·</span>
            <StatusIndicator status={item.status} />
            <span aria-hidden="true">·</span>
            <SourceMark source={item.source?.kind ?? "manual"} />
          </div>
          <ItemWorkSummary item={item} />
          <DetailActionMap showLifecycle={showsLifecycleActions} />
          {showsLifecycleActions ? (
            <div className="item-detail__action-stack">
              <DetailActionGroup id="detail-action-lifecycle" title="Lifecycle" meta="status changes">
                <LifecycleControls
                  currentStatus={item.status}
                  pending={statusActionPending}
                  error={statusActionError}
                  onChangeStatus={onChangeStatus}
                />
                <RetireWithReplacementForm
                  currentItemId={item.id}
                  currentStatus={item.status}
                  error={retirementActionError}
                  onRetireWithReplacement={onRetireWithReplacement}
                  pending={retirementActionPending}
                  targetOptions={retirementTargetOptions}
                />
              </DetailActionGroup>
            </div>
          ) : null}
          <DetailSectionMap item={item} />
          <dl>
            <Metadata label="ID" value={item.id} />
            <Metadata label="Source" value={item.source?.label ?? item.source?.identifier ?? item.source?.kind ?? "manual"} />
            <Metadata label="Created" value={item.createdAt} />
            <Metadata label="Updated" value={item.updatedAt} />
            <Metadata label="Privacy" value={item.privacyLevel ?? "inherited"} />
            <Metadata label="Rights" value={item.rightsStatus} />
            <Metadata label="Rights reviewed" value={item.rightsReviewedAt ?? "not reviewed"} />
          </dl>
        </aside>
      </div>
    </article>
  );
}

function ItemWorkSummary({ item }: { item: ItemDetail }) {
  return (
    <dl className="item-detail__work-summary" aria-label="item work state">
      <div>
        <dt>lifecycle</dt>
        <dd>{item.status}</dd>
      </div>
      <div>
        <dt>rights</dt>
        <dd>{item.rightsStatus}</dd>
      </div>
      <div>
        <dt>campaigns</dt>
        <dd>{formatCount(item.campaignAttachments.length, "attachment", "attachments")}</dd>
      </div>
      <div>
        <dt>relationships</dt>
        <dd>{formatCount(item.relationships.length, "relationship", "relationships")}</dd>
      </div>
    </dl>
  );
}

function DetailActionMap({ showLifecycle }: { showLifecycle: boolean }) {
  const actions = [
    showLifecycle
      ? {
          href: "#detail-action-lifecycle",
          label: "lifecycle",
        }
      : null,
    {
      href: "#detail-action-relationship",
      label: "relationship",
    },
    {
      href: "#detail-action-collection",
      label: "collection",
    },
    {
      href: "#detail-action-campaign",
      label: "campaign",
    },
  ].filter((action): action is { href: string; label: string } => action !== null);

  return (
    <nav className="item-detail__action-map" aria-label="item actions">
      <span className="item-detail__action-map-title">actions</span>
      <div className="item-detail__action-map-links">
        {actions.map((action) => (
          <a href={action.href} key={action.href}>
            {action.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function DetailTopBar({
  archiveContext,
  onBack,
}: {
  archiveContext: string;
  onBack: () => void;
}) {
  return (
    <div className="item-detail__topbar" aria-label="item detail context">
      <button className="text-button" type="button" onClick={onBack}>
        Back to archive
      </button>
      <div className="item-detail__topbar-context">
        <span>item detail</span>
        <span>{archiveContext}</span>
      </div>
    </div>
  );
}

function DetailSectionMap({ item }: { item: ItemDetail }) {
  const sections = [
    {
      href: "#detail-description",
      label: "description",
      meta: item.description ? "set" : "empty",
    },
    {
      href: "#detail-summary",
      label: "summary",
      meta: item.summary ? "set" : "empty",
    },
    {
      href: "#detail-relationships",
      label: "relationships",
      meta: String(item.relationships.length),
    },
    {
      href: "#detail-collections",
      label: "collections",
      meta: String(item.collections.length),
    },
    {
      href: "#detail-campaign-attachments",
      label: "campaigns",
      meta: String(item.campaignAttachments.length),
    },
    {
      href: "#detail-event-timeline",
      label: "history",
      meta: String(item.events.length),
    },
  ];

  return (
    <nav className="item-detail__section-map" aria-label="item detail sections">
      <span className="item-detail__section-map-title">sections</span>
      <div className="item-detail__section-map-links">
        {sections.map((section) => (
          <a href={section.href} key={section.href}>
            <span>{section.label}</span>
            <span>{section.meta}</span>
          </a>
        ))}
      </div>
    </nav>
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
  const targetMeta = [
    relationship.otherItemType,
    relationship.otherItemStatus,
    relationship.otherItemId,
  ].join(" · ");

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

function RetireWithReplacementForm({
  currentItemId,
  currentStatus,
  error,
  onRetireWithReplacement,
  pending,
  targetOptions,
}: {
  currentItemId: string;
  currentStatus: ItemStatus;
  error: string | null;
  onRetireWithReplacement?: (input: RetirementInput) => Promise<void> | void;
  pending: boolean;
  targetOptions: RelationshipTargetOption[];
}) {
  const [replacementId, setReplacementId] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const availableOptions = targetOptions.filter((option) => option.id !== currentItemId);

  if (!canRetireWithReplacement(currentStatus)) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedReplacementId = replacementId.trim();

    if (!normalizedReplacementId) {
      setLocalError("Replacement item is required.");
      return;
    }

    if (normalizedReplacementId === currentItemId) {
      setLocalError("Choose a different item.");
      return;
    }

    if (!onRetireWithReplacement) {
      setLocalError("Retiring with replacement requires live archive mode.");
      return;
    }

    setLocalError(null);

    try {
      await onRetireWithReplacement({ replacementId: normalizedReplacementId });
      setReplacementId("");
    } catch {
      // The parent owns the persisted write error message.
    }
  };

  return (
    <form className="retirement-link" aria-label="retire with replacement" onSubmit={submit}>
      <label>
        <span>replacement</span>
        <select
          disabled={pending || availableOptions.length === 0}
          onChange={(event) => setReplacementId(event.target.value)}
          value={replacementId}
        >
          <option value="">choose replacement</option>
          {availableOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="status-action status-action--retire"
        disabled={pending || availableOptions.length === 0}
        type="submit"
      >
        {pending ? "Retiring" : "Retire with replacement"}
      </button>
      {availableOptions.length === 0 ? (
        <p className="detail-muted">No replacement candidates available.</p>
      ) : null}
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
  );
}

function CampaignAttachForm({
  error,
  onAttachCampaign,
  options,
  pending,
  rightsStatus,
}: {
  error: string | null;
  onAttachCampaign?: (input: CampaignAttachInput) => Promise<void> | void;
  options: CampaignOption[];
  pending: boolean;
  rightsStatus: ItemDetail["rightsStatus"];
}) {
  const [campaignId, setCampaignId] = useState("");
  const [role, setRole] = useState<CampaignRole>("supporting");
  const [overrideNote, setOverrideNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const availableOptions = options.filter((option) => !option.alreadyAttached);
  const warningState = getRightsWarningState(rightsStatus, role);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCampaignId = campaignId.trim();
    const normalizedOverrideNote = overrideNote.trim();

    if (!normalizedCampaignId) {
      setLocalError("Campaign is required.");
      return;
    }

    if (warningState === "blocking") {
      setLocalError("This rights status blocks campaign attachment.");
      return;
    }

    if (warningState === "advisory" && !normalizedOverrideNote) {
      setLocalError("Rights override note is required.");
      return;
    }

    if (!onAttachCampaign) {
      setLocalError("Campaign attachment requires live archive mode.");
      return;
    }

    setLocalError(null);

    try {
      await onAttachCampaign({
        campaignId: normalizedCampaignId,
        role,
        rightsOverrideNote: warningState === "advisory" ? normalizedOverrideNote : null,
      });
      setCampaignId("");
      setRole("supporting");
      setOverrideNote("");
    } catch {
      // The parent owns the persisted write error message.
    }
  };

  return (
    <form className="campaign-attach" aria-label="attach to campaign" onSubmit={submit}>
      <div className="campaign-attach__fields">
        <label>
          <span>campaign</span>
          <select
            disabled={pending || availableOptions.length === 0}
            onChange={(event) => setCampaignId(event.target.value)}
            value={campaignId}
          >
            <option value="">choose campaign</option>
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>role</span>
          <select
            disabled={pending || availableOptions.length === 0}
            onChange={(event) => setRole(event.target.value as CampaignRole)}
            value={role}
          >
            <option value="supporting">supporting</option>
            <option value="primary">primary</option>
            <option value="reference">reference</option>
          </select>
        </label>
        {warningState === "advisory" ? (
          <label>
            <span>rights override note</span>
            <textarea
              disabled={pending}
              onChange={(event) => setOverrideNote(event.target.value)}
              placeholder="required"
              rows={2}
              value={overrideNote}
            />
          </label>
        ) : null}
      </div>
      <RightsWarning rightsStatus={rightsStatus} role={role} state={warningState} />
      <button
        className="status-action"
        disabled={pending || availableOptions.length === 0 || warningState === "blocking"}
        type="submit"
      >
        {pending ? "Attaching" : "Attach to campaign"}
      </button>
      {availableOptions.length === 0 ? (
        <p className="detail-muted">No campaigns available to attach.</p>
      ) : null}
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
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
      setLocalError("Collection attachment requires live archive mode.");
      return;
    }

    setLocalError(null);

    try {
      await onAttachCollection({ collectionId: normalizedCollectionId });
      setCollectionId("");
    } catch {
      // The parent owns the persisted write error message.
    }
  };

  return (
    <form className="collection-attach" aria-label="attach to collection" onSubmit={submit}>
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
        {pending ? "Attaching" : "Attach to collection"}
      </button>
      {availableOptions.length === 0 ? (
        <p className="detail-muted">No collections available to attach.</p>
      ) : null}
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
  );
}

function RightsWarning({
  rightsStatus,
  role,
  state,
}: {
  rightsStatus: ItemDetail["rightsStatus"];
  role: CampaignRole;
  state: "none" | "advisory" | "blocking";
}) {
  if (state === "none") {
    return null;
  }

  if (state === "blocking") {
    return (
      <div className="rights-warning rights-warning--blocking" role="alert">
        <span className="rights-warning__title">Rights block</span>
        <p>{rightsStatus} items cannot be attached to campaigns.</p>
      </div>
    );
  }

  return (
    <div className="rights-warning rights-warning--advisory">
      <span className="rights-warning__title">Rights warning</span>
      <p>
        {rightsStatus} requires an override note before attaching as {role}.
      </p>
    </div>
  );
}

function getRightsWarningState(
  rightsStatus: ItemDetail["rightsStatus"],
  role: CampaignRole,
): "none" | "advisory" | "blocking" {
  if (rightsStatus === "restricted" || rightsStatus === "expired") {
    return "blocking";
  }

  if (rightsStatus === "unknown") {
    return "advisory";
  }

  if (rightsStatus === "reference_only" && (role === "primary" || role === "supporting")) {
    return "advisory";
  }

  return "none";
}

function renderHero(item: ItemDetail) {
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

  if (item.type === "campaign") {
    return (
      <div className="item-detail__campaign-hero">
        <span>{item.content.campaign?.phase ?? "campaign"}</span>
        <p>{item.title ?? "Untitled campaign"}</p>
      </div>
    );
  }

  return <div className="item-detail__media-placeholder">image pending</div>;
}

function DetailSectionGroup({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <div className="detail-section-group">
      <div className="detail-section-group__header">
        <h2>{title}</h2>
        <span>{meta}</span>
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

function DetailActionGroup({
  id,
  title,
  meta,
  children,
}: {
  id?: string;
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <div className="detail-action-group" id={id}>
      <div className="detail-action-group__header">
        <span className="detail-action-group__title">{title}</span>
        <span className="detail-action-group__meta">{meta}</span>
      </div>
      {children}
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
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
      setLocalError("Related item ID is required.");
      return;
    }

    if (normalizedToId === currentItemId) {
      setLocalError("Choose a different item.");
      return;
    }

    if (!onCreateRelationship) {
      setLocalError("Relationship creation requires live archive mode.");
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
      // The parent owns the persisted write error message.
    }
  };

  return (
    <form className="relationship-create" aria-label="add relationship" onSubmit={submit}>
      <div className="relationship-create__fields">
        <label>
          <span>related item</span>
          <input
            autoComplete="off"
            disabled={pending}
            list={targetOptions.length > 0 ? dataListId : undefined}
            onChange={(event) => setToId(event.target.value)}
            placeholder="item id"
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
        {pending ? "Adding" : "Add relationship"}
      </button>
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
  );
}

function LifecycleControls({
  currentStatus,
  pending,
  error,
  onChangeStatus,
}: {
  currentStatus: ItemStatus;
  pending: boolean;
  error: string | null;
  onChangeStatus?: (nextStatus: ItemStatus) => void;
}) {
  const actions = getStatusActions(currentStatus);

  if (actions.length === 0 && !error) {
    return null;
  }

  return (
    <div className="item-detail__status-actions" aria-label="status actions">
      {actions.map((action) => (
        <button
          className={action.tone === "retire" ? "status-action status-action--retire" : "status-action"}
          disabled={pending || !onChangeStatus}
          key={action.status}
          type="button"
          onClick={() => onChangeStatus?.(action.status)}
        >
          {pending ? "Updating" : action.label}
        </button>
      ))}
      {error ? <p className="detail-error">{error}</p> : null}
    </div>
  );
}

function getStatusActions(status: ItemStatus): Array<{ status: ItemStatus; label: string; tone?: "retire" }> {
  if (status === "inbox") {
    return [
      { status: "triaged", label: "Mark triaged" },
      { status: "retired", label: "Retire", tone: "retire" },
    ];
  }

  if (status === "triaged") {
    return [
      { status: "active", label: "Promote to active" },
      { status: "retired", label: "Retire", tone: "retire" },
    ];
  }

  if (status === "active" || status === "archived") {
    return [{ status: "retired", label: "Retire", tone: "retire" }];
  }

  return [];
}

function canRetireWithReplacement(status: ItemStatus) {
  return status === "inbox" || status === "triaged" || status === "active" || status === "archived";
}

function hasLifecycleActions(
  status: ItemStatus,
  statusError: string | null,
  retirementError: string | null,
) {
  return (
    getStatusActions(status).length > 0 ||
    canRetireWithReplacement(status) ||
    Boolean(statusError || retirementError)
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

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
