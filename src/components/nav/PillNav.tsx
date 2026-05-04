import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ItemStatus, ItemType } from "../atoms";
import type { ItemCardFilters, ItemFormatFilter, ItemSourceFilter } from "../../data/itemCardReader";
import type { CollectionIndexItem } from "../../data/pocketBaseItemCollection";
import { gsap } from "../../motion/MotionShell";

export type PillNavPanel = "index" | "views" | "filters" | "settings";

type ArchiveStatusFilter = ItemStatus | "all";
type ArchiveTypeFilter = ItemType | "all";
type ArchiveSourceFilter = ItemSourceFilter | "all";
type ArchiveFormatFilter = ItemFormatFilter | "all";
type IndexMode = "all" | "collections";
type FilterFamily = "state" | "kind" | "origin" | "format";
type SiteTheme = "light" | "dark";
type SettingsSection = "appearance" | "gallery" | "shortcuts" | "import" | "system";
export type ShortcutAction = "search" | "theme" | "galleryIncrease" | "galleryDecrease";
export type ShortcutBinding = {
  key: string;
  modifier?: "mod";
  alternateKeys?: string[];
};
export type ShortcutBindings = Record<ShortcutAction, ShortcutBinding>;
type NavCellStyle = CSSProperties & {
  "--cell-width": string;
  "--cell-index": number;
};

const SETTINGS_SECTIONS: Array<{ key: SettingsSection; label: string }> = [
  { key: "appearance", label: "Appearance" },
  { key: "gallery", label: "Gallery" },
  { key: "shortcuts", label: "Shortcuts" },
  { key: "import", label: "Import" },
  { key: "system", label: "System" },
];

