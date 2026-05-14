import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const gridFlipDuration = 240;
const gridFlipEase = "cubic-bezier(0.25, 0, 0, 1)";
const gridResizeFlipDuration = 220;
const gridResizeFlipEase = "cubic-bezier(0.2, 0, 0.2, 1)";
const gridFlipActiveAttribute = "data-grid-flip";
const viewportResizeFlipSuppressMs = 360;

type GridFlipReason = "layout" | "resize";

type GridFlipRect = Pick<DOMRect, "bottom" | "height" | "left" | "right" | "top" | "width">;

type GridFlipOptions = {
  disabled?: boolean;
  maxResizeItems?: number;
  reason?: GridFlipReason;
  scaleChildSelector?: string;
  suppressViewportResize?: boolean;
};

const activeFlipAnimations = new WeakMap<HTMLElement, Animation>();
const activeScaleAnimations = new WeakMap<HTMLElement, Animation>();

export function useGridFlipAnimation(
  containerRef: RefObject<HTMLElement | null>,
  signature: string,
  options: GridFlipOptions = {},
) {
  const previousRectsRef = useRef<Map<string, GridFlipRect>>(new Map());
  const hasMeasuredRef = useRef(false);
  const previousViewportWidthRef = useRef<number | null>(null);
  const suppressFlipUntilRef = useRef(0);
  const disabled = options.disabled ?? false;
  const maxResizeItems = options.maxResizeItems ?? 90;
  const reason = options.reason ?? "layout";
  const scaleChildSelector = options.scaleChildSelector;
  const suppressViewportResize = options.suppressViewportResize ?? true;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const suppressViewportFlip = () => {
      suppressFlipUntilRef.current = performance.now() + viewportResizeFlipSuppressMs;
      cancelGridFlipAnimations(containerRef.current);
    };

    if (!suppressViewportResize) {
      return undefined;
    }

    window.addEventListener("resize", suppressViewportFlip);
    window.visualViewport?.addEventListener("resize", suppressViewportFlip);

    return () => {
      window.removeEventListener("resize", suppressViewportFlip);
      window.visualViewport?.removeEventListener("resize", suppressViewportFlip);
    };
  }, [containerRef, suppressViewportResize]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") {
      return;
    }

    const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-archive-key]"));
    const containerRect = container.getBoundingClientRect();
    const nextRects = new Map<string, GridFlipRect>();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewportWidth = getViewportWidth();
    const viewportResized =
      previousViewportWidthRef.current != null && Math.abs(viewportWidth - previousViewportWidthRef.current) > 1;
    const suppressViewportMotion =
      suppressViewportResize && (viewportResized || performance.now() < suppressFlipUntilRef.current);
    const debugPerformance = isGridPerformanceDebugEnabled();
    const readStart = debugPerformance ? performance.now() : 0;
    const moves: Array<{
      deltaX: number;
      deltaY: number;
      element: HTMLElement;
      previousRect: GridFlipRect;
      nextRect: GridFlipRect;
    }> = [];

    for (const element of elements) {
      const key = element.dataset.archiveKey;
      if (!key) {
        continue;
      }

      const nextRect = getArchiveElementRect(element, containerRect);
      nextRects.set(key, nextRect);
      const previousRect = previousRectsRef.current.get(key);
      if (!previousRect || !hasMeasuredRef.current || disabled || prefersReducedMotion || suppressViewportMotion) {
        continue;
      }

      const deltaX = snapToDevicePixel(previousRect.left - nextRect.left);
      const deltaY = snapToDevicePixel(previousRect.top - nextRect.top);
      const resized = Math.abs(previousRect.width - nextRect.width) > 0.5 || Math.abs(previousRect.height - nextRect.height) > 0.5;
      const moved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

      if ((moved || resized) && isNearViewport(previousRect, nextRect, reason)) {
        moves.push({ deltaX, deltaY, element, previousRect, nextRect });
      }
    }

    const readDuration = debugPerformance ? performance.now() - readStart : 0;
    const writeStart = debugPerformance ? performance.now() : 0;
    const animations: Animation[] = [];

    if (disabled) {
      cancelGridFlipAnimations(container);
    }

    if (moves.length > 0) {
      container.setAttribute(gridFlipActiveAttribute, "active");
    }

    const activeMoves = reason === "resize" ? moves.slice(0, maxResizeItems) : moves;
    const duration = reason === "resize" ? gridResizeFlipDuration : gridFlipDuration;
    const easing = reason === "resize" ? gridResizeFlipEase : gridFlipEase;

    for (const { deltaX, deltaY, element, previousRect, nextRect } of activeMoves) {
      const layoutTransform = getLayoutTransform(element);
      const child = getScaleChild(element, scaleChildSelector);
      const scaleX = previousRect.width / Math.max(1, nextRect.width);
      const scaleY = previousRect.height / Math.max(1, nextRect.height);
      const shouldScale = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;

      if (layoutTransform) {
        if (!child) {
          continue;
        }

        cancelActiveAnimation(activeScaleAnimations, child);
        child.style.transformOrigin = "0 0";
        child.style.willChange = "transform";
        const childAnimation = child.animate(
          [
            { transform: formatMotionTransform(deltaX, deltaY, scaleX, scaleY) },
            { transform: "translate3d(0, 0, 0) scale(1, 1)" },
          ],
          {
            duration,
            easing,
          },
        );
        activeScaleAnimations.set(child, childAnimation);
        bindAnimationCleanup(activeScaleAnimations, child, childAnimation);
        animations.push(childAnimation);
        continue;
      }

      cancelActiveAnimation(activeFlipAnimations, element);
      element.style.willChange = "transform";

      const animation = element.animate(
        [
          { transform: formatTranslate(deltaX, deltaY) },
          { transform: formatTranslate(0, 0) },
        ],
        {
          duration,
          easing,
        },
      );
      activeFlipAnimations.set(element, animation);
      bindAnimationCleanup(activeFlipAnimations, element, animation);
      animations.push(animation);

      if (child && shouldScale) {
        cancelActiveAnimation(activeScaleAnimations, child);
        child.style.transformOrigin = "0 0";
        child.style.willChange = "transform";
        const childAnimation = child.animate(
          [
            { transform: `scale(${roundFlipValue(scaleX)}, ${roundFlipValue(scaleY)})` },
            { transform: "scale(1, 1)" },
          ],
          {
            duration,
            easing,
          },
        );
        activeScaleAnimations.set(child, childAnimation);
        bindAnimationCleanup(activeScaleAnimations, child, childAnimation);
        animations.push(childAnimation);
      }
    }

    if (moves.length > 0) {
      Promise.allSettled(animations.map((animation) => animation.finished)).finally(() => {
        if (containerRef.current === container) {
          container.removeAttribute(gridFlipActiveAttribute);
        }
      });
    } else {
      container.removeAttribute(gridFlipActiveAttribute);
    }

    if (debugPerformance) {
      const writeDuration = performance.now() - writeStart;
      const totalDuration = readDuration + writeDuration;
      performance.measure("grid-density-flip", {
        detail: {
          itemCount: elements.length,
          movedCount: activeMoves.length,
          readDuration,
          reason,
          writeDuration,
        },
        duration: totalDuration,
        start: readStart,
      });
      if (totalDuration > 16) {
        console.warn("[grid-density-performance]", {
          itemCount: elements.length,
          movedCount: activeMoves.length,
          readDuration,
          reason,
          totalDuration,
          writeDuration,
        });
      }
    }

    previousRectsRef.current = nextRects;
    previousViewportWidthRef.current = viewportWidth;
    if (viewportResized && suppressViewportResize) {
      suppressFlipUntilRef.current = performance.now() + viewportResizeFlipSuppressMs;
      cancelGridFlipAnimations(container);
    }
    hasMeasuredRef.current = true;
  }, [containerRef, disabled, maxResizeItems, reason, scaleChildSelector, signature, suppressViewportResize]);
}

