import {
  cloneElement,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
import { gsap } from "../../motion/MotionShell";
import { usePressFeedback } from "./usePressFeedback";

type ActionHintChildProps = {
  "aria-describedby"?: string;
};

export type ActionHintSide = "bottom" | "left" | "right" | "top";
export type ActionHintAlign = "center" | "end" | "start";

export function ActionHint({
  align = "center",
  children,
  className = "",
  disabled = false,
  label,
  shortcut,
  side = "bottom",
}: {
  children: ReactNode;
  align?: ActionHintAlign;
  className?: string;
  disabled?: boolean;
  label: string;
  shortcut?: string;
  side?: ActionHintSide;
}) {
  usePressFeedback();

  const tooltipId = useId();
  const [isDismissed, setIsDismissed] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const shortcutRef = useRef<HTMLElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const isVisibleRef = useRef(false);
  const child =
    isValidElement<ActionHintChildProps>(children)
      ? cloneElement(children as ReactElement<ActionHintChildProps>, {
          "aria-describedby": disabled ? undefined : tooltipId,
        })
      : children;
  const hideHint = useCallback(() => {
    const bubble = bubbleRef.current;
    if (!bubble || !isVisibleRef.current) {
      return;
    }

    isVisibleRef.current = false;
    gsap.killTweensOf([bubble, labelRef.current, shortcutRef.current].filter(Boolean));
    gsap.to(bubble, {
      autoAlpha: 0,
      duration: 0.12,
      ease: "power2.in",
      overwrite: true,
      scaleX: 0.96,
      x: getHiddenOffset(side),
    });
    gsap.to([labelRef.current, shortcutRef.current].filter(Boolean), {
      autoAlpha: 0,
      duration: 0.1,
      ease: "power2.in",
      overwrite: true,
      x: side === "right" ? -4 : 4,
    });
  }, [side]);
  const showHint = useCallback(() => {
    const bubble = bubbleRef.current;
    const labelElement = labelRef.current;
    const shortcutElement = shortcutRef.current;
    if (disabled || isVisibleRef.current || !bubble || !labelElement) {
      return;
    }

    isVisibleRef.current = true;
    gsap.killTweensOf([bubble, labelElement, shortcutElement].filter(Boolean));
    gsap.set(bubble, {
      transformOrigin: side === "right" ? "0 50%" : side === "left" ? "100% 50%" : "50% 50%",
      x: getHiddenOffset(side),
    });
    gsap.set(labelElement, { autoAlpha: 0, x: side === "right" ? -4 : 4 });
    if (shortcutElement) {
      gsap.set(shortcutElement, {
        autoAlpha: 0,
        maxWidth: 0,
        paddingLeft: 0,
        paddingRight: 0,
        x: side === "right" ? -4 : 4,
      });
    }

    const timeline = gsap.timeline();
    timeline.to(bubble, {
      autoAlpha: 1,
      duration: 0.16,
      ease: "power3.out",
      overwrite: true,
      scaleX: 1,
      x: 0,
    });
    timeline.to(labelElement, {
      autoAlpha: 1,
      duration: 0.22,
      ease: "power3.out",
      x: 0,
    }, 0.035);
    if (shortcutElement) {
      timeline.to(shortcutElement, {
        autoAlpha: 1,
        duration: 0.2,
        ease: "power3.out",
        maxWidth: 28,
        paddingLeft: 5,
        paddingRight: 5,
        x: 0,
      }, 0.055);
    }
  }, [disabled, side]);

  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble) {
      return;
    }

    isVisibleRef.current = false;
    gsap.set(bubble, { autoAlpha: 0, scaleX: 0.96, x: getHiddenOffset(side) });
    gsap.set([labelRef.current, shortcutRef.current].filter(Boolean), { autoAlpha: 0 });
  }, [side]);

  useLayoutEffect(() => {
    if (disabled) {
      hideHint();
    }
  }, [disabled, hideHint]);

  return (
    <span
      ref={rootRef}
      className={["action-hint", className].filter(Boolean).join(" ")}
      data-align={align}
      data-disabled={disabled ? "true" : "false"}
      data-dismissed={isDismissed ? "true" : "false"}
      data-side={side}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          hideHint();
          setIsDismissed(false);
        }
      }}
      onFocus={() => {
        if (disabled) {
          return;
        }
        setIsDismissed(false);
        showHint();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsDismissed(true);
          hideHint();
        }
      }}
      onPointerEnter={() => {
        if (disabled) {
          return;
        }
        setIsDismissed(false);
        showHint();
      }}
      onPointerLeave={() => {
        hideHint();
        setIsDismissed(false);
      }}
    >
      {child}
      <span className="action-hint__bubble" id={tooltipId} role="tooltip" ref={bubbleRef}>
        {shortcut ? <kbd ref={shortcutRef}>{shortcut}</kbd> : null}
        <span className="action-hint__label" ref={labelRef}>{label}</span>
      </span>
    </span>
  );
}

function getHiddenOffset(side: ActionHintSide) {
  if (side === "right") {
    return -6;
  }

  if (side === "left") {
    return 6;
  }

  return 0;
}
