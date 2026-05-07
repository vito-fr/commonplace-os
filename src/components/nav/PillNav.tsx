import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
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
export type GalleryObjectMode = "all" | "items" | "collections";
export type ArchiveViewMode = "gallery" | "masonry" | "list" | "graph";
type FilterFamily = "state" | "kind" | "source" | "collection" | "more";
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
  collectionCount: number;
  itemCount: number;
  onPanelChange: (panel: PillNavPanel | null) => void;
  filters: ItemCardFilters;
  loading: boolean;
  objectMode: GalleryObjectMode;
  viewMode: ArchiveViewMode;
  galleryColumns: number;
  masonryColumns: number;
  isPocketBaseMode: boolean;
  readError: string | null;
  shortcutBindings: ShortcutBindings;
  shortcutError: string | null;
  siteTheme: SiteTheme;
  onGalleryColumnsChange: (columns: number) => void;
  onMasonryColumnsChange: (columns: number) => void;
  onFormatChange: (format: ArchiveFormatFilter) => void;
  onSiteThemeChange: (theme: SiteTheme) => void;
  onShortcutChange: (action: ShortcutAction, binding: ShortcutBinding) => boolean;
  onShortcutReset: () => void;
  onClearFilters: () => void;
  onCollectionFilterChange: (collection: string) => void;
  onObjectModeChange: (mode: GalleryObjectMode) => void;
  onViewModeChange: (mode: ArchiveViewMode) => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  statusOptions: ArchiveStatusFilter[];
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
    collectionCount,
    filters,
    galleryColumns,
    isPocketBaseMode,
    itemCount,
    loading,
    masonryColumns,
    onClearFilters,
    onCollectionFilterChange,
    onObjectModeChange,
    onViewModeChange,
    onFormatChange,
    onGalleryColumnsChange,
    onMasonryColumnsChange,
    onPanelChange,
    onSiteThemeChange,
    onShortcutChange,
    onShortcutReset,
    onSourceChange,
    onStatusChange,
    onTypeChange,
    objectMode,
    viewMode,
    readError,
    shortcutBindings,
    shortcutError,
    siteTheme,
    sourceOptions,
    statusOptions,
    formatOptions,
  } = props;
  const [activeFilterFamily, setActiveFilterFamily] = useState<FilterFamily>("state");
  const [openFilterFamily, setOpenFilterFamily] = useState<FilterFamily | null>(null);
  const primaryGroupRef = useRef<HTMLDivElement | null>(null);
  useMaskedPillRowIntro(primaryGroupRef, "primary:index|views|filters|settings");

  const togglePanel = (panel: PillNavPanel) => {
    onPanelChange(activePanel === panel ? null : panel);
  };

  const openFilter = (family: FilterFamily) => {
    setActiveFilterFamily(family);
    setOpenFilterFamily((currentFamily) => (currentFamily === family ? null : family));
  };

  useEffect(() => {
    if (activePanel !== "filters") {
      setOpenFilterFamily(null);
    }
  }, [activePanel]);

  const subnavGroups = getSubnavGroups({
    activeFilterFamily,
    collectionCount,
    itemCount,
    onObjectModeChange,
    onViewModeChange,
    panel: activePanel,
    galleryColumns,
    masonryColumns,
    objectMode,
    viewMode,
    onGalleryColumnsChange,
    onMasonryColumnsChange,
    openFilter,
  });

  const nav = (
    <header className="pill-nav" aria-label="archive controls">
      <div className="pill-nav__group" ref={primaryGroupRef} aria-label="primary archive controls">
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

      {activePanel === "filters" && openFilterFamily ? (
        <FilterPopoverIsland
          collectionIndex={collectionIndex}
          family={openFilterFamily}
          filters={filters}
          formatOptions={formatOptions}
          loading={loading}
          onClose={() => setOpenFilterFamily(null)}
          onCollectionFilterChange={onCollectionFilterChange}
          onFormatChange={onFormatChange}
          onSourceChange={onSourceChange}
          onStatusChange={onStatusChange}
          onTypeChange={onTypeChange}
          sourceOptions={sourceOptions}
          statusOptions={statusOptions}
        />
      ) : null}

    </header>
  );

  if (typeof document === "undefined") {
    return nav;
  }

  return createPortal(nav, document.body);
}

