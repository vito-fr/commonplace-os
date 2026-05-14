import type { ItemStatus } from "../components/atoms";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ItemCaptureCreate = {
  workspaceId: string;
  type: "note";
  body: string;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemUrlCaptureCreate = {
  workspaceId: string;
  type: "link";
  url: string;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemImageCaptureCreate = {
  workspaceId: string;
  type: "image";
  file: File;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemPdfCaptureCreate = {
  workspaceId: string;
  type: "pdf";
  file: File;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemVideoCaptureCreate = {
  workspaceId: string;
  type: "video";
  file: File;
  sourceExternalId?: string;
  actor?: string;
};

export type ItemCaptureCreateResult = {
  created: boolean;
  item: {
    id: string;
    workspaceId: string;
    type: "note" | "link" | "image" | "video";
    status: ItemStatus;
    sourceId: string;
    sourceExternalId: string;
    createdAt: string;
    updatedAt: string;
  };
  event: {
    id: string;
    eventType: "imported";
    createdAt: string;
  } | null;
};

export type ItemUrlCaptureCreateResult = {
  created: boolean;
  item: {
    id: string;
    workspaceId: string;
    type: "link";
    status: ItemStatus;
    sourceId: string;
    sourceExternalId: string;
    createdAt: string;
    updatedAt: string;
  };
  event: {
    id: string;
    eventType: "imported";
    createdAt: string;
  } | null;
};

export type ItemImageCaptureCreateResult = ItemCaptureCreateResult;
export type ItemPdfCaptureCreateResult = ItemCaptureCreateResult;
export type ItemVideoCaptureCreateResult = ItemCaptureCreateResult;

export type ItemCaptureWriter = {
  captureNote(change: ItemCaptureCreate): Promise<ItemCaptureCreateResult>;
  captureUrl(change: ItemUrlCaptureCreate): Promise<ItemUrlCaptureCreateResult>;
  captureImage(change: ItemImageCaptureCreate): Promise<ItemImageCaptureCreateResult>;
  capturePdf(change: ItemPdfCaptureCreate): Promise<ItemPdfCaptureCreateResult>;
  captureVideo(change: ItemVideoCaptureCreate): Promise<ItemVideoCaptureCreateResult>;
};

export type PocketBaseItemCaptureWriterOptions = {
  baseUrl: string;
  endpointPath?: string;
  fetcher?: Fetcher;
};

export function createPocketBaseItemCaptureWriter({
  baseUrl,
  endpointPath = "/api/vita/item-capture",
  fetcher = globalThis.fetch,
}: PocketBaseItemCaptureWriterOptions): ItemCaptureWriter {
  return {
    async captureNote(change) {
      const response = await fetcher(buildCaptureUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          type: change.type,
          body: change.body,
          source_external_id: change.sourceExternalId,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase capture write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemCaptureCreateResult;
      if (!payload.item || typeof payload.created !== "boolean") {
        throw new Error("PocketBase capture response must include { created, item }");
      }

      return payload;
    },
    async captureUrl(change) {
      const response = await fetcher(buildCaptureUrl(baseUrl, endpointPath), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: change.workspaceId,
          type: change.type,
          url: change.url,
          source_external_id: change.sourceExternalId,
          actor: change.actor,
        }),
      });

      if (!response.ok) {
        throw new Error(`PocketBase URL capture write failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as ItemUrlCaptureCreateResult;
      if (!payload.item || typeof payload.created !== "boolean") {
        throw new Error("PocketBase URL capture response must include { created, item }");
      }

      return payload;
    },
    async captureImage(change) {
      return captureFile({
        baseUrl,
        endpointPath,
        fetcher,
        change,
        failureLabel: "image",
      });
    },
    async capturePdf(change) {
      return captureFile({
        baseUrl,
        endpointPath,
        fetcher,
        change,
        failureLabel: "PDF",
      });
    },
    async captureVideo(change) {
      return captureFile({
        baseUrl,
        endpointPath,
        fetcher,
        change,
        failureLabel: "video",
      });
    },
  };
}

async function captureFile({
  baseUrl,
  change,
  endpointPath,
  failureLabel,
  fetcher,
}: {
  baseUrl: string;
  change: ItemImageCaptureCreate | ItemPdfCaptureCreate | ItemVideoCaptureCreate;
  endpointPath: string;
  failureLabel: string;
  fetcher: Fetcher;
}) {
  const formData = new FormData();
  formData.set("workspace_id", change.workspaceId);
  formData.set("type", change.type);
  formData.set("file", change.file);

  if (change.type === "image") {
    const thumbnail = await createImageThumbnail(change.file);
    if (thumbnail) {
      formData.set("thumbnail_file", thumbnail.file);
      formData.set("thumbnail_width", String(thumbnail.width));
      formData.set("thumbnail_height", String(thumbnail.height));
    }
  }

  if (change.type === "video") {
    const metadata = await createVideoUploadMetadata(change.file);
    formData.set("poster_file", metadata.posterFile);
    formData.set("width", String(metadata.width));
    formData.set("height", String(metadata.height));
    formData.set("duration_ms", String(metadata.durationMs));
    formData.set("aspect_ratio", String(metadata.aspectRatio));
    if (metadata.dominantColors.length > 0) {
      formData.set("dominant_colors", JSON.stringify(metadata.dominantColors));
    }
  }

  if (change.sourceExternalId) {
    formData.set("source_external_id", change.sourceExternalId);
  }

  if (change.actor) {
    formData.set("actor", change.actor);
  }

  const response = await fetcher(buildCaptureUrl(baseUrl, endpointPath), {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`PocketBase ${failureLabel} capture write failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ItemCaptureCreateResult;
  if (!payload.item || typeof payload.created !== "boolean") {
    throw new Error(`PocketBase ${failureLabel} capture response must include { created, item }`);
  }

  return payload;
}

function buildCaptureUrl(baseUrl: string, endpointPath: string) {
  return new URL(endpointPath, normalizeBaseUrl(baseUrl));
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

type ImageThumbnail = {
  file: File;
  width: number;
  height: number;
};

type VideoUploadMetadata = {
  posterFile: File;
  width: number;
  height: number;
  durationMs: number;
  aspectRatio: number;
  dominantColors: string[];
};

async function createImageThumbnail(file: File): Promise<ImageThumbnail | null> {
  if (!file.type.toLowerCase().startsWith("image/")) {
    return null;
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImage(objectUrl);
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;

      if (!sourceWidth || !sourceHeight) {
        return null;
      }

      const maxEdge = 720;
      const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        return null;
      }

      context.drawImage(image, 0, 0, width, height);

      const blob =
        (await canvasToBlob(canvas, "image/webp", 0.78)) ??
        (await canvasToBlob(canvas, "image/jpeg", 0.82));

      if (!blob) {
        return null;
      }

      const extension = blob.type === "image/webp" ? "webp" : "jpg";
      const name = thumbnailFileName(file.name, extension);
      return {
        file: new File([blob], name, { type: blob.type || `image/${extension}`, lastModified: Date.now() }),
        width,
        height,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

async function createVideoUploadMetadata(file: File): Promise<VideoUploadMetadata> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const metadataLoaded = waitForVideoEvent(video, "loadedmetadata");
    video.src = objectUrl;

    await metadataLoaded;

    const width = video.videoWidth;
    const height = video.videoHeight;
    const duration = video.duration;
    if (!width || !height || !Number.isFinite(duration) || duration <= 0) {
      throw new Error("video metadata is incomplete");
    }

    const seekTime = Math.min(0.5, Math.max(0, duration / 2));
    if (seekTime > 0 && Number.isFinite(seekTime)) {
      await seekVideo(video, seekTime);
    } else {
      await waitForVideoEvent(video, "loadeddata").catch(() => undefined);
    }

    const maxEdge = 960;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const posterWidth = Math.max(1, Math.round(width * scale));
    const posterHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = posterWidth;
    canvas.height = posterHeight;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("video poster canvas is unavailable");
    }

    context.drawImage(video, 0, 0, posterWidth, posterHeight);
    const blob =
      (await canvasToBlob(canvas, "image/webp", 0.82)) ??
      (await canvasToBlob(canvas, "image/jpeg", 0.86));
    if (!blob) {
      throw new Error("video poster could not be encoded");
    }

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return {
      posterFile: new File([blob], posterFileName(file.name, extension), {
        type: blob.type || `image/${extension}`,
        lastModified: Date.now(),
      }),
      width,
      height,
      durationMs: Math.max(1, Math.round(duration * 1000)),
      aspectRatio: width / height,
      dominantColors: sampleDominantColors(context, posterWidth, posterHeight),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image thumbnail source failed to load"));
    image.decoding = "async";
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function thumbnailFileName(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9._-]/g, "-") || "thumbnail";
  return `${baseName}-thumb.${extension}`;
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "loadeddata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener("error", handleError);
    };
    const handleEvent = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`video ${eventName} failed`));
    };
    video.addEventListener(eventName, handleEvent, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

function seekVideo(video: HTMLVideoElement, currentTime: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("video seek failed"));
    };
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = currentTime;
  });
}

function sampleDominantColors(context: CanvasRenderingContext2D, width: number, height: number) {
  const sampleSize = 24;
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const sampleContext = canvas.getContext("2d", { alpha: false });
  if (!sampleContext) {
    return [];
  }

  sampleContext.drawImage(context.canvas, 0, 0, width, height, 0, 0, sampleSize, sampleSize);
  const data = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
  const buckets = new Map<string, number>();
  for (let index = 0; index < data.length; index += 16) {
    const red = Math.round(data[index] / 32) * 32;
    const green = Math.round(data[index + 1] / 32) * 32;
    const blue = Math.round(data[index + 2] / 32) * 32;
    const key = hexColor(red, green, blue);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([color]) => color);
}

function hexColor(red: number, green: number, blue: number) {
  return `#${clampColor(red).toString(16).padStart(2, "0")}${clampColor(green)
    .toString(16)
    .padStart(2, "0")}${clampColor(blue).toString(16).padStart(2, "0")}`;
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, value));
}

function posterFileName(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9._-]/g, "-") || "poster";
  return `${baseName}-poster.${extension}`;
}
