import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ItemStatus, ItemType } from "../atoms";
import type { ItemCardFilters, ItemSourceFilter } from "../../data/itemCardReader";
import { gsap } from "../../motion/MotionShell";

export type PillNavPanel = "index" | "views" | "filters" | "information" | "settings";

type ArchiveStatusFilter = ItemStatus | "all";
type ArchiveTypeFilter = ItemType | "all";
type ArchiveSourceFilter = ItemSourceFilter | "all";
type FilterFamily = "state" | "kind" | "origin";
type NavCellStyle = CSSProperties & {
  "--cell-width": string;
  "--cell-index": number;
};

export type PillNavProps = {
  activePanel: PillNavPanel | null;
  onPanelChange: (panel: PillNavPanel | null) => void;
  filters: ItemCardFilters;
  loading: boolean;
  itemCount: number;
  galleryColumns: number;
  readError: string | null;
  onGalleryColumnsChange: (columns: number) => void;
  onClearFilters: () => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  statusOptions: ArchiveStatusFilter[];
  typeOptions: ArchiveTypeFilter[];
  sourceOptions: ArchiveSourceFilter[];
};

type SubnavItem = {
  key: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  node?: ReactNode;
  onClick?: () => void;
};

export function PillNav(props: PillNavProps) {
  const {
    activePanel,
    filters,
    galleryColumns,
    itemCount,
    loading,
    onClearFilters,
    onGalleryColumnsChange,
    onPanelChange,
    onSourceChange,
    onStatusChange,
    onTypeChange,
    readError,
    sourceOptions,
    statusOptions,
    typeOptions,
  } = props;
  const [activeFilterFamily, setActiveFilterFamily] = useState<FilterFamily>("state");
  const subnavGroupRef = useRef<HTMLDivElement | null>(null);

  const togglePanel = (panel: PillNavPanel) => {
    onPanelChange(activePanel === panel ? null : panel);
  };

  const resultLabel = readError
    ? "Load error"
    : loading
      ? "Loading"
      : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const subnavItems = getSubnavItems({
    activeFilterFamily,
    filters,
    loading,
    onClearFilters,
    onSourceChange,
    onStatusChange,
    onTypeChange,
    panel: activePanel,
    galleryColumns,
    resultLabel,
    onGalleryColumnsChange,
    setActiveFilterFamily,
    sourceOptions,
    statusOptions,
    typeOptions,
  });

  useLayoutEffect(() => {
    const group = subnavGroupRef.current;
    if (!group || subnavItems.length === 0) {
      return;
    }

    const cells = Array.from(group.querySelectorAll<HTMLElement>(".subnav-cell"));
    const labels = cells
      .map((cell) => cell.querySelector<HTMLElement>(".nav-cell__text"))
      .filter((label): label is HTMLElement => Boolean(label));

    gsap.killTweensOf([...cells, ...labels]);
    gsap.set(group, { clearProps: "width,height,position" });
    gsap.set(cells, { clearProps: "position,left,top,width,height,zIndex,transform" });
    gsap.set(labels, { clearProps: "opacity,filter,transform" });

    const groupRect = group.getBoundingClientRect();
    const targetMetrics = cells.map((cell) => {
      const rect = cell.getBoundingClientRect();
      return {
        height: rect.height,
        left: rect.left - groupRect.left,
        top: rect.top - groupRect.top,
        width: rect.width,
      };
    });
    const originLeft = Math.max(0, Math.round(groupRect.width / 2 - 12.5));
    const timeline = gsap.timeline();

    gsap.set(group, {
      height: groupRect.height,
      position: "relative",
      width: groupRect.width,
    });
    gsap.set(cells, {
      filter: "none",
      left: originLeft,
      opacity: 1,
      position: "absolute",
      top: (index) => targetMetrics[index]?.top ?? 0,
      transformOrigin: "center center",
      width: 25,
      zIndex: (index) => cells.length - index,
    });
    gsap.set(labels, {
      filter: "blur(5px)",
      opacity: 0,
    });

    timeline.to(cells, {
      height: (index) => targetMetrics[index]?.height ?? 25,
      left: (index) => targetMetrics[index]?.left ?? 0,
      width: (index) => targetMetrics[index]?.width ?? 25,
      duration: 0.68,
      ease: "expo.out",
      stagger: {
        amount: 0.28,
        from: "center",
      },
    });

    timeline.to(
      labels,
      {
        filter: "blur(0px)",
        opacity: (index) => {
          const cell = labels[index]?.closest(".subnav-cell");
          return cell?.getAttribute("data-active") === "true" ? 0.58 : 1;
        },
        duration: 0.24,
        ease: "power2.out",
        stagger: {
          amount: 0.22,
          from: "center",
        },
      },
      0.38,
    );

    return () => {
      timeline.kill();
    };
  }, [activeFilterFamily, activePanel, galleryColumns, subnavItems.length]);

  const nav = (
    <header className="pill-nav" aria-label="archive controls">
      <div className="pill-nav__group" aria-label="primary archive controls">
        <button className="nav-cell nav-cell--dot" type="button" onClick={onClearFilters} aria-label="live archive">
          <span className="live-logo-dot" aria-hidden="true" />
        </button>
        <PrimaryCell label="Index" active={activePanel === "index"} onClick={() => togglePanel("index")} />
        <PrimaryCell label="Views" active={activePanel === "views"} onClick={() => togglePanel("views")} />
        <PrimaryCell label="Filters" active={activePanel === "filters"} onClick={() => togglePanel("filters")} />
        <PrimaryCell label="Info" active={activePanel === "information"} onClick={() => togglePanel("information")} />
        <PrimaryCell label="Settings" active={activePanel === "settings"} onClick={() => togglePanel("settings")} />
      </div>

      {subnavItems.length > 0 ? (
        <div
          key={`${activePanel}:${activeFilterFamily}`}
          className="pill-nav__subnav"
          data-visible="true"
          aria-label="archive secondary controls"
        >
          <div className="pill-subnav__group" ref={subnavGroupRef}>
            {subnavItems.map((item, index) => (
              <SubnavCell
                key={item.key}
                index={index}
                label={item.label}
                active={item.active}
                className={item.className}
                disabled={item.disabled}
                node={item.node}
                onClick={item.onClick}
              >
                {item.label}
              </SubnavCell>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );

  if (typeof document === "undefined") {
    return nav;
  }

  return createPortal(nav, document.body);
}

function getSubnavItems({
  activeFilterFamily,
  filters,
  loading,
  onClearFilters,
  onSourceChange,
  onStatusChange,
  onTypeChange,
  galleryColumns,
  onGalleryColumnsChange,
  panel,
  resultLabel,
  setActiveFilterFamily,
  sourceOptions,
  statusOptions,
  typeOptions,
}: {
  activeFilterFamily: FilterFamily;
  filters: ItemCardFilters;
  loading: boolean;
  onClearFilters: () => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  galleryColumns: number;
  onGalleryColumnsChange: (columns: number) => void;
  panel: PillNavPanel | null;
  resultLabel: string;
  setActiveFilterFamily: (family: FilterFamily) => void;
  sourceOptions: ArchiveSourceFilter[];
  statusOptions: ArchiveStatusFilter[];
  typeOptions: ArchiveTypeFilter[];
}): SubnavItem[] {
  if (panel === "index") {
    return [
      { key: "all-items", label: "All items", onClick: onClearFilters },
      { key: "result-count", label: resultLabel },
    ];
  }

  if (panel === "views") {
    return [
      {
        key: `gallery:${galleryColumns}`,
        label: "Gallery | + -",
        active: true,
        className: "subnav-cell--gallery-control",
        node: (
          <span className="gallery-nav-control" aria-label={`Gallery columns: ${galleryColumns}`} title={`${galleryColumns} columns`}>
            <span>Gallery</span>
            <span aria-hidden="true">|</span>
            <button
              className="gallery-nav-control__step"
              type="button"
              disabled={galleryColumns >= 8}
              onClick={() => onGalleryColumnsChange(galleryColumns + 1)}
              aria-label={`show more gallery columns, currently ${galleryColumns}`}
            >
              <span className="gallery-nav-control__icon gallery-nav-control__icon--plus" aria-hidden="true" />
            </button>
            <button
              className="gallery-nav-control__step"
              type="button"
              disabled={galleryColumns <= 2}
              onClick={() => onGalleryColumnsChange(galleryColumns - 1)}
              aria-label={`show fewer gallery columns, currently ${galleryColumns}`}
            >
              <span className="gallery-nav-control__icon gallery-nav-control__icon--minus" aria-hidden="true" />
            </button>
          </span>
        ),
      },
      { key: "list", label: "List", disabled: true },
      { key: "graph", label: "Graph", disabled: true },
    ];
  }

  if (panel === "information") {
    return [
      { key: "result-count", label: resultLabel },
      { key: "search-shortcut", label: "Search ⌘K" },
      { key: "theme-shortcut", label: "Theme M" },
    ];
  }

  if (panel === "settings") {
    return [
      { key: "settings-appearance", label: "Appearance" },
      { key: "settings-colors", label: "Colors" },
      { key: "settings-macros", label: "Macros" },
      { key: "settings-import", label: "Import" },
      { key: "settings-shortcuts", label: "Shortcuts" },
    ];
  }

  if (panel !== "filters") {
    return [];
  }

  const familyItems: SubnavItem[] = [
    {
      key: "filter-state",
      label: "State",
      active: activeFilterFamily === "state",
      onClick: () => setActiveFilterFamily("state"),
    },
    {
      key: "filter-kind",
      label: "Kind",
      active: activeFilterFamily === "kind",
      onClick: () => setActiveFilterFamily("kind"),
    },
    {
      key: "filter-origin",
      label: "Origin",
      active: activeFilterFamily === "origin",
      onClick: () => setActiveFilterFamily("origin"),
    },
  ];

  const optionItems =
    activeFilterFamily === "state"
      ? statusOptions.map<SubnavItem>((option) => ({
          key: `state:${option}`,
          label: formatStateOption(option),
          active: (filters.status ?? "all") === option,
          disabled: loading,
          onClick: () => onStatusChange(option),
        }))
      : activeFilterFamily === "kind"
        ? typeOptions.map<SubnavItem>((option) => ({
            key: `kind:${option}`,
            label: formatKindOption(option),
            active: (filters.type ?? "all") === option,
            disabled: loading,
            onClick: () => onTypeChange(option),
          }))
        : sourceOptions.map<SubnavItem>((option) => ({
            key: `origin:${option}`,
            label: formatOriginOption(option),
            active: (filters.source ?? "all") === option,
            disabled: loading,
            onClick: () => onSourceChange(option),
          }));

  if (hasActiveFilters(filters)) {
    optionItems.push({
      key: "clear",
      label: "Clear",
      onClick: onClearFilters,
    });
  }

  return [...familyItems, ...optionItems];
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
      <span className="nav-cell__text">{label}</span>
    </button>
  );
}

function SubnavCell({
  active = false,
  children,
  className = "",
  disabled = false,
  index,
  label,
  node,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  index: number;
  label: string;
  node?: ReactNode;
  onClick?: () => void;
}) {
  const style = getCellStyle(index, label);
  const content = <span className="nav-cell__text">{node ?? children}</span>;
  const classNames = ["subnav-cell", className].filter(Boolean).join(" ");

  if (onClick) {
    return (
      <button
        className={classNames}
        data-active={active ? "true" : "false"}
        data-visible="true"
        disabled={disabled}
        type="button"
        onClick={onClick}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={classNames}
      data-active={active ? "true" : "false"}
      data-visible="true"
      data-disabled={disabled ? "true" : "false"}
      style={style}
    >
      {content}
    </span>
  );
}

function getCellStyle(index: number, label: string): NavCellStyle {
  const width = Math.min(148, Math.max(25, Math.round(label.length * 7.1 + 25)));

  return {
    "--cell-width": `${width}px`,
    "--cell-index": index,
  };
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
