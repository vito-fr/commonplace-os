import { useCallback, useEffect, useId, useRef, useState, type SyntheticEvent } from "react";
import { CardMediaImage } from "./CardMediaImage";

export type VideoCardProps = {
  src: string | null;
  posterUrl: string | null;
  title: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  fetchPriority?: "high" | "low" | "auto";
  loading?: "eager" | "lazy";
  onMediaError: (url: string) => void;
  onPosterLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  placeholderColors?: string[] | null;
};

type AutoplayPlayer = {
  id: string;
  stop: () => void;
};

const activeAutoplayPlayers = new Map<string, AutoplayPlayer>();
const autoplayStartRatio = 0.15;

export function VideoCard({
  height = null,
  fetchPriority = "auto",
  loading = "lazy",
  mimeType = null,
  onMediaError,
  onPosterLoad,
  placeholderColors = null,
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
        if (!entry) {
          return;
        }

        if (entry.isIntersecting && entry.intersectionRatio >= autoplayStartRatio) {
          setShouldLoadVideo(true);
          return;
        }

        if (!entry.isIntersecting) {
          stopPlayback();
        }
      },
      { rootMargin: "180px 0px", threshold: [0, autoplayStartRatio, 0.5, 1] },
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
      video.loop = true;
      video.muted = true;
      video.playsInline = true;

      try {
        await video.play();
        markPlaying();
      } catch {
        stopPlayback();
      }
    };
    let lastPlaybackTime = video.currentTime;
    let stagnantTicks = 0;
    const restartPlayback = () => {
      if (cancelled || !mountedRef.current || document.visibilityState === "hidden") {
        return;
      }

      if (video.ended || (Number.isFinite(video.duration) && video.duration - video.currentTime < 0.12)) {
        video.currentTime = 0;
      }

      void beginPlayback();
    };
    const nudgePlayback = () => {
      const currentTime = video.currentTime;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const nextTime = Math.min(currentTime + 0.04, Math.max(0, video.duration - 0.12));
        if (nextTime > currentTime) {
          video.currentTime = nextTime;
        }
      }
      void beginPlayback();
    };
    const handleError = () => {
      onMediaError(src);
      stopPlayback();
    };
    const loopWatch = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      if (video.paused || video.ended || (Number.isFinite(video.duration) && video.duration - video.currentTime < 0.12)) {
        restartPlayback();
        lastPlaybackTime = video.currentTime;
        stagnantTicks = 0;
        return;
      }

      const progressDelta = video.currentTime - lastPlaybackTime;
      if (progressDelta > 0.05 || progressDelta < -0.05) {
        lastPlaybackTime = video.currentTime;
        stagnantTicks = 0;
        return;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        stagnantTicks += 1;
      }

      if (stagnantTicks >= 4) {
        nudgePlayback();
        lastPlaybackTime = video.currentTime;
        stagnantTicks = 0;
      }
    }, 500);

    video.addEventListener("ended", restartPlayback);
    video.addEventListener("playing", markPlaying);
    video.addEventListener("error", handleError);
    void beginPlayback();

    return () => {
      cancelled = true;
      window.clearInterval(loopWatch);
      video.removeEventListener("ended", restartPlayback);
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
          placeholderColors={placeholderColors}
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
