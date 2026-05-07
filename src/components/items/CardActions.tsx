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
    <span className={controlClasses}>
      <button
        className={buttonClasses}
        type="button"
        onClick={onToggle}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        ref={buttonRef}
      >
        <span className="item-card__dots-icon" aria-hidden="true" />
      </button>
      {isMenuRendered ? (
        <div className={menuClasses} role="menu" ref={menuRef} data-open={isOpen ? "true" : "false"}>
          {children}
        </div>
      ) : null}
    </span>
  );
}
