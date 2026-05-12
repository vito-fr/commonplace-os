import { useLayoutEffect, useRef, type RefObject } from "react";

const gridFlipDuration = 420;
const gridFlipEase = "cubic-bezier(0.2, 0.88, 0.2, 1)";
const gridFlipActiveAttribute = "data-grid-flip";

export function useGridFlipAnimation(
  containerRef: RefObject<HTMLElement | null>,
  signature: string,
  options: { disabled?: boolean } = {},
) {
  const previousRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const hasMeasuredRef = useRef(false);
  const disabled = options.disabled ?? false;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") {
      return;
    }

    const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-archive-key]"));
    const nextRects = new Map<string, DOMRect>();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const debugPerformance = isGridPerformanceDebugEnabled();
    const readStart = debugPerformance ? performance.now() : 0;
    const moves: Array<{
      deltaX: number;
      deltaY: number;
      element: HTMLElement;
    }> = [];

    for (const element of elements) {
      const key = element.dataset.archiveKey;
      if (!key) {
        continue;
      }

      const nextRect = element.getBoundingClientRect();
      nextRects.set(key, nextRect);

      const previousRect = previousRectsRef.current.get(key);
      if (!previousRect || !hasMeasuredRef.current || prefersReducedMotion || disabled) {
        continue;
      }

      const deltaX = snapToDevicePixel(previousRect.left - nextRect.left);
      const deltaY = snapToDevicePixel(previousRect.top - nextRect.top);
      const moved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

      if (moved) {
        moves.push({ deltaX, deltaY, element });
      }
    }

    const readDuration = debugPerformance ? performance.now() - readStart : 0;
    const writeStart = debugPerformance ? performance.now() : 0;
    const animations: Animation[] = [];

    if (moves.length > 0) {
      container.setAttribute(gridFlipActiveAttribute, "active");
    }

    for (const { deltaX, deltaY, element } of moves) {
      element.getAnimations().forEach((animation) => {
        const effect = animation.effect;
        if (
          typeof KeyframeEffect !== "undefined" &&
          effect instanceof KeyframeEffect &&
          effect.target === element
        ) {
          animation.cancel();
        }
      });
      element.style.willChange = "transform";

      const animation = element.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px)`,
          },
          {
            transform: "translate(0px, 0px)",
          },
        ],
        {
          duration: gridFlipDuration,
          easing: gridFlipEase,
        },
      );
      animation.addEventListener("finish", () => {
        element.style.willChange = "";
      }, { once: true });
      animation.addEventListener("cancel", () => {
        element.style.willChange = "";
      }, { once: true });
      animations.push(animation);
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
          movedCount: moves.length,
          readDuration,
          writeDuration,
        },
        duration: totalDuration,
        start: readStart,
      });
      if (totalDuration > 16) {
        console.warn("[grid-density-performance]", {
          itemCount: elements.length,
          movedCount: moves.length,
          readDuration,
          totalDuration,
          writeDuration,
        });
      }
    }

    previousRectsRef.current = nextRects;
    hasMeasuredRef.current = true;
  }, [containerRef, disabled, signature]);
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
