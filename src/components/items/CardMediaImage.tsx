import { useCallback, useEffect, useRef, type ImgHTMLAttributes } from "react";

type CardMediaImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "onError" | "src"> & {
  onMediaError: (src: string) => void;
  src: string;
};

export function CardMediaImage({
  onLoad,
  onMediaError,
  src,
  ...props
}: CardMediaImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const reportedSrcRef = useRef<string | null>(null);
  const reportBrokenImage = useCallback(() => {
    if (reportedSrcRef.current === src || typeof window === "undefined") {
      return;
    }

    reportedSrcRef.current = src;
    window.setTimeout(() => onMediaError(src), 0);
  }, [onMediaError, src]);

  useEffect(() => {
    reportedSrcRef.current = null;
  }, [src]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || typeof window === "undefined") {
      return undefined;
    }

    let timeout = 0;
    let frame = 0;
    const inspectImage = () => {
      if (image.complete) {
        if (image.naturalWidth <= 0) {
          reportBrokenImage();
        }
        return;
      }

      timeout = window.setTimeout(() => {
        frame = window.requestAnimationFrame(inspectImage);
      }, 300);
    };

    frame = window.requestAnimationFrame(() => {
      if (image.complete && image.naturalWidth <= 0) {
        reportBrokenImage();
        return;
      }
      inspectImage();
    });

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [reportBrokenImage]);

  return (
    <img
      {...props}
      ref={imageRef}
      src={src}
      onError={reportBrokenImage}
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth <= 0) {
          reportBrokenImage();
        }
        onLoad?.(event);
      }}
    />
  );
}