function bindAnimationCleanup(
  registry: WeakMap<HTMLElement, Animation>,
  element: HTMLElement,
  animation: Animation,
) {
  const cleanup = () => {
    if (registry.get(element) === animation) {
      registry.delete(element);
    }
    element.style.willChange = "";
    element.style.transformOrigin = "";
  };

  animation.addEventListener("finish", cleanup, { once: true });
  animation.addEventListener("cancel", cleanup, { once: true });
}

function cancelActiveAnimation(registry: WeakMap<HTMLElement, Animation>, element: HTMLElement) {
  const animation = registry.get(element);
  if (!animation) {
    return;
  }

  animation.cancel();
  registry.delete(element);
  element.style.willChange = "";
  element.style.transformOrigin = "";
}

function getScaleChild(element: HTMLElement, selector: string | undefined) {
  if (!selector) {
    return null;
  }

  const child = element.querySelector<HTMLElement>(selector);
  if (!child || child.dataset.introState === "active") {
    return null;
  }

  return child;
}

function getLayoutTransform(element: HTMLElement) {
  const x = Number.parseFloat(element.dataset.layoutX ?? "");
  const y = Number.parseFloat(element.dataset.layoutY ?? "");
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function getArchiveElementRect(element: HTMLElement, containerRect: GridFlipRect): GridFlipRect {
  const layoutTransform = getLayoutTransform(element);
  const width = Number.parseFloat(element.style.width);
  const height = Number.parseFloat(element.style.height);
  if (layoutTransform && Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    const left = containerRect.left + layoutTransform.x;
    const top = containerRect.top + layoutTransform.y;
    return {
      bottom: top + height,
      height,
      left,
      right: left + width,
      top,
      width,
    };
  }

  return element.getBoundingClientRect();
}

function formatTranslate(x: number, y: number) {
  return `translate3d(${roundFlipValue(x)}px, ${roundFlipValue(y)}px, 0)`;
}

function formatMotionTransform(x: number, y: number, scaleX: number, scaleY: number) {
  return `${formatTranslate(x, y)} scale(${roundFlipValue(scaleX)}, ${roundFlipValue(scaleY)})`;
}

function roundFlipValue(value: number) {
  return Math.round(value * 1000) / 1000;
}

function isNearViewport(previousRect: GridFlipRect, nextRect: GridFlipRect, reason: GridFlipReason) {
  if (typeof window === "undefined") {
    return true;
  }

  const buffer = reason === "resize" ? 600 : Math.max(480, window.innerHeight * 0.75);
  return previousRect.bottom >= -buffer && nextRect.bottom >= -buffer && previousRect.top <= window.innerHeight + buffer && nextRect.top <= window.innerHeight + buffer;
}

function getViewportWidth() {
  if (typeof window === "undefined") {
    return 0;
  }

  return Math.round(window.visualViewport?.width ?? document.documentElement.clientWidth ?? window.innerWidth);
}

function cancelGridFlipAnimations(container: HTMLElement | null) {
  if (!container) {
    return;
  }

  container.removeAttribute(gridFlipActiveAttribute);
  container.querySelectorAll<HTMLElement>("[data-archive-key]").forEach((element) => {
    cancelActiveAnimation(activeFlipAnimations, element);
    element.querySelectorAll<HTMLElement>("*").forEach((child) => cancelActiveAnimation(activeScaleAnimations, child));
  });
}

function snapToDevicePixel(value: number) {
  if (typeof window === "undefined") {
    return Math.round(value);
  }

  const ratio = window.devicePixelRatio || 1;
  return Math.round(value * ratio) / ratio;
}

function isGridPerformanceDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    new URLSearchParams(window.location.search).get("debugPerformance") === "1" ||
    window.location.hash.includes("debugPerformance=1")
  );
}
