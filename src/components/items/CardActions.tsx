import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ActionHint, type ActionHintSide } from "../ui/ActionHint";
import { ArchiveIcon, type ArchiveIconName } from "../ui/ArchiveIcons";
import { gsap } from "../../motion/MotionShell";

export type CardActionSurface = "actions" | "collection";

type CardSurfaceDetail = {
  id: string;
  surface: CardActionSurface;
};

type CardActionMenuOptions = {
  id: string;
  onClose?: () => void;
  surface?: CardActionSurface;
};

export const cardActionSurfaceEvent = "vita:card-surface-open";

export function emitCardActionSurfaceOpen(id: string, surface: CardActionSurface) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<CardSurfaceDetail>(cardActionSurfaceEvent, {
    detail: { id, surface },
  }));
}

export function useCardActionMenu({
  id,
  onClose,
  surface = "actions",
}: CardActionMenuOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const close = useCallback((focusButton = false) => {
    setIsOpen(false);
    onCloseRef.current?.();
    if (focusButton) {
      buttonRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      close();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        close(true);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, isOpen]);

  useEffect(() => {
    const onSurfaceOpen = (event: Event) => {
      const detail = (event as CustomEvent<CardSurfaceDetail>).detail;
      if (!detail || detail.id === id && detail.surface === surface) {
        return;
      }

      close();
    };

    window.addEventListener(cardActionSurfaceEvent, onSurfaceOpen);
    return () => window.removeEventListener(cardActionSurfaceEvent, onSurfaceOpen);
  }, [close, id, surface]);

  const toggle = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      emitCardActionSurfaceOpen(id, surface);
    } else {
      onCloseRef.current?.();
    }
  }, [id, isOpen, surface]);

  return {
    buttonRef,
    close,
    isOpen,
    menuRef,
    toggle,
  };
}

export function CardActionMenu({
  ariaLabel,
  buttonClassName = "",
  buttonRef,
  children,
  controlClassName = "",
  isOpen,
  menuClassName = "",
  menuRef,
  onToggle,
  shortcut,
  tooltipLabel,
  tooltipSide = "left",
}: {
  ariaLabel: string;
  buttonClassName?: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
  controlClassName?: string;
  isOpen: boolean;
  menuClassName?: string;
  menuRef: RefObject<HTMLDivElement | null>;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  shortcut?: string;
  tooltipLabel?: string;
  tooltipSide?: ActionHintSide;
}) {
  const controlClasses = ["item-card__more-control", controlClassName].filter(Boolean).join(" ");
  const buttonClasses = ["item-card__action-cell", "item-card__action-cell--more", buttonClassName].filter(Boolean).join(" ");
  const menuClasses = ["item-card__more-menu", menuClassName].filter(Boolean).join(" ");
  const [isMenuRendered, setIsMenuRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsMenuRendered(true);
      return undefined;
    }

    const timeout = window.setTimeout(() => setIsMenuRendered(false), 170);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !isMenuRendered || typeof window === "undefined") {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.killTweensOf(menu);

    if (prefersReducedMotion) {
      gsap.set(menu, { autoAlpha: isOpen ? 1 : 0, clearProps: "transform" });
      return;
    }

    if (isOpen) {
      gsap.fromTo(
        menu,
        { autoAlpha: 0, force3D: "auto", scale: 0.985, y: -3 },
        {
          autoAlpha: 1,
          clearProps: "opacity,visibility,transform",
          duration: 0.2,
          ease: "power3.out",
          force3D: "auto",
          overwrite: true,
          scale: 1,
          y: 0,
        },
      );
      return;
    }

    gsap.to(menu, {
      autoAlpha: 0,
      duration: 0.15,
      ease: "power2.in",
      force3D: "auto",
      overwrite: true,
      scale: 0.985,
      y: -3,
    });
  }, [isMenuRendered, isOpen, menuRef]);

  return (
    <span className={controlClasses} data-open={isOpen ? "true" : "false"}>
      <ActionHint disabled={isOpen} label={tooltipLabel ?? ariaLabel} shortcut={shortcut} side={tooltipSide}>
        <button
          className={buttonClasses}
          type="button"
          onClick={onToggle}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          data-press-feedback="true"
          ref={buttonRef}
        >
          <CardGlyph name="more" className="item-card__dots-icon" />
        </button>
      </ActionHint>
      {isMenuRendered ? (
        <div className={menuClasses} role="menu" ref={menuRef} data-open={isOpen ? "true" : "false"}>
          {children}
        </div>
      ) : null}
    </span>
  );
}

export type CardGlyphName = "add" | "copy" | "delete" | "download" | "edit" | "more" | "open" | "share";

export function CardGlyph({
  className = "card-glyph",
  name,
}: {
  className?: string;
  name: CardGlyphName;
}) {
  return <ArchiveIcon className={`card-glyph card-glyph--${name} ${className}`} name={getArchiveIconName(name)} />;
}

function getArchiveIconName(name: CardGlyphName): ArchiveIconName {
  if (name === "open") {
    return "external";
  }

  if (name === "edit") {
    return "copy";
  }

  return name;
}
