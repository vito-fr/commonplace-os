import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { gsap } from "../../motion/MotionShell";
import type { ItemStatus, ItemType } from "../atoms";
import type { ItemCardFilters, ItemSourceFilter } from "../../data/itemCardReader";

export type PillNavPanel = "index" | "views" | "filters" | "import" | "information";

type ArchiveStatusFilter = ItemStatus | "all";
type ArchiveTypeFilter = ItemType | "all";
type ArchiveSourceFilter = ItemSourceFilter | "all";

export type PillNavProps = {
  activePanel: PillNavPanel | null;
  onPanelChange: (panel: PillNavPanel | null) => void;
  filters: ItemCardFilters;
  loading: boolean;
  itemCount: number;
  readError: string | null;
  isPocketBaseMode: boolean;
  captureError: string | null;
  captureNotice: string | null;
  pendingCapture: boolean;
  onCapture: (body: string) => Promise<void> | void;
  onClearFilters: () => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  statusOptions: ArchiveStatusFilter[];
  typeOptions: ArchiveTypeFilter[];
  sourceOptions: ArchiveSourceFilter[];
};

const PILL_INACTIVE_WIDTH = 160;
const PILL_ACTIVE_WIDTH = 460;

const pills: Array<{ key: PillNavPanel; label: string }> = [
  { key: "index", label: "Index" },
  { key: "views", label: "Views" },
  { key: "filters", label: "Filters" },
  { key: "import", label: "Import" },
  { key: "information", label: "Info" },
];

