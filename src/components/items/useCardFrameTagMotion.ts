import { useLayoutEffect, type RefObject } from "react";
import { gsap } from "../../motion/MotionShell";

const frameTagSelector = "[data-card-frame-tag]";

export function useCardFrameTagMotion<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  isActive: boolean,
  signature: string,
) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") {
      return undefined;
    }

    const tags = Array.from(container.querySelectorAll<HTMLElement>(frameTagSelector));
    if (tags.length === 0) {
      return undefined;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gsap.killTweensOf(tags);

    if (prefersReducedMotion) {
      gsap.set(tags, { clearProps: "filter,transform" });
      gsap.set(tags, { autoAlpha: isActive ? 1 : 0 });
      return undefined;
    }

    if (isActive) {
      gsap.set(tags, {
        autoAlpha: 0,
        filter: "blur(8px)",
        y: 14,
      });

      const tween = gsap.to(tags, {
        autoAlpha: 1,
        duration: 0.42,
        ease: "power3.out",
        filter: "blur(0px)",
        overwrite: true,
        stagger: 0.035,
        y: 0,
        onComplete: () => {
          gsap.set(tags, { clearProps: "filter,transform" });
        },
      });

      return () => {
        tween.kill();
      };
    }

    const tween = gsap.to(tags, {
      autoAlpha: 0,
      duration: 0.2,
      ease: "power2.in",
      filter: "blur(7px)",
      overwrite: true,
      stagger: { each: 0.02, from: "end" },
      y: 10,
      onComplete: () => {
        gsap.set(tags, { clearProps: "filter,transform" });
      },
    });

    return () => {
      tween.kill();
    };
  }, [containerRef, isActive, signature]);
}