function useMaskedPillRowIntro(rowRef: RefObject<HTMLElement | null>, signature: string) {
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) {
      return;
    }

    let cancelled = false;
    let activeTweens: Array<{ kill: () => void }> = [];
    let settleFallbackTimer: number | null = null;
    const cells = Array.from(row.querySelectorAll<HTMLElement>(".nav-cell, .subnav-cell"));
    const masks = Array.from(row.querySelectorAll<HTMLElement>(".nav-cell__text-mask"));
    const revealTargets = masks
      .map((mask, revealIndex) => {
        const cell = mask.closest<HTMLElement>(".nav-cell, .subnav-cell");
        const text = mask.querySelector<HTMLElement>(".nav-cell__text");
        const cellIndex = cell ? cells.indexOf(cell) : -1;

        return { cell, cellIndex, mask, revealIndex, text };
      })
      .filter((target): target is {
        cell: HTMLElement;
        cellIndex: number;
        mask: HTMLElement;
        revealIndex: number;
        text: HTMLElement | null;
      } => Boolean(target.cell) && target.cellIndex >= 0);
    const debugMotionEnabled =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("debugMotion") === "1" ||
        window.location.hash.includes("debugMotion=1"));
    const isDebugMotion = () => debugMotionEnabled;
    const snapToDevicePixel = (value: number) => {
      const ratio = window.devicePixelRatio || 1;
      return Math.round(value * ratio) / ratio;
    };
    const getMeasuredRowWidth = (
      fallbackWidth: number,
      metrics: Array<{ left: number; width: number }>,
    ) => {
      if (metrics.length === 0) {
        return fallbackWidth;
      }

      const rowStyles = window.getComputedStyle(row);
      const horizontalPadding =
        (parseFloat(rowStyles.paddingLeft) || 0) + (parseFloat(rowStyles.paddingRight) || 0);
      const minLeft = Math.min(...metrics.map((metric) => metric.left));
      const maxRight = Math.max(...metrics.map((metric) => metric.left + metric.width));

      return snapToDevicePixel(Math.max(fallbackWidth, maxRight - minLeft + horizontalPadding));
    };

    const measure = () => {
      masks.forEach((mask, index) => {
        const text = mask.querySelector<HTMLElement>(".nav-cell__text");
        const measurementTarget = mask.querySelector<HTMLElement>("[data-nav-measure-target]") ?? text;
        const measuredWidth = Math.ceil(
          measurementTarget?.getBoundingClientRect().width || measurementTarget?.scrollWidth || 0,
        );
        mask.style.setProperty("--text-width", `${measuredWidth}px`);
        mask.style.setProperty("--cell-delay", `${index * 70}ms`);

        if (isDebugMotion()) {
          console.log("[DEBUG-pill-motion]", JSON.stringify({
            cellIndex: index,
            computedMaskWidth: window.getComputedStyle(mask).width,
            label: text?.textContent?.trim() ?? "",
            measuredWidth,
            phase: "measure",
          }));
        }
      });
    };
    const logMotionRects = (phase: string) => {
      if (!isDebugMotion()) {
        return;
      }

      const rects = cells.map((cell) => {
        const rect = cell.getBoundingClientRect();

        return {
          h: snapToDevicePixel(rect.height),
          label: cell.textContent?.trim() ?? "",
          w: snapToDevicePixel(rect.width),
          x: snapToDevicePixel(rect.x),
          y: snapToDevicePixel(rect.y),
        };
      });
      const targets = revealTargets.map(({ mask, revealIndex, text }) => {
        const rect = mask.getBoundingClientRect();
        const textStyle = text ? window.getComputedStyle(text) : null;

        return {
          filter: textStyle?.filter ?? "",
          label: text?.textContent?.trim() ?? "",
          maskWidth: snapToDevicePixel(rect.width),
          opacity: textStyle?.opacity ?? "",
          revealIndex,
          transform: textStyle?.transform ?? "",
        };
      });
      const rowRect = row.getBoundingClientRect();
      const rowStyle = window.getComputedStyle(row);
      const rowBeforeStyle = window.getComputedStyle(row, "::before");
      const clipX = parseFloat(rowStyle.getPropertyValue("--nav-row-clip-x")) || 0;
      console.log("[DEBUG-pill-motion-rects]", JSON.stringify({
        phase,
          row: {
          backdropFilter:
            rowBeforeStyle.backdropFilter ||
            rowBeforeStyle.getPropertyValue("-webkit-backdrop-filter") ||
            rowStyle.backdropFilter,
          background: rowBeforeStyle.backgroundColor || rowStyle.backgroundColor,
          clipX: snapToDevicePixel(clipX),
          h: snapToDevicePixel(rowRect.height),
          visibleW: snapToDevicePixel(Math.max(0, rowRect.width - clipX * 2)),
          w: snapToDevicePixel(rowRect.width),
          x: snapToDevicePixel(rowRect.x),
          y: snapToDevicePixel(rowRect.y),
        },
        cells: rects,
        targets,
      }));
    };
    const clearEnterDelays = () => {
      masks.forEach((mask) => {
        mask.style.removeProperty("--cell-delay");
      });
    };
    const clearRevealState = () => {
      row.removeAttribute("data-entering");
      row.removeAttribute("data-preparing");
      row.removeAttribute("data-reveal-state");
    };
    const clearAnimatedStyles = () => {
      gsap.set(row, { clearProps: "--nav-row-clip-x,clipPath,height,transform,width" });
      gsap.set(cells, { clearProps: "height,left,position,top,transform,width,zIndex" });
      revealTargets.forEach(({ mask, text }) => {
        gsap.set(mask, { clearProps: "width" });
        if (text) {
          gsap.set(text, { clearProps: "filter,opacity,transform,visibility" });
        }
      });
    };
    const transitionListeners: Array<() => void> = [];
    if (isDebugMotion()) {
      revealTargets.forEach(({ mask, revealIndex: index, text }) => {
        const logTransition = (phase: "transitionstart" | "transitionend", event: TransitionEvent) => {
          if (event.target !== mask && event.target !== text) {
            return;
          }

          console.log("[DEBUG-pill-motion]", JSON.stringify({
            cellIndex: index,
            label: text?.textContent?.trim() ?? "",
            phase,
            propertyName: event.propertyName,
            target: event.target === mask ? "mask" : "text",
            width: window.getComputedStyle(mask).width,
          }));
        };
        const onTransitionStart = (event: TransitionEvent) => logTransition("transitionstart", event);
        const onTransitionEnd = (event: TransitionEvent) => logTransition("transitionend", event);

        mask.addEventListener("transitionstart", onTransitionStart);
        mask.addEventListener("transitionend", onTransitionEnd);
        text?.addEventListener("transitionstart", onTransitionStart);
        text?.addEventListener("transitionend", onTransitionEnd);
        transitionListeners.push(() => {
          mask.removeEventListener("transitionstart", onTransitionStart);
          mask.removeEventListener("transitionend", onTransitionEnd);
          text?.removeEventListener("transitionstart", onTransitionStart);
          text?.removeEventListener("transitionend", onTransitionEnd);
        });
      });
    }
    const reveal = () => {
      if (cancelled) {
        return;
      }

      activeTweens.forEach((tween) => tween.kill());
      activeTweens = [];
      clearRevealState();
      clearAnimatedStyles();
      measure();
      gsap.set(row, { clearProps: "height,transform,width" });
      gsap.set(cells, { clearProps: "height,left,position,top,transform,width,zIndex" });
      revealTargets.forEach(({ mask, text }) => {
        gsap.set(mask, { width: mask.style.getPropertyValue("--text-width") || "auto" });
        if (text) {
          gsap.set(text, { autoAlpha: 1, filter: "blur(0px)", x: 0 });
        }
      });
      if (document.visibilityState === "hidden") {
        logMotionRects("enter-skip-hidden");
        return;
      }
      logMotionRects("enter-start");

      const openRowRect = row.getBoundingClientRect();
      const openRowHeight = snapToDevicePixel(openRowRect.height);

      row.setAttribute("data-entering", "true");
      row.setAttribute("data-preparing", "true");
      row.setAttribute("data-reveal-state", "closed");

      revealTargets.forEach(({ mask, revealIndex: index, text }) => {
        gsap.killTweensOf([mask, text].filter(Boolean));
        gsap.set(mask, { width: 0 });
        if (text) {
          gsap.set(text, { autoAlpha: 0.08, filter: "blur(4px)", x: -6 });
        }
      });

      row.getBoundingClientRect();

      const closedRowRect = row.getBoundingClientRect();
      const closedRowHeight = snapToDevicePixel(closedRowRect.height);
      const closedMetrics = cells.map((cell) => {
        const rect = cell.getBoundingClientRect();
        return {
          height: snapToDevicePixel(rect.height),
          left: snapToDevicePixel(rect.left - closedRowRect.left),
          top: snapToDevicePixel(rect.top - closedRowRect.top),
          width: snapToDevicePixel(rect.width),
        };
      });
      const closedRowWidth = getMeasuredRowWidth(snapToDevicePixel(closedRowRect.width), closedMetrics);
      const seedWidth = snapToDevicePixel(Math.max(closedRowHeight, closedMetrics[0]?.height ?? 27));
      const seedHold = 0.07;
      const splitDuration = 0.26;
      const revealDuration = 0.5;
      const splitStep = 0.042;
      const revealStep = 0.06;
      const centerIndex = (cells.length - 1) / 2;
      const splitDelays = cells.map((_, index) => Math.abs(index - centerIndex) * splitStep);
      const maxSplitDelay = splitDelays.reduce((maxDelay, delay) => Math.max(maxDelay, delay), 0);
      const revealStart = seedHold + maxSplitDelay + splitDuration + 0.04;
      const wrapperSplitDuration = splitDuration + maxSplitDelay;
      const maxRevealDelay = Math.max(0, revealTargets.length - 1) * revealStep;

      gsap.set(row, {
        "--nav-row-clip-x": `${Math.max(0, (closedRowWidth - seedWidth) / 2)}px`,
        height: closedRowHeight,
        width: closedRowWidth,
      });
      cells.forEach((cell, index) => {
        const closedMetric = closedMetrics[index];
        if (!closedMetric) {
          return;
        }
        const closedCenter = closedMetric.left + closedMetric.width / 2;
        const splitOrigin = closedRowWidth / 2;

        gsap.killTweensOf(cell);
        gsap.set(cell, {
          x: snapToDevicePixel(splitOrigin - closedCenter),
          zIndex: cells.length - index,
        });
      });

      row.removeAttribute("data-preparing");
      row.setAttribute("data-reveal-state", "seed");
      logMotionRects("seed");

      let hasSettled = false;
      const settle = () => {
        if (cancelled || hasSettled) {
          return;
        }

        hasSettled = true;
        if (settleFallbackTimer !== null) {
          window.clearTimeout(settleFallbackTimer);
          settleFallbackTimer = null;
        }
        clearEnterDelays();
        gsap.set(row, { height: openRowHeight });
        revealTargets.forEach(({ mask, text }) => {
          gsap.set(mask, { width: mask.style.getPropertyValue("--text-width") || "auto" });
          if (text) {
            gsap.set(text, { autoAlpha: 1, filter: "blur(0px)", x: 0 });
          }
        });
        clearAnimatedStyles();
        clearRevealState();
        logMotionRects("enter-settled");
      };

      const timeline = gsap.timeline({
        onComplete: settle,
        paused: true,
      });
      activeTweens.push(timeline);
      settleFallbackTimer = window.setTimeout(
        settle,
        Math.ceil((revealStart + maxRevealDelay + revealDuration + 0.18) * 1000),
      );

      timeline.call(() => {
        row.setAttribute("data-reveal-state", "split");
      }, undefined, seedHold);
      timeline.to(row, {
        "--nav-row-clip-x": "0px",
        autoRound: false,
        duration: wrapperSplitDuration,
        ease: "power3.out",
      }, seedHold);
      cells.forEach((cell, index) => {
        const splitDelay = splitDelays[index] ?? 0;

        timeline.to(cell, {
          autoRound: false,
          delay: 0,
          duration: splitDuration,
          ease: "power3.out",
          x: 0,
        }, seedHold + splitDelay);
      });

      timeline.call(() => {
        row.setAttribute("data-reveal-state", "reveal");
        gsap.set(row, { clearProps: "width" });
        gsap.set(row, {
          "--nav-row-clip-x": "0px",
          height: closedRowHeight,
        });
        gsap.set(cells, { clearProps: "height,left,position,top,transform,width,zIndex" });
        revealTargets.forEach(({ mask, text }) => {
          gsap.set(mask, { width: 0 });
          if (text) {
            gsap.set(text, { autoAlpha: 0.08, filter: "blur(4px)", x: -6 });
          }
        });
        logMotionRects("reveal-ready");
      }, undefined, revealStart);

      revealTargets.forEach(({ mask, revealIndex: index, text }) => {
        const measurementTarget = mask.querySelector<HTMLElement>("[data-nav-measure-target]") ?? text;
        const measuredWidth =
          parseFloat(mask.style.getPropertyValue("--text-width")) ||
          Math.ceil(measurementTarget?.getBoundingClientRect().width || measurementTarget?.scrollWidth || 0);
        const startAt = revealStart + index * revealStep;

        timeline.to(mask, {
          autoRound: false,
          duration: revealDuration,
          ease: "power3.out",
          onComplete: () => {
            if (isDebugMotion()) {
              console.log("[DEBUG-pill-motion]", JSON.stringify({
                cellIndex: index,
                label: text?.textContent?.trim() ?? "",
                phase: "gsap-end",
                width: window.getComputedStyle(mask).width,
              }));
            }
          },
          onStart: () => {
            if (isDebugMotion()) {
              console.log("[DEBUG-pill-motion]", JSON.stringify({
                cellIndex: index,
                label: text?.textContent?.trim() ?? "",
                measuredWidth,
                phase: "gsap-start",
              }));
            }
          },
          width: measuredWidth,
        }, startAt);
        if (text) {
          timeline.to(text, {
            autoAlpha: 1,
            duration: revealDuration,
            ease: "power3.out",
            filter: "blur(0px)",
            x: 0,
          }, startAt);
        }
      });
      if (isDebugMotion()) {
        [0, 0.06, 0.14, 0.24, 0.36, 0.52, 0.76, 1].forEach((sampleTime) => {
          timeline.call(() => {
            logMotionRects(`sample:${sampleTime.toFixed(2)}`);
          }, undefined, sampleTime);
        });
      }
      timeline.play(0);
    };

    reveal();

    if (document.fonts) {
      document.fonts.ready.then(() => {
        if (!cancelled) {
          measure();
        }
      });
    }

    return () => {
      cancelled = true;
      activeTweens.forEach((tween) => tween.kill());
      if (settleFallbackTimer !== null) {
        window.clearTimeout(settleFallbackTimer);
        settleFallbackTimer = null;
      }
      clearRevealState();
      clearEnterDelays();
      clearAnimatedStyles();
      transitionListeners.forEach((remove) => remove());
    };
  }, [rowRef, signature]);
}