export function PillNav(props: PillNavProps) {
  const { activePanel, onPanelChange } = props;

  const labelRefs = useRef<Partial<Record<PillNavPanel, HTMLDivElement | null>>>({});
  const blobRefs = useRef<Partial<Record<PillNavPanel, HTMLDivElement | null>>>({});
  const contentRefs = useRef<Partial<Record<PillNavPanel, HTMLDivElement | null>>>({});
  const previousPanelRef = useRef<PillNavPanel | null>(activePanel);
  const [renderedPanel, setRenderedPanel] = useState<PillNavPanel | null>(activePanel);

  useEffect(() => {
    const previous = previousPanelRef.current;
    previousPanelRef.current = activePanel;

    if (previous === activePanel) {
      return;
    }

    if (activePanel) {
      setRenderedPanel(activePanel);
      const label = labelRefs.current[activePanel];
      const blob = blobRefs.current[activePanel];
      if (label) {
        gsap.to(label, { width: PILL_ACTIVE_WIDTH, duration: 0.34, ease: "power3.out" });
      }
      if (blob) {
        gsap.to(blob, { width: PILL_ACTIVE_WIDTH, duration: 0.34, ease: "power3.out" });
      }
      requestAnimationFrame(() => {
        const content = contentRefs.current[activePanel];
        if (content) {
          gsap.fromTo(
            content,
            { opacity: 0, x: -6 },
            { opacity: 1, x: 0, duration: 0.26, delay: 0.08, ease: "power2.out" },
          );
        }
      });
    }

    if (previous && previous !== activePanel) {
      const label = labelRefs.current[previous];
      const blob = blobRefs.current[previous];
      const content = contentRefs.current[previous];
      if (content) {
        gsap.to(content, { opacity: 0, duration: 0.14, ease: "power2.in" });
      }
      if (label) {
        gsap.to(label, { width: PILL_INACTIVE_WIDTH, duration: 0.26, ease: "power3.in" });
      }
      if (blob) {
        gsap.to(blob, { width: PILL_INACTIVE_WIDTH, duration: 0.26, ease: "power3.in" });
      }
    }

    if (!activePanel && previous) {
      const timeout = window.setTimeout(() => setRenderedPanel(null), 320);
      return () => window.clearTimeout(timeout);
    }
  }, [activePanel]);

  const togglePanel = (key: PillNavPanel) => {
    onPanelChange(activePanel === key ? null : key);
  };

  return (
    <aside className="pill-nav" aria-label="archive controls">
      <svg className="pill-nav__svg" aria-hidden="true" focusable="false">
        <defs>
          <filter id="pill-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 19 -9"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div className="pill-nav__layer pill-nav__layer--blobs" aria-hidden="true">
        {pills.map((p) => (
          <div
            key={p.key}
            ref={(el) => {
              blobRefs.current[p.key] = el;
            }}
            className="pill-blob"
            style={{ width: activePanel === p.key ? PILL_ACTIVE_WIDTH : PILL_INACTIVE_WIDTH }}
          />
        ))}
      </div>

      <div className="pill-nav__layer pill-nav__layer--labels">
        {pills.map((p) => {
          const isActive = activePanel === p.key;
          return (
            <div
              key={p.key}
              ref={(el) => {
                labelRefs.current[p.key] = el;
              }}
              className="pill-label"
              data-active={isActive ? "true" : "false"}
              style={{ width: isActive ? PILL_ACTIVE_WIDTH : PILL_INACTIVE_WIDTH }}
            >
              <button
                className="pill-label__button"
                type="button"
                onClick={() => togglePanel(p.key)}
                aria-expanded={isActive}
              >
                <span>{p.label}</span>
                <span className="pill-label__chevron" aria-hidden="true">
                  {isActive ? "−" : "+"}
                </span>
              </button>
              <div
                ref={(el) => {
                  contentRefs.current[p.key] = el;
                }}
                className="pill-label__content"
                style={{ opacity: isActive ? 1 : 0 }}
              >
                {renderedPanel === p.key ? <PanelContent panel={p.key} {...props} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function PanelContent({
  panel,
  filters,
  loading,
  onSourceChange,
  onStatusChange,
  onTypeChange,
  statusOptions,
  typeOptions,
  sourceOptions,
  isPocketBaseMode,
  captureError,
  captureNotice,
  onCapture,
  pendingCapture,
  onClearFilters,
  itemCount,
  readError,
}: { panel: PillNavPanel } & PillNavProps) {
  if (panel === "index") {
    const resultLabel = readError
      ? "load error"
      : loading
        ? "loading"
        : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
    return (
      <PanelLayout>
        <PanelOption active onClick={onClearFilters}>
          All items
        </PanelOption>
        <PanelOption muted>Collections</PanelOption>
        <PanelMeta>{resultLabel}</PanelMeta>
      </PanelLayout>
    );
  }

  if (panel === "views") {
    return (
      <PanelLayout>
        <PanelOption active>Masonry</PanelOption>
        <PanelOption muted>Gallery</PanelOption>
        <PanelOption muted>List</PanelOption>
        <PanelOption muted>Graph</PanelOption>
      </PanelLayout>
    );
  }

  if (panel === "filters") {
    return (
      <PanelLayout>
        <FilterRow
          label="state"
          value={filters.status ?? "all"}
          onChange={(value) => onStatusChange(value as ArchiveStatusFilter)}
          options={statusOptions}
          format={(value) => (value === "all" ? "any state" : value)}
          loading={loading}
        />
        <FilterRow
          label="kind"
          value={filters.type ?? "all"}
          onChange={(value) => onTypeChange(value as ArchiveTypeFilter)}
          options={typeOptions}
          format={(value) => (value === "all" ? "any kind" : value)}
          loading={loading}
        />
        <FilterRow
          label="from"
          value={filters.source ?? "all"}
          onChange={(value) => onSourceChange(value as ArchiveSourceFilter)}
          options={sourceOptions}
          format={(value) => (value === "all" ? "any origin" : value.replace("_", " "))}
          loading={loading}
        />
      </PanelLayout>
    );
  }

  if (panel === "import") {
    return (
      <PanelLayout>
        {isPocketBaseMode ? (
          <CaptureForm
            error={captureError}
            notice={captureNotice}
            pending={pendingCapture}
            onCapture={onCapture}
          />
        ) : (
          <PanelMeta>Import requires live archive mode.</PanelMeta>
        )}
      </PanelLayout>
    );
  }

  return (
    <PanelLayout>
      <p className="pill-panel__copy">
        A working archive for capture, inspection, connection, reuse, and removal.
      </p>
      <PanelMeta>⌘K search · M color mode · Esc close</PanelMeta>
    </PanelLayout>
  );
}

function PanelLayout({ children }: { children: ReactNode }) {
  return <div className="pill-panel">{children}</div>;
}

function PanelOption({
  active = false,
  muted = false,
  children,
  onClick,
}: {
  active?: boolean;
  muted?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        className={`pill-panel__option${active ? " pill-panel__option--active" : ""}${muted ? " pill-panel__option--muted" : ""}`}
        type="button"
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      className={`pill-panel__option${active ? " pill-panel__option--active" : ""}${muted ? " pill-panel__option--muted" : ""}`}
    >
      {children}
    </span>
  );
}

function PanelMeta({ children }: { children: ReactNode }) {
  return <span className="pill-panel__meta">{children}</span>;
}

function FilterRow<T extends string>({
  label,
  value,
  onChange,
  options,
  format,
  loading,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: T[];
  format: (option: T) => string;
  loading: boolean;
}) {
  return (
    <label className="pill-panel__filter">
      <span>{label}</span>
      <select
        disabled={loading}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CaptureForm({
  error,
  notice,
  pending,
  onCapture,
}: {
  error: string | null;
  notice: string | null;
  pending: boolean;
  onCapture: (body: string) => Promise<void> | void;
}) {
  const [body, setBody] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = body.trim();

    if (!trimmed) {
      setLocalError("Text or URL is required.");
      return;
    }

    setLocalError(null);

    try {
      await onCapture(trimmed);
      setBody("");
    } catch {
      // Parent owns the persisted write error message.
    }
  };

  return (
    <form className="pill-panel__capture" onSubmit={submit}>
      <textarea
        aria-label="text or URL"
        disabled={pending}
        rows={2}
        placeholder="paste URL or write text"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="pill-panel__capture-actions">
        <button className="pill-panel__option" type="submit" disabled={pending}>
          {pending ? "Importing" : "Add"}
        </button>
        {notice ? <span className="pill-panel__meta">{notice}</span> : null}
      </div>
      {localError || error ? <p className="pill-panel__error">{localError ?? error}</p> : null}
    </form>
  );
}
