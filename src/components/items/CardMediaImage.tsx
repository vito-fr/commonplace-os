import { useCallback, useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes } from "react";

type CardMediaImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "onError" | "src"> & {
  onMediaError: (src: string) => void;
  placeholderColor?: string | null;
  placeholderColors?: string[] | null;
  src: string;
};

type MediaLoadState = "loading" | "loaded";

export function CardMediaImage({
  className,
  onLoad,
  onMediaError,
  placeholderColor,
  placeholderColors,
  src,
  style,
  ...props
}: CardMediaImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const reportedSrcRef = useRef<string | null>(null);
  const revealTokenRef = useRef(0);
  const [loadState, setLoadState] = useState<MediaLoadState>("loading");
  const reportBrokenImage = useCallback(() => {
    if (reportedSrcRef.current === src || typeof window === "undefined") {
      return;
    }

    reportedSrcRef.current = src;
    window.setTimeout(() => onMediaError(src), 0);
  }, [onMediaError, src]);

  const markLoadedImage = useCallback((image: HTMLImageElement, token: number) => {
    if (revealTokenRef.current !== token || image.naturalWidth <= 0) {
      return;
    }

    setLoadState("loaded");
  }, []);

  useEffect(() => {
    reportedSrcRef.current = null;
    revealTokenRef.current += 1;
    setLoadState("loading");
  }, [src]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || typeof window === "undefined") {
      return undefined;
    }

    let frame = 0;
    const token = revealTokenRef.current;

    frame = window.requestAnimationFrame(() => {
      if (image.complete && image.naturalWidth <= 0) {
        reportBrokenImage();
        return;
      }
      if (image.complete) {
        markLoadedImage(image, token);
        return;
      }
    });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [markLoadedImage, reportBrokenImage]);

  const wrapperStyle = {
    ...style,
    "--card-media-placeholder-bg": placeholderColor || getPlaceholderColor(src, placeholderColors),
  } as CSSProperties;

  return (
    <span className={["card-media", className].filter(Boolean).join(" ")} data-load-state={loadState} style={wrapperStyle}>
      <span className="card-media__plate" aria-hidden="true" />
      <img
        {...props}
        className="card-media__image"
        ref={imageRef}
        src={src}
        onError={reportBrokenImage}
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth <= 0) {
            reportBrokenImage();
            return;
          }

          onLoad?.(event);
          markLoadedImage(image, revealTokenRef.current);
        }}
      />
    </span>
  );
}

function getPlaceholderColor(_src: string, colors: string[] | null | undefined) {
  const bestColor = getBestDominantColor(colors);
  if (bestColor) {
    return `color-mix(in srgb, ${bestColor} 54%, var(--color-paper))`;
  }

  return "color-mix(in srgb, var(--color-ink) 8%, var(--color-paper))";
}

function getBestDominantColor(colors: string[] | null | undefined) {
  if (!Array.isArray(colors) || colors.length === 0) {
    return null;
  }

  let bestColor: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const color of colors) {
    const rgb = parseHexColor(color);
    if (!rgb) {
      continue;
    }

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const luminance = relativeLuminance(rgb.r, rgb.g, rgb.b);
    const chroma = (Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)) / 255;
    const contrastPenalty = luminance < 0.12 || luminance > 0.9 ? 0.55 : 0;
    const saturationScore = hsl.s;
    const midtoneScore = 1 - Math.min(1, Math.abs(luminance - 0.48) / 0.48);
    const score = saturationScore * 0.5 + chroma * 0.28 + midtoneScore * 0.22 - contrastPenalty;

    if (score > bestScore) {
      bestColor = color.toLowerCase();
      bestScore = score;
    }
  }

  return bestColor;
}

function parseHexColor(value: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return { h: hue / 6, s: saturation, l: lightness };
}

function relativeLuminance(r: number, g: number, b: number) {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
