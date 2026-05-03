import { type CSSProperties, type FormEvent, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import type { ItemStatus, ItemType } from "../atoms";
import type { ItemCardFilters, ItemSourceFilter } from "../../data/itemCardReader";

export type PillNavPanel = "index" | "views" | "filters" | "import" | "information";

type ArchiveStatusFilter = ItemStatus | "all";
type ArchiveTypeFilter = ItemType | "all";
type ArchiveSourceFilter = ItemSourceFilter | "all";
type FilterFamily = "state" | "kind" | "origin";
type NavCellStyle = CSSProperties & { "--cell-index": number };

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

export function PillNav(props: PillNavProps) {
  const {
    activePanel,
    captureError,
    captureNotice,
    filters,
    isPocketBaseMode,
    itemCount,
    loading,
    onCapture,
    onClearFilters,
    onPanelChange,
    onSourceChange,
    onStatusChange,
    onTypeChange,
    pendingCapture,
    readError,
    sourceOptions,
    statusOptions,
    typeOptions,
  } = props;
  const [activeFilterFamily, setActiveFilterFamily] = useState<FilterFamily>("state");

  const togglePanel = (panel: PillNavPanel) => {
    onPanelChange(activePanel === panel ? null : panel);
  };

  const resultLabel = readError
    ? "Load error"
    : loading
      ? "Loading"
      : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const subnavOptionCount =
    activeFilterFamily === "state"
      ? statusOptions.length
      : activeFilterFamily === "kind"
        ? typeOptions.length
        : sourceOptions.length;

  const nav = (
    <header className="pill-nav" aria-label="archive controls">
      <div className="pill-nav__group" aria-label="primary archive controls">
        <button className="nav-cell nav-cell--dot" type="button" onClick={onClearFilters} aria-label="live archive">
          <span className="live-logo-dot" aria-hidden="true" />
        </button>

        <PrimaryCell label="Index" active={activePanel === "index"} onClick={() => togglePanel("index")} />
        <ExpansionCell index={0} visible={activePanel === "index"} onClick={onClearFilters}>
          All items
        </ExpansionCell>
        <ExpansionCell index={1} visible={activePanel === "index"}>{resultLabel}</ExpansionCell>

        <PrimaryCell label="Views" active={activePanel === "views"} onClick={() => togglePanel("views")} />
        <ExpansionCell index={0} visible={activePanel === "views"} active>Masonry</ExpansionCell>
        <ExpansionCell index={1} visible={activePanel === "views"} disabled>Gallery</ExpansionCell>
        <ExpansionCell index={2} visible={activePanel === "views"} disabled>List</ExpansionCell>
        <ExpansionCell index={3} visible={activePanel === "views"} disabled>Graph</ExpansionCell>

        <PrimaryCell label="Filters" active={activePanel === "filters"} onClick={() => togglePanel("filters")} />
        <ExpansionCell
          index={0}
          visible={activePanel === "filters"}
          active={activeFilterFamily === "state"}
          onClick={() => setActiveFilterFamily("state")}
        >
          State
        </ExpansionCell>
        <ExpansionCell
          index={1}
          visible={activePanel === "filters"}
          active={activeFilterFamily === "kind"}
          onClick={() => setActiveFilterFamily("kind")}
        >
          Kind
        </ExpansionCell>
        <ExpansionCell
          index={2}
          visible={activePanel === "filters"}
          active={activeFilterFamily === "origin"}
          onClick={() => setActiveFilterFamily("origin")}
        >
          Origin
        </ExpansionCell>

        <PrimaryCell label="Import" active={activePanel === "import"} onClick={() => togglePanel("import")} />
        <ExpansionCell index={0} visible={activePanel === "import"} wide>
          {isPocketBaseMode ? (
            <CaptureForm
              error={captureError}
              notice={captureNotice}
              pending={pendingCapture}
              onCapture={onCapture}
            />
          ) : (
            "Live mode required"
          )}
        </ExpansionCell>

        <PrimaryCell label="Info" active={activePanel === "information"} onClick={() => togglePanel("information")} />
        <ExpansionCell index={0} visible={activePanel === "information"} wide>
          {resultLabel} · Command K · M
        </ExpansionCell>
      </div>

      <FilterSubnav
        activeFilterFamily={activeFilterFamily}
        filters={filters}
        loading={loading}
        onClearFilters={onClearFilters}
        onSourceChange={onSourceChange}
        onStatusChange={onStatusChange}
        onTypeChange={onTypeChange}
        sourceOptions={sourceOptions}
        statusOptions={statusOptions}
        visibleOptionCount={subnavOptionCount}
        typeOptions={typeOptions}
        visible={activePanel === "filters"}
      />
    </header>
  );

  if (typeof document === "undefined") {
    return nav;
  }

  return createPortal(nav, document.body);
}

function PrimaryCell({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="nav-cell" data-active={active ? "true" : "false"} type="button" onClick={onClick} aria-expanded={active}>
      {label}
    </button>
  );
}

function ExpansionCell({
  active = false,
  children,
  disabled = false,
  index,
  onClick,
  visible,
  wide = false,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  index: number;
  onClick?: () => void;
  visible: boolean;
  wide?: boolean;
}) {
  const style = getCellStyle(index);

  if (onClick) {
    return (
      <button
        className="nav-cell nav-cell--expansion"
        data-active={active ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        data-visible={visible ? "true" : "false"}
        data-wide={wide ? "true" : "false"}
        disabled={!visible || disabled}
        type="button"
        onClick={onClick}
        style={style}
        aria-hidden={!visible}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      className="nav-cell nav-cell--expansion"
      data-active={active ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      data-visible={visible ? "true" : "false"}
      data-wide={wide ? "true" : "false"}
      style={style}
      aria-hidden={!visible}
    >
      {children}
    </span>
  );
}

function FilterSubnav({
  activeFilterFamily,
  filters,
  loading,
  onClearFilters,
  onSourceChange,
  onStatusChange,
  onTypeChange,
  statusOptions,
  typeOptions,
  sourceOptions,
  visible,
  visibleOptionCount,
}: {
  activeFilterFamily: FilterFamily;
  filters: ItemCardFilters;
  loading: boolean;
  onClearFilters: () => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  statusOptions: ArchiveStatusFilter[];
  typeOptions: ArchiveTypeFilter[];
  sourceOptions: ArchiveSourceFilter[];
  visible: boolean;
  visibleOptionCount: number;
}) {
  return (
    <div className="pill-nav__subnav" data-visible={visible ? "true" : "false"} aria-label="filter choices" aria-hidden={!visible}>
      <div className="pill-subnav__group">
        <SubnavCell index={0} visible={visible} active>
          {formatFilterFamily(activeFilterFamily)}
        </SubnavCell>
        {statusOptions.map((option, optionIndex) => (
          <SubnavCell
            key={`state:${option}`}
            index={optionIndex + 1}
            visible={visible && activeFilterFamily === "state"}
            active={(filters.status ?? "all") === option}
            disabled={loading}
            onClick={() => onStatusChange(option)}
          >
            {formatStateOption(option)}
          </SubnavCell>
        ))}
        {typeOptions.map((option, optionIndex) => (
          <SubnavCell
            key={`kind:${option}`}
            index={optionIndex + 1}
            visible={visible && activeFilterFamily === "kind"}
            active={(filters.type ?? "all") === option}
            disabled={loading}
            onClick={() => onTypeChange(option)}
          >
            {formatKindOption(option)}
          </SubnavCell>
        ))}
        {sourceOptions.map((option, optionIndex) => (
          <SubnavCell
            key={`origin:${option}`}
            index={optionIndex + 1}
            visible={visible && activeFilterFamily === "origin"}
            active={(filters.source ?? "all") === option}
            disabled={loading}
            onClick={() => onSourceChange(option)}
          >
            {formatOriginOption(option)}
          </SubnavCell>
        ))}
        <SubnavCell index={visibleOptionCount + 1} visible={visible && hasActiveFilters(filters)} active onClick={onClearFilters}>
          Clear
        </SubnavCell>
      </div>
    </div>
  );
}

function SubnavCell({
  active = false,
  children,
  disabled = false,
  index,
  onClick,
  visible,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  index: number;
  onClick?: () => void;
  visible: boolean;
}) {
  const style = getCellStyle(index);

  if (onClick) {
    return (
      <button
        className="subnav-cell"
        data-active={active ? "true" : "false"}
        data-visible={visible ? "true" : "false"}
        disabled={!visible || disabled}
        type="button"
        onClick={onClick}
        style={style}
        aria-hidden={!visible}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      className="subnav-cell"
      data-active={active ? "true" : "false"}
      data-visible={visible ? "true" : "false"}
      style={style}
      aria-hidden={!visible}
    >
      {children}
    </span>
  );
}

function getCellStyle(index: number): NavCellStyle {
  return { "--cell-index": index };
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
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = String(formData.get("archive-import") ?? "").trim();

    if (!input) {
      return;
    }

    try {
      await onCapture(input);
      event.currentTarget.reset();
    } catch {
      // Parent owns the persisted write error message.
    }
  };

  return (
    <form className="nav-capture" onSubmit={submit}>
      <input
        aria-label="text, URL, or local reference"
        disabled={pending}
        name="archive-import"
        placeholder="paste URL or write text"
        type="text"
      />
      <button className="nav-cell__button" type="submit" disabled={pending}>
        {pending ? "Adding" : "Add"}
      </button>
      {notice ? <span className="nav-capture__meta">{notice}</span> : null}
      {error ? <span className="nav-capture__error">{error}</span> : null}
    </form>
  );
}

function hasActiveFilters(filters: ItemCardFilters): boolean {
  return Boolean(filters.status || filters.type || filters.source || filters.text);
}

function formatStateOption(option: ArchiveStatusFilter): string {
  return option === "all" ? "Any state" : option;
}

function formatKindOption(option: ArchiveTypeFilter): string {
  if (option === "all") {
    return "All items";
  }

  return option.charAt(0).toUpperCase() + option.slice(1);
}

function formatOriginOption(option: ArchiveSourceFilter): string {
  if (option === "all") {
    return "Any origin";
  }

  return option.replace("_", " ");
}

function formatFilterFamily(family: FilterFamily): string {
  if (family === "origin") {
    return "Origin";
  }

  if (family === "kind") {
    return "Kind";
  }

  return "State";
}
