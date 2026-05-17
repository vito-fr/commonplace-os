import { useEffect } from "react";
import { gsap } from "../../motion/MotionShell";

const pressSelector = "[data-press-feedback]";
const pressTargetSelector = "[data-press-target]";
const minPressDurationMs = 118;
const pressedScale = 0.935;
const activeScale = 0.96;
let mountedScopes = 0;
let pressedElement: HTMLElement | null = null;
let pressedTarget: HTMLElement | null = null;
let pressedAt = 0;
let releaseTimeout = 0;
let cleanupGlobalListeners: (() => void) | null = null;

export function usePressFeedback() {
  useEffect(() => {
    mountedScopes += 1;
    if (cleanupGlobalListeners || typeof document === "undefined") {
      return () => {
        mountedScopes = Math.max(0, mountedScopes - 1);
        cleanupIfUnused();
      };
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const element = target.closest<HTMLElement>(pressSelector);
      if (!element || isDisabled(element)) {
        return;
      }

      press(element);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const element = target.closest<HTMLElement>(pressSelector);
      if (!element || isDisabled(element)) {
        return;
      }

      press(element);
    };
    const release = () => releasePressedElement();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    document.addEventListener("keyup", release, true);
    document.addEventListener("blur", release, true);

    cleanupGlobalListeners = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
      document.removeEventListener("keyup", release, true);
      document.removeEventListener("blur", release, true);
      if (releaseTimeout) {
        window.clearTimeout(releaseTimeout);
        releaseTimeout = 0;
      }
      pressedElement = null;
      pressedTarget = null;
    };

    return () => {
      mountedScopes = Math.max(0, mountedScopes - 1);
      cleanupIfUnused();
    };
  }, []);
}

function cleanupIfUnused() {
  if (mountedScopes > 0 || !cleanupGlobalListeners) {
    return;
  }

  cleanupGlobalListeners();
  cleanupGlobalListeners = null;
}

function press(element: HTMLElement) {
  if (pressedElement && pressedElement !== element) {
    releasePressedElement();
  }

  if (releaseTimeout) {
    window.clearTimeout(releaseTimeout);
    releaseTimeout = 0;
  }

  const target = getPressTarget(element);
  pressedElement = element;
  pressedTarget = target;
  pressedAt = performance.now();
  element.dataset.pressVisual = "true";
  target.dataset.pressVisual = "true";
  gsap.killTweensOf(target);
  gsap.to(target, {
    duration: 0.1,
    ease: "power3.out",
    force3D: "auto",
    overwrite: true,
    scale: pressedScale,
  });
}

function releasePressedElement() {
  const element = pressedElement;
  const target = pressedTarget;
  if (!element || !target) {
    return;
  }

  const elapsed = performance.now() - pressedAt;
  const remaining = Math.max(0, minPressDurationMs - elapsed);
  if (releaseTimeout) {
    window.clearTimeout(releaseTimeout);
  }

  releaseTimeout = window.setTimeout(() => {
    const nextScale = isActive(element) ? activeScale : 1;
    element.dataset.pressVisual = "false";
    target.dataset.pressVisual = "false";
    gsap.killTweensOf(target);
    gsap
      .timeline({ defaults: { overwrite: true } })
      .to(target, {
        duration: 0.13,
        ease: "power2.out",
        force3D: "auto",
        scale: nextScale === 1 ? 1.025 : 0.985,
      })
      .to(target, {
        duration: 0.2,
        ease: "elastic.out(1, 0.72)",
        force3D: "auto",
        scale: nextScale,
        onComplete: () => {
          if (!isActive(element)) {
            gsap.set(target, { clearProps: "transform" });
          }
        },
      });
    if (pressedElement === element) {
      pressedElement = null;
      pressedTarget = null;
    }
    releaseTimeout = 0;
  }, remaining);
}

function isDisabled(element: HTMLElement) {
  return element.getAttribute("aria-disabled") === "true" || "disabled" in element && Boolean((element as HTMLButtonElement).disabled);
}

function isActive(element: HTMLElement) {
  return (
    element.getAttribute("aria-expanded") === "true" ||
    element.getAttribute("aria-pressed") === "true" ||
    element.dataset.active === "true" ||
    element.dataset.confirming === "true"
  );
}

function getPressTarget(element: HTMLElement) {
  return element.querySelector<HTMLElement>(pressTargetSelector) ?? element;
}
