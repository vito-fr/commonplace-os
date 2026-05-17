import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { usePressFeedback } from "../ui/usePressFeedback";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

type PdfCanvasPreviewVariant = "card" | "detail" | "reader";
type PdfLoadState = "idle" | "loading" | "loaded" | "error";

export function PdfCanvasPreview({
  className = "",
  src,
  title,
  variant = "card",
}: {
  className?: string;
  src: string;
  title: string;
  variant?: PdfCanvasPreviewVariant;
}) {
  usePressFeedback();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<PdfLoadState>("idle");
  const [pageCount, setPageCount] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [shouldRenderCanvas, setShouldRenderCanvas] = useState(variant !== "card");
  const [zoom, setZoom] = useState(1);
  const showControls = variant !== "card";

  useEffect(() => {
    if (variant !== "card") {
      setShouldRenderCanvas(true);
      return;
    }

    const element = frameRef.current;
    if (!element || typeof window === "undefined") {
      return;
    }

    setShouldRenderCanvas(false);
    setLoadState("idle");

    let timeoutHandle = 0;
    const renderAfterFirstPaint = () => {
      if (timeoutHandle) {
        return;
      }

      timeoutHandle = window.setTimeout(() => {
        timeoutHandle = 0;
        setShouldRenderCanvas(true);
      }, 220);
    };

    if (!("IntersectionObserver" in window)) {
      renderAfterFirstPaint();
      return () => {
        if (timeoutHandle) {
          window.clearTimeout(timeoutHandle);
        }
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          renderAfterFirstPaint();
          observer.disconnect();
        }
      },
      { rootMargin: "420px 0px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [src, variant]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;
    let loadingTask: pdfjs.PDFDocumentLoadingTask | null = null;
    let documentProxy: pdfjs.PDFDocumentProxy | null = null;

    async function renderPdfPage() {
      const canvas = canvasRef.current;
      if (!canvas || !src || !shouldRenderCanvas) {
        return;
      }

      setLoadState("loading");

      try {
        loadingTask = pdfjs.getDocument({ url: src });
        documentProxy = await loadingTask.promise;
        if (cancelled) {
          return;
        }

        const safePageNumber = Math.min(Math.max(1, pageNumber), documentProxy.numPages);
        if (safePageNumber !== pageNumber) {
          setPageNumber(safePageNumber);
          return;
        }

        setPageCount(documentProxy.numPages);
        const page = await documentProxy.getPage(safePageNumber);
        if (cancelled) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const frameWidth = frameRef.current?.clientWidth || (variant === "card" ? 360 : 900);
        const maxScale = variant === "card" ? 0.72 : 1.6;
        const fitScale = Math.max(0.1, Math.min(maxScale, frameWidth / Math.max(1, baseViewport.width)));
        const viewport = page.getViewport({ scale: fitScale * (variant === "card" ? 1 : zoom) });
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas rendering is unavailable.");
        }

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) {
          setLoadState("loaded");
        }
      } catch (error) {
        if (!cancelled && !isPdfRenderCancellation(error)) {
          console.error(error);
          setLoadState("error");
        }
      }
    }

    void renderPdfPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
      void documentProxy?.destroy();
    };
  }, [pageNumber, shouldRenderCanvas, src, variant, zoom]);

  return (
    <div
      className={["pdf-canvas-preview", `pdf-canvas-preview--${variant}`, className].filter(Boolean).join(" ")}
      data-load-state={loadState}
      ref={frameRef}
    >
      <div className="pdf-canvas-preview__page" aria-label={title}>
        <canvas ref={canvasRef} />
        {loadState === "error" ? (
          <div className="pdf-canvas-preview__fallback" role="alert">
            {variant === "card" ? (
              <>
                <span>PDF</span>
                <small>Preview unavailable.</small>
              </>
            ) : (
              <iframe className="pdf-canvas-preview__iframe" src={src} title={title} />
            )}
          </div>
        ) : null}
        {loadState !== "loaded" && loadState !== "error" ? (
          <div className="pdf-canvas-preview__fallback pdf-canvas-preview__fallback--loading" role="status" aria-label="Loading PDF preview">
            <span aria-hidden="true">PDF</span>
            <small aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {showControls ? (
        <div className="pdf-canvas-preview__controls" aria-label="PDF controls">
          <button type="button" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={pageNumber <= 1} data-press-feedback="true">
            Prev
          </button>
          <span>
            {pageNumber} / {pageCount}
          </span>
          <button type="button" onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))} disabled={pageNumber >= pageCount} data-press-feedback="true">
            Next
          </button>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.75, Math.round((value - 0.15) * 100) / 100))} data-press-feedback="true">
            -
          </button>
          <button type="button" onClick={() => setZoom((value) => Math.min(2, Math.round((value + 0.15) * 100) / 100))} data-press-feedback="true">
            +
          </button>
          <a href={src} target="_blank" rel="noreferrer" data-press-feedback="true">
            Open
          </a>
          <a href={src} download data-press-feedback="true">
            Download
          </a>
        </div>
      ) : null}
    </div>
  );
}

function isPdfRenderCancellation(error: unknown) {
  return error instanceof Error && error.name === "RenderingCancelledException";
}
