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

export type ItemDetailViewProps = {
  item: ItemDetail | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
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
  onBack,
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
        <button className="text-button" type="button" onClick={onBack}>
          Back to archive proof
        </button>
        <div className="item-detail__loading">Loading item detail.</div>
      </section>
    );
  }

  if (error || !item) {
    return (
      <section className="item-detail">
        <button className="text-button" type="button" onClick={onBack}>
          Back to archive proof
        </button>
        <p className="proof-empty">{error ?? "Item detail is unavailable."}</p>
      </section>
    );
  }

  return (
    <article className="item-detail" aria-labelledby="item-detail-title">
      <button className="text-button" type="button" onClick={onBack}>
        Back to archive proof
      </button>

      <div className="item-detail__layout">
        <div className="item-detail__main">
          <section className="item-detail__hero" aria-label="item hero">
            {renderHero(item)}
          </section>

          <Section title="Description">
            <ReadableBlock value={item.description} fallback="No canonical description." />
          </Section>

          <Section title="Summary">
            <ReadableBlock value={item.summary} fallback="No canonical summary." />
          </Section>

          <Section title="Tags">
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
              <p className="detail-muted">No tags.</p>
            )}
          </Section>

          <Section title="Relationships">
            <RelationshipCreateForm
              currentItemId={item.id}
              error={relationshipActionError}
              onCreateRelationship={onCreateRelationship}
              pending={relationshipActionPending}
              targetOptions={relationshipTargetOptions}
            />
            {item.relationships.length > 0 ? (
              <div className="detail-list">
                {item.relationships.map((relationship) => (
                  <div className="detail-list__row" key={relationship.id}>
                    <span className="detail-list__label">{relationship.type}</span>
                    <span>
                      {relationship.direction === "outgoing" ? "to" : "from"}{" "}
                      {relationship.otherItemTitle ?? relationship.otherItemId}
                    </span>
                    <span className="detail-muted">{relationship.assertedBy}</span>
                    {relationship.note ? <p>{relationship.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="detail-muted">No relationships.</p>
            )}
          </Section>

          <Section title="Collections">
            <CollectionAttachForm
              error={collectionActionError}
              onAttachCollection={onAttachCollection}
              options={collectionOptions}
              pending={collectionActionPending}
            />
            {item.collections.length > 0 ? (
              <div className="tag-row">
                {item.collections.map((collection) => (
                  <span className="tag-chip" key={collection.id}>
                    {collection.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="detail-muted">No collection memberships.</p>
            )}
          </Section>

          <Section title="Campaign attachments">
            <CampaignAttachForm
              error={campaignActionError}
              onAttachCampaign={onAttachCampaign}
              options={campaignOptions}
              pending={campaignActionPending}
              rightsStatus={item.rightsStatus}
            />
            {item.campaignAttachments.length > 0 ? (
              <div className="detail-list">
                {item.campaignAttachments.map((attachment) => (
                  <div className="detail-list__row" key={attachment.id}>
                    <span className="detail-list__label">{attachment.role ?? "used_in"}</span>
                    <span>{attachment.campaignTitle ?? attachment.campaignId}</span>
                    {attachment.phase ? <span className="detail-muted">{attachment.phase}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="detail-muted">No campaign attachments.</p>
            )}
          </Section>

          <Section title="AI annotations">
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
              <p className="detail-muted">No AI annotations.</p>
            )}
          </Section>

          <Section title="Event timeline">
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
              <p className="detail-muted">No events.</p>
            )}
          </Section>
        </div>

        <aside className="item-detail__metadata" aria-label="item metadata">
          <p className="proof-kicker">item detail</p>
          <h1 id="item-detail-title">{item.title ?? `${item.type} item`}</h1>
          <div className="item-detail__signal-row">
            <TypeIndicator type={item.type} />
            <span aria-hidden="true">·</span>
            <StatusIndicator status={item.status} />
            <span aria-hidden="true">·</span>
            <SourceMark source={item.source?.kind ?? "manual"} />
          </div>
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
      setLocalError("Retirement linkage requires PocketBase reader mode.");
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
          <option value="">select replacement</option>
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
        <p className="detail-muted">No available replacements.</p>
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
      setLocalError("Campaign attachment requires PocketBase reader mode.");
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
            <option value="">select campaign</option>
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
        <p className="detail-muted">No available campaigns.</p>
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
      setLocalError("Collection attachment requires PocketBase reader mode.");
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
            <option value="">select collection</option>
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
        <p className="detail-muted">No available collections.</p>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detail-section" aria-labelledby={`detail-${slug(title)}`}>
      <h2 id={`detail-${slug(title)}`}>{title}</h2>
      {children}
    </section>
  );
}

function ReadableBlock({ value, fallback }: { value: string | null; fallback: string }) {
  return <p className={value ? "detail-readable" : "detail-muted"}>{value ?? fallback}</p>;
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
      setLocalError("Target item ID is required.");
      return;
    }

    if (normalizedToId === currentItemId) {
      setLocalError("Choose a different item.");
      return;
    }

    if (!onCreateRelationship) {
      setLocalError("Relationship creation requires PocketBase reader mode.");
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
    <form className="relationship-create" aria-label="add reference relationship" onSubmit={submit}>
      <div className="relationship-create__fields">
        <label>
          <span>references</span>
          <input
            autoComplete="off"
            disabled={pending}
            list={targetOptions.length > 0 ? dataListId : undefined}
            onChange={(event) => setToId(event.target.value)}
            placeholder="target item id"
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
        {pending ? "Adding" : "Add reference"}
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