export type PillNavProps = {
  activePanel: PillNavPanel | null;
  collectionIndex: CollectionIndexItem[];
  collectionIndexError: string | null;
  collectionIndexLoading: boolean;
  onPanelChange: (panel: PillNavPanel | null) => void;
  filters: ItemCardFilters;
  loading: boolean;
  itemCount: number;
  galleryColumns: number;
  isPocketBaseMode: boolean;
  readError: string | null;
  shortcutBindings: ShortcutBindings;
  shortcutError: string | null;
  siteTheme: SiteTheme;
  onGalleryColumnsChange: (columns: number) => void;
  onFormatChange: (format: ArchiveFormatFilter) => void;
  onSiteThemeChange: (theme: SiteTheme) => void;
  onShortcutChange: (action: ShortcutAction, binding: ShortcutBinding) => boolean;
  onShortcutReset: () => void;
  onClearFilters: () => void;
  onOpenCollection: (collectionId: string) => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  statusOptions: ArchiveStatusFilter[];
  typeOptions: ArchiveTypeFilter[];
  sourceOptions: ArchiveSourceFilter[];
  formatOptions: ArchiveFormatFilter[];
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

type SubnavGroup = {
  key: string;
  items: SubnavItem[];
};

export function PillNav(props: PillNavProps) {
  const {
    activePanel,
    collectionIndex,
    collectionIndexError,
    collectionIndexLoading,
    filters,
    galleryColumns,
    isPocketBaseMode,
    itemCount,
    loading,
    onClearFilters,
    onOpenCollection,
    onFormatChange,
    onGalleryColumnsChange,
    onPanelChange,
    onSiteThemeChange,
    onShortcutChange,
    onShortcutReset,
    onSourceChange,
    onStatusChange,
    onTypeChange,
    readError,
    shortcutBindings,
    shortcutError,
    siteTheme,
    sourceOptions,
    statusOptions,
    typeOptions,
    formatOptions,
  } = props;
  const [activeIndexMode, setActiveIndexMode] = useState<IndexMode>("all");
  const [activeFilterFamily, setActiveFilterFamily] = useState<FilterFamily>("state");
  const primaryGroupRef = useRef<HTMLDivElement | null>(null);
  usePrimaryNavIntro(primaryGroupRef);

  const togglePanel = (panel: PillNavPanel) => {
    onPanelChange(activePanel === panel ? null : panel);
  };

  const resultLabel = readError
    ? "Load error"
    : loading
      ? "Loading"
      : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const subnavGroups = getSubnavGroups({
    activeFilterFamily,
    activeIndexMode,
    filters,
    loading,
    onClearFilters,
    setActiveIndexMode,
    onFormatChange,
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
    formatOptions,
  });

  const nav = (
    <header className="pill-nav" aria-label="archive controls">
      <div className="pill-nav__group" ref={primaryGroupRef} aria-label="primary archive controls">
        <span className="pill-nav__primary-membrane" aria-hidden="true" />
        <button className="nav-cell nav-cell--dot" type="button" onClick={onClearFilters} aria-label="live archive">
          <span className="live-logo-dot" aria-hidden="true" />
        </button>
        <PrimaryCell label="Index" active={activePanel === "index"} onClick={() => togglePanel("index")} />
        <PrimaryCell label="Views" active={activePanel === "views"} onClick={() => togglePanel("views")} />
        <PrimaryCell label="Filters" active={activePanel === "filters"} onClick={() => togglePanel("filters")} />
        <PrimaryCell label="Settings" active={activePanel === "settings"} onClick={() => togglePanel("settings")} />
      </div>

      {subnavGroups.length > 0 ? (
        <div
          key={activePanel ?? "subnav"}
          className="pill-nav__subnav"
          data-visible="true"
          aria-label="archive secondary controls"
        >
          <AnimatedSubnavRow groups={subnavGroups} />
        </div>
      ) : null}

      {activePanel === "settings" ? (
        <SettingsIsland
          galleryColumns={galleryColumns}
          isPocketBaseMode={isPocketBaseMode}
          readError={readError}
          shortcutBindings={shortcutBindings}
          shortcutError={shortcutError}
          siteTheme={siteTheme}
          onGalleryColumnsChange={onGalleryColumnsChange}
          onSiteThemeChange={onSiteThemeChange}
          onShortcutChange={onShortcutChange}
          onShortcutReset={onShortcutReset}
        />
      ) : null}

      {activePanel === "index" && activeIndexMode === "collections" ? (
        <CollectionIndexIsland
          collections={collectionIndex}
          error={collectionIndexError}
          loading={collectionIndexLoading}
          onOpenCollection={onOpenCollection}
        />
      ) : null}
    </header>
  );

  if (typeof document === "undefined") {
    return nav;
  }

  return createPortal(nav, document.body);
}

function usePrimaryNavIntro(primaryGroupRef: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const group = primaryGroupRef.current;
    if (!group) {
      return;
    }

    const membrane = group.querySelector<HTMLElement>(".pill-nav__primary-membrane");
    const cells = Array.from(group.querySelectorAll<HTMLElement>(".nav-cell"));
    const labels = cells
      .map((cell) => cell.querySelector<HTMLElement>(".nav-cell__text"))
      .filter((label): label is HTMLElement => Boolean(label));

    if (!membrane || cells.length === 0) {
      return;
    }

    gsap.set(group, { clearProps: "width,height,position" });
    gsap.set(membrane, { clearProps: "width,height,opacity,transform" });
    gsap.set(cells, { clearProps: "position,left,top,width,height,zIndex,transform,opacity" });
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
    const getAnimatedNumber = (element: HTMLElement, property: string, fallback: number) => {
      const value = gsap.getProperty(element, property);
      const parsed = typeof value === "number" ? value : parseFloat(String(value));

      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const updateMembrane = () => {
      let minLeft = Infinity;
      let minTop = Infinity;
      let maxRight = -Infinity;
      let maxBottom = -Infinity;

      cells.forEach((cell) => {
        const left = getAnimatedNumber(cell, "left", 0);
        const top = getAnimatedNumber(cell, "top", 0);
        const width = getAnimatedNumber(cell, "width", cell.offsetWidth);
        const height = getAnimatedNumber(cell, "height", cell.offsetHeight);

        minLeft = Math.min(minLeft, left);
        minTop = Math.min(minTop, top);
        maxRight = Math.max(maxRight, left + width);
        maxBottom = Math.max(maxBottom, top + height);
      });

      const padding = 4;
      gsap.set(membrane, {
        height: maxBottom - minTop + padding * 2,
        opacity: 1,
        transform: `translate3d(${minLeft - padding}px, ${minTop - padding}px, 0)`,
        width: maxRight - minLeft + padding * 2,
      });
    };

    gsap.set(group, {
      height: groupRect.height,
      position: "relative",
      width: groupRect.width,
    });
    gsap.set(cells, {
      left: originLeft,
      opacity: 1,
      position: "absolute",
      top: (index) => targetMetrics[index]?.top ?? 0,
      transformOrigin: "center center",
      width: 25,
      zIndex: (index) => cells.length - index,
    });
    updateMembrane();
    gsap.set(labels, {
      filter: "blur(5px)",
      opacity: 0,
      x: (index) => {
        const target = targetMetrics[index];
        if (!target) {
          return 0;
        }

        const targetCenter = target.left + target.width / 2;
        const originCenter = originLeft + 12.5;
        return targetCenter < originCenter ? 8 : -8;
      },
    });

    timeline.to(cells, {
      height: (index) => targetMetrics[index]?.height ?? 25,
      left: (index) => targetMetrics[index]?.left ?? 0,
      width: (index) => targetMetrics[index]?.width ?? 25,
      duration: 0.68,
      ease: "expo.out",
      onUpdate: updateMembrane,
      stagger: {
        amount: 0.28,
        from: "center",
      },
    }, 0.02);

    timeline.to(labels, {
      filter: "blur(0px)",
      opacity: 1,
      x: 0,
      duration: 0.18,
      ease: "power2.out",
      stagger: {
        amount: 0.18,
        from: "center",
      },
    }, 0.32);

    timeline.eventCallback("onComplete", () => {
      updateMembrane();
      gsap.set(labels, { clearProps: "opacity,filter,transform" });
    });

    return () => {
      timeline.kill();
      gsap.set(group, { clearProps: "width,height,position" });
      gsap.set(membrane, { clearProps: "width,height,opacity,transform" });
      gsap.set(cells, { clearProps: "position,left,top,width,height,zIndex,transform,opacity" });
      gsap.set(labels, { clearProps: "opacity,filter,transform" });
    };
  }, [primaryGroupRef]);
}

