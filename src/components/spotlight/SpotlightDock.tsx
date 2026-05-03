import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../../motion/MotionShell";

export type SpotlightDockProps = {
  value: string;
  onChange: (next: string) => void;
};

const COLLAPSED_WIDTH = 80;
const COLLAPSED_HEIGHT = 8;
const EXPANDED_WIDTH = 480;
const EXPANDED_HEIGHT = 48;

export function SpotlightDock({ value, onChange }: SpotlightDockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === "k" || event.key === "K" || event.code === "Space")
      ) {
        event.preventDefault();
        setIsOpen(true);
        return;
      }

      if (event.key === "Escape") {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        }
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const dock = dockRef.current;
    const inputWrap = inputWrapRef.current;
    if (!dock || !inputWrap) {
      return;
    }

    if (isOpen) {
      gsap.to(dock, {
        width: EXPANDED_WIDTH,
        height: EXPANDED_HEIGHT,
        duration: 0.32,
        ease: "power3.out",
      });
      gsap.to(inputWrap, {
        opacity: 1,
        duration: 0.24,
        delay: 0.08,
        ease: "power2.out",
      });
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      gsap.to(inputWrap, {
        opacity: 0,
        duration: 0.16,
        ease: "power2.in",
      });
      gsap.to(dock, {
        width: COLLAPSED_WIDTH,
        height: COLLAPSED_HEIGHT,
        duration: 0.24,
        delay: 0.08,
        ease: "power3.in",
      });
    }
  }, [isOpen]);

  const handleMouseEnter = () => setIsOpen(true);
  const handleMouseLeave = () => {
    if (document.activeElement === inputRef.current) {
      return;
    }
    if (!value.trim()) {
      setIsOpen(false);
    }
  };

  return createPortal(
    <div
      className={`spotlight-dock${isOpen ? " spotlight-dock--open" : ""}`}
      ref={dockRef}
      style={{ width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="search"
      aria-label="search archive"
    >
      <div className="spotlight-dock__input-wrap" ref={inputWrapRef} style={{ opacity: 0 }}>
        <input
          ref={inputRef}
          className="spotlight-dock__input"
          type="search"
          placeholder="search archive"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            if (!value.trim()) {
              setIsOpen(false);
            }
          }}
          aria-label="search archive"
        />
        <span className="spotlight-dock__hint" aria-hidden="true">⌘K</span>
      </div>
    </div>,
    document.body,
  );
}
