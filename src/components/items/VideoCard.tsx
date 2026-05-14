import { useCallback, useEffect, useId, useRef, useState, type SyntheticEvent } from "react";
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

type AutoplayPlayer = {
  id: string;
  stop: () => void;
};

const activeAutoplayPlayers = new Map<string, AutoplayPlayer>();

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
  const playerId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mountedRef = useRef(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const fetchPriority = loading === "eager" ? "high" : "auto";

  const stopPlayback = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      unloadVideo(video);
    }
    releaseAutoplaySlot(playerId);
    if (mountedRef.current) {
      setIsPlaying(false);
      setShouldLoadVideo(false);
    }
  }, [playerId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseAutoplaySlot(playerId);
      const video = videoRef.current;
      if (video) {
        unloadVideo(video);
      }
    };
  }, [playerId]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || !src || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
          setShouldLoadVideo(true);
          return;
        }
        stopPlayback();
      },
      { threshold: [0, 0.5] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [src, stopPlayback]);

  useEffect(() => {
    if (!src || !shouldLoadVideo) {
      return undefined;
    }

    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    let cancelled = false;
    const markPlaying = () => {
      if (!cancelled && mountedRef.current) {
        setIsPlaying(true);
      }
    };
    const beginPlayback = async () => {
      if (cancelled) {
        return;
      }

      claimAutoplaySlot({ id: playerId, stop: stopPlayback });
      video.muted = true;
      video.playsInline = true;

      try {
        await video.play();
        markPlaying();
      } catch {
        stopPlayback();
      }
    };
    const handleError = () => {
      onMediaError(src);
      stopPlayback();
    };

    video.addEventListener("playing", markPlaying);
    video.addEventListener("error", handleError);
    void beginPlayback();

    return () => {
      cancelled = true;
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("error", handleError);
      releaseAutoplaySlot(playerId);
    };
  }, [onMediaError, playerId, shouldLoadVideo, src, stopPlayback]);

  return (
    <div
      className="item-card__video-card"
      data-autoplay={src ? "enabled" : "disabled"}
      data-has-video={src ? "true" : "false"}
      data-mime={mimeType ?? undefined}
      data-playing={isPlaying ? "true" : "false"}
      ref={rootRef}
    >
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
      {src && shouldLoadVideo ? (
        <video
          ref={videoRef}
          className="item-card__video-player"
          src={src}
          poster={posterUrl ?? undefined}
          autoPlay
          muted
          playsInline
          loop
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
        />
      ) : null}
    </div>
  );
}

function claimAutoplaySlot(player: AutoplayPlayer) {
  activeAutoplayPlayers.delete(player.id);
  activeAutoplayPlayers.set(player.id, player);

  const limit = getAutoplayLimit();
  for (const [id, activePlayer] of activeAutoplayPlayers) {
    if (activeAutoplayPlayers.size <= limit) {
      break;
    }

    if (id === player.id) {
      continue;
    }

    activeAutoplayPlayers.delete(id);
    activePlayer.stop();
  }
}

function releaseAutoplaySlot(id: string) {
  activeAutoplayPlayers.delete(id);
}

function getAutoplayLimit() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return 2;
  }

  return window.matchMedia("(max-width: 700px), (pointer: coarse)").matches ? 1 : 2;
}

function unloadVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}
