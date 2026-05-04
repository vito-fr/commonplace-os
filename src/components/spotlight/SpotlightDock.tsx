import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../../motion/MotionShell";

export type SpotlightCaptureRequest =
  | { type: "link"; url: string }
  | { type: "note"; body: string }
  | { type: "image"; file: File };

export type SpotlightDockProps = {
  value: string;
  onChange: (next: string) => void;
  isPocketBaseMode: boolean;
  pendingCapture: boolean;
  captureError: string | null;
  captureNotice: string | null;
  onCapture: (request: SpotlightCaptureRequest) => Promise<void> | void;
};

type DockMode = "search" | "import" | null;
type ImportMode = "url" | "note" | "file";

const IDLE_WIDTH = 48;
const IDLE_HEIGHT = 10;
const DOCK_HEIGHT = 36;
const SEARCH_WIDTH = 390;
const SEARCH_CONTENT_WIDTH = 378;

export function SpotlightDock({
  captureError,
  captureNotice,
  isPocketBaseMode,
  onCapture,
  onChange,
  pendingCapture,
  value,
}: SpotlightDockProps) {
  const [activeMode, setActiveMode] = useState<DockMode>(null);
  const [importMode, setImportMode] = useState<ImportMode>("url");
  const [importValue, setImportValue] = useState("");
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusSearchRef = useRef(false);
  const isSearchOpen = activeMode === "search";
  const isImportOpen = activeMode === "import";
  const isDockOpen = activeMode !== null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        shouldFocusSearchRef.current = true;
        setActiveMode("search");
        return;
      }

      if (event.key === "Escape") {
        inputRef.current?.blur();
        importInputRef.current?.blur();
        setActiveMode(null);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!activeMode) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dockRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setActiveMode(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [activeMode]);

  useEffect(() => {
    const dock = dockRef.current;
    const inputWrap = inputWrapRef.current;
    if (!dock || !inputWrap) {
      return;
    }

    gsap.killTweensOf([dock, inputWrap]);

    if (isDockOpen) {
      const timeline = gsap.timeline();

      gsap.set(inputWrap, {
        filter: "blur(5px)",
        maxWidth: 0,
        opacity: 0,
      });

      timeline.to(dock, {
        width: SEARCH_WIDTH,
        height: DOCK_HEIGHT,
        duration: 0.5,
        ease: "power3.inOut",
      });

      timeline.to(
        inputWrap,
        {
          maxWidth: SEARCH_CONTENT_WIDTH,
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.28,
          ease: "power2.out",
        },
        0.24,
      );
    } else {
      const timeline = gsap.timeline();

      timeline.to(inputWrap, {
        maxWidth: 0,
        opacity: 0,
        filter: "blur(4px)",
        duration: 0.16,
        ease: "power2.in",
      });

      timeline.to(
        dock,
        {
          width: IDLE_WIDTH,
          height: IDLE_HEIGHT,
          duration: 0.34,
          ease: "power3.inOut",
        },
        0.06,
      );
    }

  }, [isDockOpen]);

  useEffect(() => {
    if (!isSearchOpen || !shouldFocusSearchRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      shouldFocusSearchRef.current = false;
    });
  }, [isSearchOpen]);

  useEffect(() => {
    if (isImportOpen) {
      requestAnimationFrame(() => {
        importInputRef.current?.focus();
      });
    }
  }, [isImportOpen]);

  const submitImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = importValue.trim();

    if (!isPocketBaseMode) {
      return;
    }

    if (importMode === "file") {
      setFileNotice("Drop or choose an image to import.");
      return;
    }

    if (!input) {
      return;
    }

    try {
      await onCapture(
        importMode === "url"
          ? { type: "link", url: input }
          : { type: "note", body: input },
      );
      setImportValue("");
      setFileNotice(null);
    } catch {
      // App owns the persistent capture error message.
    }
  };

  const captureFile = async (file: File | null) => {
    if (!file) {
      setFileNotice("File import is next. URL and note import are live.");
      return;
    }

    setImportMode("file");

    if (!file.type.startsWith("image/")) {
      setFileNotice(`${file.name} staged. PDF and media import are next.`);
      return;
    }

    if (!isPocketBaseMode) {
      setFileNotice("Live mode required.");
      return;
    }

    try {
      setFileNotice(`Importing ${file.name}.`);
      await onCapture({ type: "image", file });
      setFileNotice(null);
    } catch {
      // App owns the persistent capture error message.
    }
  };

  const stageFileImport = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void captureFile(event.dataTransfer.files.item(0));
  };

  const chooseFile = () => {
    fileInputRef.current?.click();
  };

  const openSearch = () => {
    if (!isImportOpen) {
      shouldFocusSearchRef.current = false;
      setActiveMode("search");
    }
  };

  const closeSearch = () => {
    if (document.activeElement === inputRef.current || isImportOpen || value.trim()) {
      return;
    }

    setActiveMode(null);
  };

  const focusSearch = () => {
    if (isImportOpen) {
      return;
    }

    shouldFocusSearchRef.current = true;
    setActiveMode("search");
  };

  const portal = (
    <>
      {isImportOpen ? (
        <div className="spotlight-import-panel" ref={panelRef} role="dialog" aria-label="import to archive">
          <form className="spotlight-import-panel__form" onSubmit={submitImport}>
            <div className="spotlight-import-panel__modes" aria-label="import type">
              <button
                className="spotlight-dock__cell"
                data-active={importMode === "url" ? "true" : "false"}
                type="button"
                onClick={() => setImportMode("url")}
              >
                URL
              </button>
              <button
                className="spotlight-dock__cell"
                data-active={importMode === "note" ? "true" : "false"}
                type="button"
                onClick={() => setImportMode("note")}
              >
                Note
              </button>
              <button
                className="spotlight-dock__cell"
                data-active={importMode === "file" ? "true" : "false"}
                type="button"
                onClick={() => {
                  setImportMode("file");
                  chooseFile();
                }}
              >
                File
              </button>
              <span className="spotlight-import-panel__hint">{getImportHint(importMode)}</span>
            </div>
            {importMode === "url" || importMode === "note" ? (
              <textarea
                ref={importInputRef}
                aria-label={importMode === "url" ? "URL to import" : "Text note to import"}
                disabled={pendingCapture || !isPocketBaseMode}
                name="spotlight-import"
                onChange={(event) => setImportValue(event.target.value)}
                placeholder={getImportPlaceholder(importMode, isPocketBaseMode)}
                rows={importMode === "url" ? 2 : 4}
                value={importValue}
              />
            ) : null}
            <div
              className={`spotlight-import-panel__drop${importMode === "file" ? " spotlight-import-panel__drop--active" : ""}`}
              onClick={chooseFile}
              onDragOver={(event) => event.preventDefault()}
              onDrop={stageFileImport}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  chooseFile();
                }
              }}
            >
              Drop or choose image, media, or PDF
              <span>images import now</span>
            </div>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/*,application/pdf,video/*,audio/*"
              onChange={(event) => {
                void captureFile(event.target.files?.item(0) ?? null);
                event.currentTarget.value = "";
              }}
            />
            <div className="spotlight-import-panel__actions">
              <button
                className="spotlight-dock__cell"
                type="submit"
                disabled={pendingCapture || !isPocketBaseMode || importMode === "file"}
              >
                {pendingCapture ? "Adding" : "Add"}
              </button>
              <button className="spotlight-dock__cell" type="button" onClick={() => setActiveMode(null)}>
                Close
              </button>
              {captureNotice ? <span className="spotlight-import-panel__meta">{captureNotice}</span> : null}
              {captureError ? <span className="spotlight-import-panel__error">{captureError}</span> : null}
              {fileNotice ? <span className="spotlight-import-panel__meta">{fileNotice}</span> : null}
            </div>
          </form>
        </div>
      ) : null}

      <div
        className={`spotlight-dock${isSearchOpen ? " spotlight-dock--search" : ""}${isImportOpen ? " spotlight-dock--import" : ""}`}
        ref={dockRef}
        style={{ width: IDLE_WIDTH, height: IDLE_HEIGHT }}
        onMouseEnter={openSearch}
        onMouseLeave={closeSearch}
        onMouseDown={focusSearch}
        role="search"
        aria-label="archive search and import"
      >
        <div className="spotlight-dock__input-wrap" ref={inputWrapRef} style={{ opacity: 0 }}>
          <input
            ref={inputRef}
            className="spotlight-dock__input"
            type="search"
            placeholder="search archive"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label="search archive"
          />
          <button
            className="spotlight-dock__import-button"
            data-active={isImportOpen ? "true" : "false"}
            type="button"
            onClick={() => setActiveMode(isImportOpen ? "search" : "import")}
          >
            Import
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(portal, document.body);
}

function getImportPlaceholder(importMode: ImportMode, isPocketBaseMode: boolean) {
  if (!isPocketBaseMode) {
    return "live mode required";
  }

  if (importMode === "url") {
    return "paste URL, Pinterest, Are.na, YouTube, or PDF link";
  }

  return "write text note";
}

function getImportHint(importMode: ImportMode) {
  if (importMode === "url") {
    return "link import";
  }

  if (importMode === "note") {
    return "manual note";
  }

  return "image upload";
}