function AnimatedSubnavRow({ groups }: { groups: SubnavGroup[] }) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const rowSignature = groups.map((group) => `${group.key}:${group.items.map((item) => item.label).join("|")}`).join("::");

  const updateRowMembrane = useCallback(() => {
    const row = rowRef.current;
    if (!row) {
      return;
    }

    const membrane = row.querySelector<HTMLElement>(".pill-nav__subnav-membrane");
    const cells = Array.from(row.querySelectorAll<HTMLElement>(".subnav-cell"));
    if (!membrane || cells.length === 0) {
      return;
    }

    const rowRect = row.getBoundingClientRect();
    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    cells.forEach((cell) => {
      const rect = cell.getBoundingClientRect();

      minLeft = Math.min(minLeft, rect.left - rowRect.left);
      minTop = Math.min(minTop, rect.top - rowRect.top);
      maxRight = Math.max(maxRight, rect.right - rowRect.left);
      maxBottom = Math.max(maxBottom, rect.bottom - rowRect.top);
    });

    const padding = 4;
    gsap.set(membrane, {
      height: maxBottom - minTop + padding * 2,
      opacity: 1,
      transform: `translate3d(${minLeft - padding}px, ${minTop - padding}px, 0)`,
      width: maxRight - minLeft + padding * 2,
    });
  }, []);

  useLayoutEffect(() => {
    updateRowMembrane();
    const frame = requestAnimationFrame(updateRowMembrane);

    return () => cancelAnimationFrame(frame);
  }, [rowSignature, updateRowMembrane]);

  return (
    <div className="pill-nav__subnav-row" ref={rowRef}>
      <span className="pill-nav__subnav-membrane" aria-hidden="true" />
      {groups.map((group) => (
        <AnimatedSubnavGroup key={group.key} groupKey={group.key} items={group.items} onFrame={updateRowMembrane} />
      ))}
    </div>
  );
}

