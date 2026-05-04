import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../../motion/MotionShell";
import type { ShortcutBinding } from "../nav/PillNav";

export type SpotlightCaptureRequest =
  | { type: "link"; url: string }
  | { type: "note"; body: string }
  | { type: "image"; file: File }
  | { type: "pdf"; file: File };

export type SpotlightCaptureResult = {
  created: boolean;
  label?: string;
} | void;

export type SpotlightDockProps = {
  value: string;
  onChange: (next: string) => void;
  isPocketBaseMode: boolean;
  pendingCapture: boolean;
  captureError: string | null;
  captureNotice: string | null;
  searchShortcut: ShortcutBinding;
  onCapture: (request: SpotlightCaptureRequest) => Promise<SpotlightCaptureResult> | SpotlightCaptureResult;
};

type DockMode = "search" | "import" | null;
type ImportMode = "paste" | "files" | "sources";
type ImportQueueStatus = "ready" | "importing" | "imported" | "duplicate" | "unsupported" | "failed";
type ImportQueueItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: ImportQueueStatus;
  message: string;
};

const IDLE_WIDTH = 48;
const IDLE_HEIGHT = 10;
const DOCK_HEIGHT = 46;
const SEARCH_WIDTH = 456;
const SEARCH_CONTENT_WIDTH = 448;
const MAX_BATCH_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function SpotlightDock({
  captureError,
  captureNotice,
  isPocketBaseMode,
  onCapture,
  onChange,
  pendingCapture,
  searchShortcut,
  value,
}: SpotlightDockProps) {
  const [activeMode, setActiveMode] = useState<DockMode>(null);
  const [importMode, setImportMode] = useState<ImportMode>("paste");
  const [importValue, setImportValue] = useState("");
  const [fileQueue, setFileQueue] = useState<ImportQueueItem[]>([]);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [isQueueImporting, setIsQueueImporting] = useState(false);
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
  const pastePreview = useMemo(() => getPastePreview(importValue), [importValue]);
  const readyFileCount = fileQueue.filter((item) => item.status === "ready").length;
  const isBusy = pendingCapture || isQueueImporting;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (!isTypingTarget && matchesShortcut(event, searchShortcut)) {
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
  }, [searchShortcut]);

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
        width: 0,
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
          width: SEARCH_CONTENT_WIDTH,
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
        width: 0,
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
    if (isImportOpen && importMode === "paste") {
      requestAnimationFrame(() => {
        importInputRef.current?.focus();
      });
    }
  }, [importMode, isImportOpen]);

  const submitImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isPocketBaseMode) {
      setBatchNotice("Live mode required.");
      return;
    }

    if (importMode === "files") {
      await importReadyFiles();
      return;
    }

    if (importMode === "sources") {
      return;
    }

    const input = importValue.trim();
    if (!input) {
      return;
    }

    try {
      const request = pastePreview.kind === "note" ? { type: "note" as const, body: input } : { type: "link" as const, url: input };
      const result = await onCapture(request);
      setImportValue("");
      setBatchNotice(result?.created === false ? "Already in archive." : getPasteSuccessMessage(pastePreview));
    } catch {
      // App owns the persistent capture error message.
    }
  };

  const importReadyFiles = async () => {
    const readyItems = fileQueue.filter((item) => item.status === "ready");

    if (readyItems.length === 0) {
      setBatchNotice("Choose image or PDF files first.");
      return;
    }

    setIsQueueImporting(true);
    setBatchNotice(`Importing ${readyItems.length} ${readyItems.length === 1 ? "file" : "files"}.`);

    for (const item of readyItems) {
      updateQueueItem(item.id, { status: "importing", message: "importing" });

      try {
        const result = await onCapture(
          isPdfFile(item.file)
            ? { type: "pdf", file: item.file }
            : { type: "image", file: item.file },
        );
        updateQueueItem(item.id, {
          status: result?.created === false ? "duplicate" : "imported",
          message: result?.created === false ? "already in archive" : "imported",
        });
      } catch {
        updateQueueItem(item.id, { status: "failed", message: "failed" });
      }
    }

    setIsQueueImporting(false);
    setBatchNotice("File import complete.");
  };

  const queueFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files);

    setImportMode("files");

    if (nextFiles.length === 0) {
      setBatchNotice("Choose image or PDF files first.");
      return;
    }

    if (nextFiles.length > MAX_BATCH_FILES) {
      setBatchNotice(`Choose up to ${MAX_BATCH_FILES} files per batch.`);
      return;
    }

    setFileQueue(nextFiles.map(fileToQueueItem));
    setBatchNotice(`${nextFiles.length} ${nextFiles.length === 1 ? "file" : "files"} staged.`);
  };

  const stageFileImport = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    queueFiles(event.dataTransfer.files);
  };

  const chooseFile = () => {
    fileInputRef.current?.click();
  };

  const updateQueueItem = (id: string, patch: Partial<ImportQueueItem>) => {
    setFileQueue((currentQueue) =>
      currentQueue.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
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
            <div className="spotlight-import-panel__modes" aria-label="import mode">
              <button
                className="spotlight-dock__cell"
                data-active={importMode === "paste" ? "true" : "false"}
                type="button"
                onClick={() => setImportMode("paste")}
              >
                Paste
              </button>
              <button
                className="spotlight-dock__cell"
                data-active={importMode === "files" ? "true" : "false"}
                type="button"
                onClick={() => setImportMode("files")}
              >
                Files
              </button>
              <button
                className="spotlight-dock__cell"
                data-active={importMode === "sources" ? "true" : "false"}
                type="button"
                onClick={() => setImportMode("sources")}
              >
                Sources
              </button>
              <span className="spotlight-import-panel__hint">{getImportHint(importMode)}</span>
            </div>

            <div className="spotlight-import-panel__body" data-mode={importMode}>
              {importMode === "paste" ? (
                <>
                  <textarea
                    ref={importInputRef}
                    aria-label="paste URL or write note"
                    disabled={isBusy || !isPocketBaseMode}
                    name="spotlight-import"
                    onChange={(event) => setImportValue(event.target.value)}
                    placeholder={getPastePlaceholder(isPocketBaseMode)}
                    rows={4}
                    value={importValue}
                  />
                  <div className="spotlight-import-panel__preview" aria-live="polite">
                    <span>{pastePreview.label}</span>
                    <small>{pastePreview.detail}</small>
                  </div>
                </>
              ) : null}

              {importMode === "files" ? (
                <>
                  <div
                    className="spotlight-import-panel__drop"
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
                    Drop or choose images and PDFs
                    <span>{MAX_BATCH_FILES} files · 25MB each</span>
                  </div>
                  <FileQueueList queue={fileQueue} />
                </>
              ) : null}

              {importMode === "sources" ? <SourceImportGuide /> : null}
            </div>

            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/*,application/pdf,video/*,audio/*"
              multiple
              onChange={(event) => {
                if (event.target.files) {
                  queueFiles(event.target.files);
                }
                event.currentTarget.value = "";
              }}
            />

            <div className="spotlight-import-panel__actions">
              <button
                className="spotlight-dock__cell"
                type="submit"
                disabled={
                  isBusy ||
                  !isPocketBaseMode ||
                  importMode === "sources" ||
                  (importMode === "paste" && !importValue.trim()) ||
                  (importMode === "files" && readyFileCount === 0)
                }
              >
                {isBusy ? "Adding" : importMode === "files" ? `Add ${readyFileCount || ""}`.trim() : "Add"}
              </button>
              <button className="spotlight-dock__cell" type="button" onClick={() => setActiveMode(null)}>
                Close
              </button>
              {captureNotice ? <span className="spotlight-import-panel__meta">{captureNotice}</span> : null}
              {captureError ? <span className="spotlight-import-panel__error">{captureError}</span> : null}
              {batchNotice ? <span className="spotlight-import-panel__meta">{batchNotice}</span> : null}
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
            placeholder="Search archive"
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

function FileQueueList({ queue }: { queue: ImportQueueItem[] }) {
  if (queue.length === 0) {
    return (
      <div className="spotlight-import-panel__queue spotlight-import-panel__queue--empty">
        <span>Images and PDFs import now.</span>
        <small>Video and audio stay staged for the next media slice.</small>
      </div>
    );
  }

  return (
    <div className="spotlight-import-panel__queue" aria-label="files to import">
      {queue.map((item) => (
        <div className="spotlight-import-panel__queue-row" data-status={item.status} key={item.id}>
          <span>{item.name}</span>
          <small>
            {formatFileSize(item.size)} · {item.message}
          </small>
        </div>
      ))}
    </div>
  );
}

function SourceImportGuide() {
  return (
    <div className="spotlight-import-panel__sources" aria-label="supported sources">
      <SourceImportRow label="Pinterest" copy="Paste pin, board, or image URLs. They filter as Pinterest." />
      <SourceImportRow label="Are.na" copy="Paste channel or block URLs. They filter as Are.na." />
      <SourceImportRow label="YouTube" copy="Paste video URLs. They import as video links." />
      <SourceImportRow label="APIs" copy="Account API import is deferred until URL capture proves the workflow." />
    </div>
  );
}

function SourceImportRow({ copy, label }: { copy: string; label: string }) {
  return (
    <div className="spotlight-import-panel__source-row">
      <strong>{label}</strong>
      <span>{copy}</span>
    </div>
  );
}

function getPastePlaceholder(isPocketBaseMode: boolean) {
  return isPocketBaseMode ? "paste URL or write a note" : "live mode required";
}

function getImportHint(importMode: ImportMode) {
  if (importMode === "paste") {
    return "URLs become links · text becomes notes";
  }

  if (importMode === "files") {
    return "images and PDFs import now";
  }

  return "platform URLs are classified";
}

function getPastePreview(value: string) {
  const input = value.trim();

  if (!input) {
    return {
      kind: "empty" as const,
      label: "Ready for paste.",
      detail: "Pinterest, Are.na, YouTube, PDFs, regular URLs, or text notes.",
    };
  }

  const url = parseHttpUrl(input);
  if (!url) {
    return {
      kind: "note" as const,
      label: "Text note",
      detail: "This will be added as a manual note.",
    };
  }

  const host = url.hostname.toLowerCase();

  if (isPinterestHost(host)) {
    return {
      kind: "link" as const,
      label: "Pinterest URL",
      detail: "This will filter under Origin: Pinterest.",
    };
  }

  if (isArenaHost(host)) {
    return {
      kind: "link" as const,
      label: "Are.na URL",
      detail: "This will filter under Origin: Are.na.",
    };
  }

  if (isVideoHost(host)) {
    return {
      kind: "link" as const,
      label: "Video URL",
      detail: "This will import as a video link.",
    };
  }

  if (url.pathname.toLowerCase().endsWith(".pdf")) {
    return {
      kind: "link" as const,
      label: "PDF URL",
      detail: "This will import as a PDF link.",
    };
  }

  return {
    kind: "link" as const,
    label: "Web URL",
    detail: `This will import from ${host}.`,
  };
}

function getPasteSuccessMessage(preview: ReturnType<typeof getPastePreview>) {
  if (preview.kind === "note") {
    return "Added note.";
  }

  return `Imported ${preview.label.toLowerCase()}.`;
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function fileToQueueItem(file: File): ImportQueueItem {
  const validation = validateImportFile(file);

  return {
    id: `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 8)}`,
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    status: validation.status,
    message: validation.message,
  };
}

function validateImportFile(file: File): Pick<ImportQueueItem, "status" | "message"> {
  if (file.size > MAX_FILE_BYTES) {
    return { status: "failed", message: "over 25MB limit" };
  }

  if (isImageFile(file)) {
    return { status: "ready", message: "image ready" };
  }

  if (isPdfFile(file)) {
    return { status: "ready", message: "PDF ready" };
  }

  return { status: "unsupported", message: "media import next" };
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isPinterestHost(host: string) {
  return (
    host === "pin.it" ||
    host === "pinterest.com" ||
    host.endsWith(".pinterest.com") ||
    host === "pinimg.com" ||
    host.endsWith(".pinimg.com")
  );
}

function isArenaHost(host: string) {
  return host === "are.na" || host.endsWith(".are.na");
}

function isVideoHost(host: string) {
  return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" || host === "vimeo.com" || host.endsWith(".vimeo.com");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function matchesShortcut(event: KeyboardEvent, binding: ShortcutBinding) {
  const eventKey = normalizeShortcutKey(event.key);
  const expectedKeys = [binding.key, ...(binding.alternateKeys ?? [])].map(normalizeShortcutKey);

  if (!expectedKeys.includes(eventKey)) {
    return false;
  }

  if (binding.modifier === "mod") {
    return (event.metaKey || event.ctrlKey) && !event.altKey;
  }

  return !event.metaKey && !event.ctrlKey && !event.altKey;
}

function normalizeShortcutKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}
