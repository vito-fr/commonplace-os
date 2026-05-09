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

export type ItemCaptureCreateResult = {
  created: boolean;
  item: {
    id: string;
    workspaceId: string;
    type: "note" | "link" | "image";
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

export type ItemCaptureWriter = {
  captureNote(change: ItemCaptureCreate): Promise<ItemCaptureCreateResult>;
  captureUrl(change: ItemUrlCaptureCreate): Promise<ItemUrlCaptureCreateResult>;
  captureImage(change: ItemImageCaptureCreate): Promise<ItemImageCaptureCreateResult>;
  capturePdf(change: ItemPdfCaptureCreate): Promise<ItemPdfCaptureCreateResult>;
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
  change: ItemImageCaptureCreate | ItemPdfCaptureCreate;
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
