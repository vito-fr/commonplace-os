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

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      const scaleX = nextRect.width > 0 ? previousRect.width / nextRect.width : 1;
      const scaleY = nextRect.height > 0 ? previousRect.height / nextRect.height : 1;
      const moved = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;
      const resized = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01;

      if (!moved && !resized) {
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
            transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`,
            transformOrigin: "top left",
          },
          {
            transform: "translate3d(0, 0, 0) scale(1, 1)",
            transformOrigin: "top left",
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