function AnimatedSubnavGroup({
  groupKey,
  items,
  onFrame,
}: {
  groupKey: string;
  items: SubnavItem[];
  onFrame?: () => void;
}) {
  const subnavGroupRef = useRef<HTMLDivElement | null>(null);
  const animationSignature = items.map((item) => item.label).join("|");

  useLayoutEffect(() => {
    const group = subnavGroupRef.current;
    if (!group || items.length === 0) {
      return;
    }

    const membrane = group.querySelector<HTMLElement>(".pill-subnav__membrane");
    const cells = Array.from(group.querySelectorAll<HTMLElement>(".subnav-cell"));
    const labels = cells
      .map((cell) => cell.querySelector<HTMLElement>(".nav-cell__text"))
      .filter((label): label is HTMLElement => Boolean(label));

    gsap.killTweensOf([group, membrane, ...cells, ...labels].filter(Boolean));
    gsap.set(group, { clearProps: "width,height,position" });
    if (membrane) {
      gsap.set(membrane, { clearProps: "left,top,width,height,opacity,transform" });
    }
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
    const getAnimatedNumber = (element: HTMLElement, property: string, fallback: number) => {
      const value = gsap.getProperty(element, property);
      const parsed = typeof value === "number" ? value : parseFloat(String(value));

      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const updateMembrane = () => {
      if (!membrane || cells.length === 0) {
        return;
      }

      let minLeft = Infinity;
      let minTop = Infinity;
      let maxRight = -Infinity;
      let maxBottom = -Infinity;

      cells.forEach((cell) => {
        const left = getAnimatedNumber(cell, "left", 0);
        const top = getAnimatedNumber(cell, "top", 0);
        const width = getAnimatedNumber(cell, "width", cell.offsetWidth);
        const height = getAnimatedNumber(cell, "height", cell.offsetHeight);

        minLeft = Math.min(minLeft, left);
        minTop = Math.min(minTop, top);
        maxRight = Math.max(maxRight, left + width);
        maxBottom = Math.max(maxBottom, top + height);
      });

      const padding = 4;
      gsap.set(membrane, {
        height: maxBottom - minTop + padding * 2,
        left: minLeft - padding,
        opacity: 1,
        top: minTop - padding,
        width: maxRight - minLeft + padding * 2,
      });
      onFrame?.();
    };

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
    updateMembrane();
    onFrame?.();

    gsap.set(labels, {
      filter: "blur(5px)",
      opacity: 0,
      x: (index) => {
        const target = targetMetrics[index];
        if (!target) {
          return 0;
        }

        const targetCenter = target.left + target.width / 2;
        const originCenter = originLeft + 12.5;
        return targetCenter < originCenter ? 8 : -8;
      },
    });

    timeline.to(cells, {
      height: (index) => targetMetrics[index]?.height ?? 25,
      left: (index) => targetMetrics[index]?.left ?? 0,
      width: (index) => targetMetrics[index]?.width ?? 25,
      duration: 0.68,
      ease: "expo.out",
      onUpdate: updateMembrane,
      stagger: {
        amount: 0.28,
        from: "center",
      },
    }, 0.03);

    timeline.to(
      labels,
      {
        filter: "blur(0px)",
        opacity: (index) => {
          const cell = labels[index]?.closest(".subnav-cell");
          return cell?.getAttribute("data-active") === "true" ? 0.58 : 1;
        },
        x: 0,
        duration: 0.18,
        ease: "power2.out",
        stagger: {
          amount: 0.18,
          from: "center",
        },
      },
      0.34,
    );

    timeline.eventCallback("onComplete", () => {
      updateMembrane();
      onFrame?.();
      gsap.set(labels, { clearProps: "opacity,filter,transform" });
    });

    return () => {
      timeline.kill();
    };
  }, [animationSignature, groupKey, items.length, onFrame]);

  return (
    <div className="pill-subnav__group" ref={subnavGroupRef}>
      <span className="pill-subnav__membrane" aria-hidden="true" />
      {items.map((item, index) => (
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
  );
}

function getSubnavGroups({
  activeFilterFamily,
  activeIndexMode,
  filters,
  loading,
  onClearFilters,
  onFormatChange,
  onSourceChange,
  onStatusChange,
  onTypeChange,
  galleryColumns,
  onGalleryColumnsChange,
  panel,
  resultLabel,
  setActiveIndexMode,
  setActiveFilterFamily,
  sourceOptions,
  statusOptions,
  typeOptions,
  formatOptions,
}: {
  activeFilterFamily: FilterFamily;
  activeIndexMode: IndexMode;
  filters: ItemCardFilters;
  loading: boolean;
  onClearFilters: () => void;
  onFormatChange: (format: ArchiveFormatFilter) => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  galleryColumns: number;
  onGalleryColumnsChange: (columns: number) => void;
  panel: PillNavPanel | null;
  resultLabel: string;
  setActiveIndexMode: (mode: IndexMode) => void;
  setActiveFilterFamily: (family: FilterFamily) => void;
  sourceOptions: ArchiveSourceFilter[];
  statusOptions: ArchiveStatusFilter[];
  typeOptions: ArchiveTypeFilter[];
  formatOptions: ArchiveFormatFilter[];
}): SubnavGroup[] {
  if (panel === "index") {
    return [
      {
        key: "index",
        items: [
          {
            key: "all-items",
            label: "All items",
            active: activeIndexMode === "all",
            onClick: () => {
              setActiveIndexMode("all");
              onClearFilters();
            },
          },
          {
            key: "collections",
            label: "Collections",
            active: activeIndexMode === "collections",
            onClick: () => setActiveIndexMode("collections"),
          },
          { key: "result-count", label: resultLabel },
        ],
      },
    ];
  }

  if (panel === "views") {
    return [
      {
        key: "views",
        items: [
          {
            key: "gallery-control",
            label: "Gallery | + -",
            active: true,
            className: "subnav-cell--gallery-control",
            node: (
              <span className="gallery-nav-control" aria-label={`Gallery columns: ${galleryColumns}`} title={`${galleryColumns} columns`}>
                <span>Gallery</span>
                <span className="gallery-nav-control__divider" aria-hidden="true" />
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
        ],
      },
    ];
  }

  if (panel === "settings") {
    return [];
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
    {
      key: "filter-format",
      label: "Format",
      active: activeFilterFamily === "format",
      onClick: () => setActiveFilterFamily("format"),
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
        : activeFilterFamily === "origin"
          ? sourceOptions.map<SubnavItem>((option) => ({
              key: `origin:${option}`,
              label: formatOriginOption(option),
              active: (filters.source ?? "all") === option,
              disabled: loading,
              onClick: () => onSourceChange(option),
            }))
          : formatOptions.map<SubnavItem>((option) => ({
              key: `format:${option}`,
              label: formatFormatOption(option),
              active: (filters.format ?? "all") === option,
              disabled: loading,
              onClick: () => onFormatChange(option),
            }));

  if (hasActiveFilters(filters)) {
    optionItems.push({
      key: "clear",
      label: "Clear",
      onClick: onClearFilters,
    });
  }

  return [
    { key: "filters-family", items: familyItems },
    { key: `filters-options:${activeFilterFamily}`, items: optionItems },
  ];
}

function CollectionIndexIsland({
  collections,
  error,
  loading,
  onOpenCollection,
}: {
  collections: CollectionIndexItem[];
  error: string | null;
  loading: boolean;
  onOpenCollection: (collectionId: string) => void;
}) {
  return (
    <section className="collection-index-island" aria-label="collections index">
      <div className="collection-index-island__header">
        <span>Collections</span>
        <small>{loading ? "loading" : `${collections.length} ${collections.length === 1 ? "set" : "sets"}`}</small>
      </div>

      {error ? <p className="collection-index-island__status">{error}</p> : null}
      {loading ? <p className="collection-index-island__status">Loading collections.</p> : null}
      {!loading && !error && collections.length === 0 ? (
        <p className="collection-index-island__status">No collections yet.</p>
      ) : null}

      {!loading && !error && collections.length > 0 ? (
        <div className="collection-index-island__list">
          {collections.map((collection) => (
            <button
              className="collection-index-island__row"
              key={collection.id}
              type="button"
              onClick={() => onOpenCollection(collection.id)}
            >
              <span>
                <strong>{collection.name}</strong>
                {collection.description ? <small>{collection.description}</small> : null}
              </span>
              <em>
                {formatCollectionCount(collection.pieceCount)} · {collection.kindSummary}
              </em>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatCollectionCount(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
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

function SettingsIsland({
  galleryColumns,
  isPocketBaseMode,
  onGalleryColumnsChange,
  onSiteThemeChange,
  onShortcutChange,
  onShortcutReset,
  readError,
  shortcutBindings,
  shortcutError,
  siteTheme,
}: {
  galleryColumns: number;
  isPocketBaseMode: boolean;
  onGalleryColumnsChange: (columns: number) => void;
  onSiteThemeChange: (theme: SiteTheme) => void;
  onShortcutChange: (action: ShortcutAction, binding: ShortcutBinding) => boolean;
  onShortcutReset: () => void;
  readError: string | null;
  shortcutBindings: ShortcutBindings;
  shortcutError: string | null;
  siteTheme: SiteTheme;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("shortcuts");
  const [recordingAction, setRecordingAction] = useState<ShortcutAction | null>(null);
  const captureShortcut = (action: ShortcutAction, event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      setRecordingAction(null);
      return;
    }

    const binding = getShortcutBindingFromEvent(event.nativeEvent);
    if (!binding) {
      return;
    }

    if (onShortcutChange(action, binding)) {
      setRecordingAction(null);
    }
  };

  return (
    <section className="settings-island" aria-label="archive settings">
      <div className="settings-island__tabs" aria-label="settings sections">
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section.key}
            className="settings-island__tab"
            data-active={activeSection === section.key ? "true" : "false"}
            type="button"
            onClick={() => setActiveSection(section.key)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="settings-island__panel">
        {activeSection === "appearance" ? (
          <div className="settings-island__section">
            <span className="settings-island__label">Appearance</span>
            <div className="settings-island__cells" aria-label="theme">
              <button
                className="settings-island__cell"
                data-active={siteTheme === "light" ? "true" : "false"}
                type="button"
                onClick={() => onSiteThemeChange("light")}
              >
                Light
              </button>
              <button
                className="settings-island__cell"
                data-active={siteTheme === "dark" ? "true" : "false"}
                type="button"
                onClick={() => onSiteThemeChange("dark")}
              >
                Dark
              </button>
            </div>
          </div>
        ) : null}

        {activeSection === "gallery" ? (
          <div className="settings-island__section">
            <span className="settings-island__label">Gallery</span>
            <div className="settings-island__cells" aria-label={`gallery columns ${galleryColumns}`}>
              <button
                className="settings-island__cell"
                type="button"
                disabled={galleryColumns <= 2}
                onClick={() => onGalleryColumnsChange(galleryColumns - 1)}
              >
                -
              </button>
              <span className="settings-island__cell" data-static="true">
                {galleryColumns} cols
              </span>
              <button
                className="settings-island__cell"
                type="button"
                disabled={galleryColumns >= 8}
                onClick={() => onGalleryColumnsChange(galleryColumns + 1)}
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        {activeSection === "shortcuts" ? (
          <div className="settings-island__section">
            <div className="settings-island__section-header">
              <span className="settings-island__label">Shortcuts</span>
              <button className="settings-island__reset" type="button" onClick={onShortcutReset}>
                Reset
              </button>
            </div>
            <div className="settings-island__shortcut-list" aria-label="shortcut bindings">
              <ShortcutCaptureField
                action="search"
                binding={shortcutBindings.search}
                label="Search archive"
                recording={recordingAction === "search"}
                onFocus={() => setRecordingAction("search")}
                onKeyDown={captureShortcut}
              />
              <ShortcutCaptureField
                action="theme"
                binding={shortcutBindings.theme}
                label="Toggle theme"
                recording={recordingAction === "theme"}
                onFocus={() => setRecordingAction("theme")}
                onKeyDown={captureShortcut}
              />
              <ShortcutCaptureField
                action="galleryIncrease"
                binding={shortcutBindings.galleryIncrease}
                label="More columns"
                recording={recordingAction === "galleryIncrease"}
                onFocus={() => setRecordingAction("galleryIncrease")}
                onKeyDown={captureShortcut}
              />
              <ShortcutCaptureField
                action="galleryDecrease"
                binding={shortcutBindings.galleryDecrease}
                label="Fewer columns"
                recording={recordingAction === "galleryDecrease"}
                onFocus={() => setRecordingAction("galleryDecrease")}
                onKeyDown={captureShortcut}
              />
            </div>
            {shortcutError ? <span className="settings-island__error">{shortcutError}</span> : null}
          </div>
        ) : null}

        {activeSection === "import" ? (
          <div className="settings-island__section">
            <span className="settings-island__label">Import</span>
            <span className="settings-island__note">
              {isPocketBaseMode ? "URL, note, image, PDF live" : "Live mode required"}
            </span>
          </div>
        ) : null}

        {activeSection === "system" ? (
          <div className="settings-island__section">
            <span className="settings-island__label">System</span>
            <span className="settings-island__note">
              {readError ? "Archive read error" : "Archive connected"} · Product Sans files pending
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ShortcutCaptureField({
  action,
  binding,
  label,
  onFocus,
  onKeyDown,
  recording,
}: {
  action: ShortcutAction;
  binding: ShortcutBinding;
  label: string;
  onFocus: () => void;
  onKeyDown: (action: ShortcutAction, event: ReactKeyboardEvent<HTMLInputElement>) => void;
  recording: boolean;
}) {
  return (
    <label className="settings-island__shortcut">
      <span>{label}</span>
      <input
        readOnly
        aria-label={`${label} shortcut`}
        data-recording={recording ? "true" : "false"}
        value={recording ? "Press" : formatShortcutBinding(binding)}
        onFocus={onFocus}
        onClick={onFocus}
        onKeyDown={(event) => onKeyDown(action, event)}
      />
    </label>
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
  return Boolean(filters.status || filters.type || filters.source || filters.format || filters.text);
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

function formatFormatOption(option: ArchiveFormatFilter): string {
  if (option === "all") {
    return "Any format";
  }

  return option.toUpperCase() === option ? option : option.charAt(0).toUpperCase() + option.slice(1);
}

function getShortcutBindingFromEvent(event: KeyboardEvent): ShortcutBinding | null {
  if (event.altKey) {
    return null;
  }

  if (!isSupportedShortcutKey(event.key)) {
    return null;
  }

  return {
    key: normalizeShortcutKey(event.key),
    ...(event.metaKey || event.ctrlKey ? { modifier: "mod" as const } : {}),
  };
}

function isSupportedShortcutKey(key: string) {
  return key.length === 1 && key !== " ";
}

function normalizeShortcutKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

function formatShortcutBinding(binding: ShortcutBinding) {
  const keys = [binding.key, ...(binding.alternateKeys ?? [])].map(formatShortcutKey).join(" / ");
  return binding.modifier === "mod" ? `⌘${keys}` : keys;
}

function formatShortcutKey(key: string) {
  return key.length === 1 ? key.toUpperCase() : key;
}
