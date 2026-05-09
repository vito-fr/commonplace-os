import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

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

    setIsOpen((currentOpen) => {
      const nextOpen = !currentOpen;
      if (nextOpen) {
        emitCardActionSurfaceOpen(id, surface);
      } else {
        onCloseRef.current?.();
      }
      return nextOpen;
    });
  }, [id, surface]);

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

  return (
    <span className={controlClasses} data-open={isOpen ? "true" : "false"}>
      <button
        className={buttonClasses}
        type="button"
        onClick={onToggle}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        ref={buttonRef}
      >
        <CardGlyph name="more" className="item-card__dots-icon" />
      </button>
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
  return (
    <svg
      aria-hidden="true"
      className={`card-glyph card-glyph--${name} ${className}`}
      focusable="false"
      vectorEffect="non-scaling-stroke"
      viewBox="0 0 18 18"
    >
      {renderGlyphPath(name)}
    </svg>
  );
}

function renderGlyphPath(name: CardGlyphName) {
  if (name === "add") {
    return <path d="M9 4.25v9.5M4.25 9h9.5" />;
  }

  if (name === "more") {
    return (
      <>
        <circle cx="5" cy="9" r="1.25" />
        <circle cx="9" cy="9" r="1.25" />
        <circle cx="13" cy="9" r="1.25" />
      </>
    );
  }

  if (name === "download") {
    return <path d="M9 3.75v7.4m0 0 3-3m-3 3-3-3M4.5 13.75h9" />;
  }

  if (name === "share") {
    return (
      <>
        <path d="m7.35 6.35 3.3-1.9M7.35 11.65l3.3 1.9" />
        <circle cx="5.75" cy="7.25" r="1.55" />
        <circle cx="12.25" cy="3.55" r="1.55" />
        <circle cx="12.25" cy="14.45" r="1.55" />
      </>
    );
  }

  if (name === "delete") {
    return <path d="M5.25 6.25h7.5M7 6.25V4.5h4v1.75M6.25 7.5l.45 6h4.6l.45-6" />;
  }

  if (name === "copy") {
    return <path d="M6.2 6.2V4.6h7.2v7.2h-1.6M4.6 6.2h7.2v7.2H4.6Z" />;
  }

  if (name === "open") {
    return <path d="M6 12 12 6M8 5.25h4.75V10" />;
  }

  if (name === "edit") {
    return <path d="m5 12.75 2.4-.45 5.2-5.2-1.95-1.95-5.2 5.2L5 12.75Z" />;
  }

  return <path d="M5 9h8M9 5v8" />;
}
