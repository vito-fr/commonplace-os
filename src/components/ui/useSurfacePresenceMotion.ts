import { useLayoutEffect, type RefObject } from "react";
import { gsap } from "../../motion/MotionShell";

type PresenceState = "enter" | "exit";

type SurfacePresenceMotionOptions = {
  contentSelector?: string;
  membraneSelector?: string;
  y?: number;
};

export function useSurfacePresenceMotion(
  rootRef: RefObject<HTMLElement | null>,
  state: PresenceState,
  {
    contentSelector = ".ui-surface-content",
    membraneSelector = ".ui-surface-membrane",
    y = 8,
  }: SurfacePresenceMotionOptions = {},
) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const content = Array.from(root.querySelectorAll<HTMLElement>(contentSelector));
    const membranes = Array.from(root.querySelectorAll<HTMLElement>(membraneSelector));
    const targets = [root, ...content, ...membranes];
    const blurTarget = readSurfaceVariable(root, "--ui-surface-blur-target", "26px");
    const saturateTarget = readSurfaceVariable(root, "--ui-surface-saturate-target", "1.18");

    gsap.killTweensOf(targets);
    gsap.set(membranes, { opacity: 1, visibility: "visible", clearProps: "filter,transform" });

    if (prefersReducedMotion) {
      gsap.set(root, { clearProps: "transform" });
      gsap.set(membranes, {
        "--ui-surface-blur": state === "enter" ? blurTarget : "0.01px",
        "--ui-surface-saturate": state === "enter" ? saturateTarget : "1",
      });
      if (state === "enter") {
        gsap.set(content, { clearProps: "opacity,transform" });
      } else {
        gsap.set(content, { opacity: 0, clearProps: "transform" });
      }
      return;
    }

    if (state === "enter") {
      gsap.set(root, { scale: 0.985, transformOrigin: "50% 100%", y });
      gsap.set(membranes, {
        "--ui-surface-blur": "0.01px",
        "--ui-surface-saturate": "1",
      });
      gsap.set(content, { opacity: 0, y: Math.max(3, y - 2) });
      gsap
        .timeline({ defaults: { overwrite: true } })
        .to(membranes, {
          "--ui-surface-blur": blurTarget,
          "--ui-surface-saturate": saturateTarget,
          duration: 0.32,
          ease: "power2.out",
        }, 0)
        .to(root, {
          duration: 0.36,
          ease: "power3.out",
          scale: 1,
          y: 0,
          onComplete: () => {
            gsap.set(root, { clearProps: "transform,transformOrigin" });
          },
        }, 0)
        .to(content, {
          opacity: 1,
          duration: 0.34,
          ease: "power3.out",
          stagger: 0.025,
          y: 0,
          onComplete: () => {
            gsap.set(content, { clearProps: "opacity,transform" });
          },
        }, 0.04);
      return;
    }

    gsap
      .timeline({ defaults: { overwrite: true } })
      .to(membranes, {
        "--ui-surface-blur": "0.01px",
        "--ui-surface-saturate": "1.04",
        duration: 0.12,
        ease: "power2.in",
      }, 0.18)
      .to(content, {
        opacity: 0,
        duration: 0.18,
        ease: "power2.in",
        y: -Math.max(3, y - 3),
      }, 0)
      .to(root, {
        duration: 0.28,
        ease: "power2.in",
        scale: 0.99,
        y: -y,
      }, 0.02);
  }, [contentSelector, membraneSelector, rootRef, state, y]);
}

function readSurfaceVariable(element: HTMLElement, name: string, fallback: string) {
  const value = window.getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}
