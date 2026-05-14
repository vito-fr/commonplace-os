import type { SyntheticEvent } from "react";
import { CardMediaImage } from "./CardMediaImage";

export type VideoCardProps = {
  src: string | null;
  posterUrl: string | null;
  title: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  loading?: "eager" | "lazy";
  onMediaError: (url: string) => void;
  onPosterLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
};

export function VideoCard({
  height = null,
  loading = "lazy",
  mimeType = null,
  onMediaError,
  onPosterLoad,
  posterUrl,
  src,
  title,
  width = null,
}: VideoCardProps) {
  const fetchPriority = loading === "eager" ? "high" : "auto";
  const label = title ? `${title} video preview` : "Video preview";

  return (
    <div className="item-card__video-card" data-has-video={src ? "true" : "false"} data-mime={mimeType ?? undefined}>
      {posterUrl ? (
        <CardMediaImage
          className="item-card__image item-card__video-poster"
          src={posterUrl}
          alt={title ?? ""}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          width={width ?? undefined}
          height={height ?? undefined}
          onMediaError={onMediaError}
          onLoad={onPosterLoad}
        />
      ) : (
        <div className="item-card__placeholder item-card__placeholder--video">video preview</div>
      )}
      <span className="item-card__video-badge" aria-label={label}>video</span>
    </div>
  );
}