function AnimatedSubnavRow({ groups }: { groups: SubnavGroup[] }) {
  return (
    <div className="pill-nav__subnav-row">
      {groups.map((group) => (
        <AnimatedSubnavGroup key={group.key} groupKey={group.key} items={group.items} />
      ))}
    </div>
  );
}

function AnimatedSubnavGroup({ groupKey, items }: { groupKey: string; items: SubnavItem[] }) {
  const subnavGroupRef = useRef<HTMLDivElement | null>(null);
  const animationSignature = `${groupKey}:${items.map((item) => item.key).join("|")}`;
  useMaskedPillRowIntro(subnavGroupRef, animationSignature);

  return (
    <div className="pill-subnav__group" ref={subnavGroupRef}>
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

function ViewDensityControl({
  active,
  columns,
  label,
  maxColumns,
  minColumns,
  onColumnsChange,
  onSelect,
}: {
  active: boolean;
  columns: number;
  label: string;
  maxColumns: number;
  minColumns: number;
  onColumnsChange: (columns: number) => void;
  onSelect: () => void;
}) {
  const labelLower = label.toLowerCase();

  return (
    <span
      className="view-density-control"
      aria-label={`${label} columns: ${columns}`}
      title={`${columns} columns`}
    >
      <button
        className="view-density-control__label"
        type="button"
        data-nav-measure-target="true"
        onClick={onSelect}
      >
        {label}
      </button>
      {active ? (
        <span className="view-density-control__extras">
          <span className="view-density-control__divider" aria-hidden="true" />
          <button
            className="view-density-control__step"
            type="button"
            disabled={columns >= maxColumns}
            onClick={() => onColumnsChange(columns + 1)}
            aria-label={`show more ${labelLower} columns, currently ${columns}`}
          >
            <span className="view-density-control__icon view-density-control__icon--plus" aria-hidden="true" />
          </button>
          <button
            className="view-density-control__step"
            type="button"
            disabled={columns <= minColumns}
            onClick={() => onColumnsChange(columns - 1)}
            aria-label={`show fewer ${labelLower} columns, currently ${columns}`}
          >
            <span className="view-density-control__icon view-density-control__icon--minus" aria-hidden="true" />
          </button>
        </span>
      ) : null}
    </span>
  );
}

function IndexNavControl({ count, label }: { count: number; label: string }) {
  const countLabel = String(count);
  const countStyle = {
    "--index-count-width": `calc(${Math.max(countLabel.length, 1)}ch + 14px)`,
  } as CSSProperties;

  return (
    <span className="index-nav-control" aria-label={`${label}: ${countLabel}`}>
      <span className="index-nav-control__label" data-nav-measure-target="true">
        {label}
      </span>
      <span className="index-nav-control__extras" style={countStyle} aria-hidden="true">
        <span className="index-nav-control__divider" aria-hidden="true" />
        <span className="index-nav-control__count">{countLabel}</span>
      </span>
    </span>
  );
}

function getSubnavGroups({
  activeFilterFamily,
  collectionCount,
  itemCount,
  onObjectModeChange,
  galleryColumns,
  masonryColumns,
  onGalleryColumnsChange,
  onMasonryColumnsChange,
  onViewModeChange,
  objectMode,
  viewMode,
  panel,
  openFilter,
}: {
  activeFilterFamily: FilterFamily;
  collectionCount: number;
  itemCount: number;
  onObjectModeChange: (mode: GalleryObjectMode) => void;
  galleryColumns: number;
  masonryColumns: number;
  onGalleryColumnsChange: (columns: number) => void;
  onMasonryColumnsChange: (columns: number) => void;
  onViewModeChange: (mode: ArchiveViewMode) => void;
  objectMode: GalleryObjectMode;
  viewMode: ArchiveViewMode;
  panel: PillNavPanel | null;
  openFilter: (family: FilterFamily) => void;
}): SubnavGroup[] {
  if (panel === "index") {
    const allCount = itemCount + collectionCount;

    return [
      {
      key: "index",
      items: [
          {
            key: "all-objects",
            label: "All",
            active: objectMode === "all",
            className: "subnav-cell--index-count",
            node: <IndexNavControl count={allCount} label="All" />,
            onClick: () => onObjectModeChange("all"),
          },
          {
            key: "items",
            label: "Items",
            active: objectMode === "items",
            className: "subnav-cell--index-count",
            node: <IndexNavControl count={itemCount} label="Items" />,
            onClick: () => onObjectModeChange("items"),
          },
          {
            key: "collections",
            label: "Collections",
            active: objectMode === "collections",
            className: "subnav-cell--index-count",
            node: <IndexNavControl count={collectionCount} label="Collections" />,
            onClick: () => onObjectModeChange("collections"),
          },
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
            label: "Gallery",
            active: viewMode === "gallery",
            className: "subnav-cell--view-density",
            node: (
              <ViewDensityControl
                active={viewMode === "gallery"}
                columns={galleryColumns}
                label="Gallery"
                maxColumns={8}
                minColumns={2}
                onColumnsChange={onGalleryColumnsChange}
                onSelect={() => onViewModeChange("gallery")}
              />
            ),
          },
          {
            key: "masonry-control",
            label: "Masonry",
            active: viewMode === "masonry",
            className: "subnav-cell--view-density",
            node: (
              <ViewDensityControl
                active={viewMode === "masonry"}
                columns={masonryColumns}
                label="Masonry"
                maxColumns={8}
                minColumns={2}
                onColumnsChange={onMasonryColumnsChange}
                onSelect={() => onViewModeChange("masonry")}
              />
            ),
          },
          {
            key: "list",
            label: "List",
            active: viewMode === "list",
            onClick: () => onViewModeChange("list"),
          },
          {
            key: "graph",
            label: "Graph",
            active: viewMode === "graph",
            onClick: () => onViewModeChange("graph"),
          },
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
      onClick: () => openFilter("state"),
    },
    {
      key: "filter-kind",
      label: "Kind",
      active: activeFilterFamily === "kind",
      onClick: () => openFilter("kind"),
    },
    {
      key: "filter-source",
      label: "Source",
      active: activeFilterFamily === "source",
      onClick: () => openFilter("source"),
    },
    {
      key: "filter-collection",
      label: "Collection",
      active: activeFilterFamily === "collection",
      onClick: () => openFilter("collection"),
    },
    {
      key: "filter-more",
      label: "More",
      active: activeFilterFamily === "more",
      onClick: () => openFilter("more"),
    },
  ];

  return [{ key: "filters-family", items: familyItems }];
}

function FilterPopoverIsland({
  collectionIndex,
  family,
  filters,
  formatOptions,
  loading,
  onClose,
  onCollectionFilterChange,
  onFormatChange,
  onSourceChange,
  onStatusChange,
  onTypeChange,
  sourceOptions,
  statusOptions,
}: {
  collectionIndex: CollectionIndexItem[];
  family: FilterFamily;
  filters: ItemCardFilters;
  formatOptions: ArchiveFormatFilter[];
  loading: boolean;
  onClose: () => void;
  onCollectionFilterChange: (collection: string) => void;
  onFormatChange: (format: ArchiveFormatFilter) => void;
  onSourceChange: (source: ArchiveSourceFilter) => void;
  onStatusChange: (status: ArchiveStatusFilter) => void;
  onTypeChange: (type: ArchiveTypeFilter) => void;
  sourceOptions: ArchiveSourceFilter[];
  statusOptions: ArchiveStatusFilter[];
}) {
  const islandRef = useRef<HTMLElement | null>(null);
  const [collectionQuery, setCollectionQuery] = useState("");
  const normalizedCollectionQuery = collectionQuery.trim().toLowerCase();
  const visibleCollections = normalizedCollectionQuery
    ? collectionIndex.filter((collection) =>
        [collection.name, collection.description, collection.kindSummary]
          .filter((part): part is string => Boolean(part))
          .join(" ")
          .toLowerCase()
          .includes(normalizedCollectionQuery),
      )
    : collectionIndex;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (islandRef.current?.contains(target) || (target instanceof Element && target.closest(".pill-nav__subnav"))) {
        return;
      }

      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const selectStatus = (status: ArchiveStatusFilter) => {
    onStatusChange(status);
    onClose();
  };
  const selectSource = (source: ArchiveSourceFilter) => {
    onSourceChange(source);
    onClose();
  };
  const selectFormat = (format: ArchiveFormatFilter) => {
    onFormatChange(format);
    onClose();
  };
  const selectCollection = (collection: string) => {
    onCollectionFilterChange(collection);
    onClose();
  };
  const selectKind = (option: { filterType: "type"; type: ArchiveTypeFilter } | { filterType: "format"; format: ArchiveFormatFilter }) => {
    if (option.filterType === "format") {
      onTypeChange("all");
      onFormatChange(option.format);
    } else {
      onFormatChange("all");
      onTypeChange(option.type);
    }
    onClose();
  };

  return (
    <section className="filter-popover-island" data-family={family} ref={islandRef} aria-label={`${family} filter options`}>
      <header className="filter-popover-island__header">
        <span>{formatFilterFamilyLabel(family)}</span>
        <button type="button" onClick={onClose}>Close</button>
      </header>

      {family === "state" ? (
        <div className="filter-popover-island__list">
          {statusOptions.map((option) => (
            <FilterOptionRow
              active={(filters.status ?? "all") === option}
              disabled={loading}
              key={option}
              label={formatStateOption(option)}
              onClick={() => selectStatus(option)}
            />
          ))}
        </div>
      ) : null}

      {family === "kind" ? (
        <div className="filter-popover-island__grid">
          {getKindFilterOptions().map((option) => {
            const active = option.filterType === "format"
              ? filters.format === option.format
              : option.type === "all"
                ? !filters.type && !filters.format
                : filters.type === option.type && !filters.format;
            return (
              <FilterOptionRow
                active={active}
                disabled={loading}
                key={`kind:${option.key}`}
                label={option.label}
                onClick={() => selectKind(option)}
              />
            );
          })}
        </div>
      ) : null}

      {family === "source" ? (
        <div className="filter-popover-island__grid">
          {getSourceFilterOptions(sourceOptions).map((option) => (
            <FilterOptionRow
              active={(filters.source ?? "all") === option}
              disabled={loading}
              key={`source:${option}`}
              label={formatSourceOption(option)}
              onClick={() => selectSource(option)}
            />
          ))}
        </div>
      ) : null}

      {family === "collection" ? (
        <div className="filter-popover-island__collections">
          <input
            autoFocus
            aria-label="search collections"
            onChange={(event) => setCollectionQuery(event.currentTarget.value)}
            placeholder="Search collections"
            type="search"
            value={collectionQuery}
          />
          <div className="filter-popover-island__list filter-popover-island__list--collections">
            <FilterOptionRow
              active={!filters.collection}
              disabled={loading}
              label="All Collections"
              onClick={() => selectCollection("all")}
            />
            <FilterOptionRow
              active={filters.collection === "none"}
              copy="Items that do not belong to a collection."
              disabled={loading}
              label="Uncollected"
              onClick={() => selectCollection("none")}
            />
            {visibleCollections.map((collection) => (
              <CollectionFilterRow
                active={filters.collection === collection.id}
                collection={collection}
                disabled={loading}
                key={collection.id}
                onClick={() => selectCollection(collection.id)}
              />
            ))}
            {visibleCollections.length === 0 ? (
              <span className="filter-popover-island__empty">No collections match that search.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {family === "more" ? (
        <div className="filter-popover-island__grid">
          {formatOptions.map((option) => (
            <FilterOptionRow
              active={(filters.format ?? "all") === option}
              disabled={loading}
              key={`format:${option}`}
              label={formatTechnicalOption(option)}
              onClick={() => selectFormat(option)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FilterOptionRow({
  active,
  copy,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  copy?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="filter-popover-island__option"
      data-active={active ? "true" : "false"}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span>{label}</span>
      {copy ? <small>{copy}</small> : null}
    </button>
  );
}

function CollectionFilterRow({
  active,
  collection,
  disabled,
  onClick,
}: {
  active: boolean;
  collection: CollectionIndexItem;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="filter-popover-island__collection-option"
      data-active={active ? "true" : "false"}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span className="filter-popover-island__collection-preview" aria-hidden="true">
        {collection.previewItems.slice(0, 3).map((item) => {
          const imageUrl = item.thumbnailUrl || item.imageUrl || item.ogImageUrl || item.videoPosterUrl;
          return imageUrl ? <img src={imageUrl} alt="" key={item.id} /> : <span key={item.id}>{getCollectionPreviewLabel(item.kind, item.format)}</span>;
        })}
      </span>
      <span className="filter-popover-island__collection-copy">
        <strong>{collection.name}</strong>
        <small>{formatCollectionCount(collection.pieceCount)} · {collection.kindSummary}</small>
      </span>
    </button>
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
      <span className="nav-cell__text-mask">
        <span className="nav-cell__text-bleed">
          <span className="nav-cell__text">{label}</span>
        </span>
      </span>
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
              {readError ? "Archive read error" : "Archive connected"} · Product Sans/system stack
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
  const content = (
    <span className="nav-cell__text-mask">
      <span className="nav-cell__text-bleed">
        <span className="nav-cell__text">{node ?? children}</span>
      </span>
    </span>
  );
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
  return {
    "--cell-index": index,
  };
}

function getKindFilterOptions(): Array<
  | { filterType: "type"; key: ArchiveTypeFilter; label: string; type: ArchiveTypeFilter }
  | { filterType: "format"; key: ArchiveFormatFilter; label: string; format: ArchiveFormatFilter }
> {
  return [
    { filterType: "type", key: "all", label: "All Kinds", type: "all" },
    { filterType: "type", key: "image", label: "Image", type: "image" },
    { filterType: "type", key: "caption", label: "Caption", type: "caption" },
    { filterType: "type", key: "note", label: "Note", type: "note" },
    { filterType: "type", key: "link", label: "Link", type: "link" },
    { filterType: "format", key: "pdf", label: "PDF", format: "pdf" },
    { filterType: "format", key: "video", label: "Video", format: "video" },
    { filterType: "format", key: "website", label: "Website", format: "website" },
  ];
}

function getSourceFilterOptions(sourceOptions: ArchiveSourceFilter[]) {
  return Array.from(new Set<ArchiveSourceFilter>(["all", ...sourceOptions]));
}

function formatStateOption(option: ArchiveStatusFilter): string {
  return option === "all" ? "All States" : option.charAt(0).toUpperCase() + option.slice(1);
}

function formatSourceOption(option: ArchiveSourceFilter): string {
  if (option === "all") {
    return "All Sources";
  }

  if (option === "arena") {
    return "Are.na";
  }

  return option.replace("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTechnicalOption(option: ArchiveFormatFilter): string {
  if (option === "all") {
    return "All Formats";
  }

  return option.toUpperCase() === option ? option : option.charAt(0).toUpperCase() + option.slice(1);
}

function formatTypeFilterLabel(type: ItemType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatFilterFamilyLabel(family: FilterFamily) {
  if (family === "more") {
    return "More";
  }

  return family.charAt(0).toUpperCase() + family.slice(1);
}

function getCollectionPreviewLabel(kind: string, format?: string | null) {
  if (format === "pdf") {
    return "PDF";
  }

  if (format === "video") {
    return "video";
  }

  return kind.slice(0, 1).toUpperCase();
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
