import { useLayoutEffect, type RefObject } from "react";
import { gsap } from "../../motion/MotionShell";

type GridIntroMotionOptions = {
  enabled: boolean;
  selector: string;
  signature: string;
  y?: number;
};

export function useGridIntroMotion<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  { enabled, selector, signature, y = 10 }: GridIntroMotionOptions,
) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container || typeof window === "undefined") {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (target) => target.dataset.gsapIntro !== "settled",
    );

    if (targets.length === 0) {
      return undefined;
    }

    if (prefersReducedMotion) {
      for (const target of targets) {
        target.dataset.gsapIntro = "settled";
        target.dataset.introState = "settled";
      }
      gsap.set(targets, { clearProps: "opacity,transform" });
      return undefined;
    }

    for (const target of targets) {
      target.dataset.gsapIntro = "running";
    }

    gsap.set(targets, {
      autoAlpha: 0,
      force3D: "auto",
      scale: 0.985,
      y,
    });

    const tween = gsap.to(targets, {
      autoAlpha: 1,
      clearProps: "opacity,visibility,transform",
      delay: 0.02,
      duration: 0.52,
      ease: "power3.out",
      force3D: "auto",
      overwrite: true,
      scale: 1,
      stagger: {
        amount: Math.min(0.44, targets.length * 0.018),
        ease: "power2.out",
      },
      y: 0,
      onComplete: () => {
        for (const target of targets) {
          target.dataset.gsapIntro = "settled";
          target.dataset.introState = "settled";
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, [containerRef, enabled, selector, signature, y]);
}
