import { useLayoutEffect, useRef, type RefObject } from "react";

const gridFlipDuration = 420;
const gridFlipEase = "cubic-bezier(0.2, 0.88, 0.2, 1)";

export function useGridFlipAnimation(
  containerRef: RefObject<HTMLElement | null>,
  signature: string,
) {
  const previousRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const hasMeasuredRef = useRef(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") {
      return;
    }

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-archive-key]"),
    );
    const nextRects = new Map<string, DOMRect>();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (const element of elements) {
      const key = element.dataset.archiveKey;
      if (!key) {
        continue;
      }

      const nextRect = element.getBoundingClientRect();
      nextRects.set(key, nextRect);

      const previousRect = previousRectsRef.current.get(key);
      if (!previousRect || !hasMeasuredRef.current || prefersReducedMotion) {
        continue;
      }

      const deltaX = snapToDevicePixel(previousRect.left - nextRect.left);
      const deltaY = snapToDevicePixel(previousRect.top - nextRect.top);
      const moved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

      if (!moved) {
        continue;
      }

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

      element.animate(
        [
          {
            transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`,
          },
          {
            transform: "translate3d(0, 0, 0)",
          },
        ],
        {
          duration: gridFlipDuration,
          easing: gridFlipEase,
        },
      );
    }

    previousRectsRef.current = nextRects;
    hasMeasuredRef.current = true;
  }, [containerRef, signature]);
}

function snapToDevicePixel(value: number) {
  if (typeof window === "undefined") {
    return Math.round(value);
  }

  const ratio = window.devicePixelRatio || 1;
  return Math.round(value * ratio) / ratio;
}
