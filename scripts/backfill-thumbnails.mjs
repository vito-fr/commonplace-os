import { chromium } from "playwright";

const pbUrl = normalizeBaseUrl(process.env.VITA_PB_URL ?? "http://127.0.0.1:8090");
const workspaceId = process.env.VITA_WORKSPACE_ID ?? "seed:ws001";
const maxEdge = Number(process.env.VITA_THUMBNAIL_MAX_EDGE ?? 720);

const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  await page.goto(pbUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

  const summary = await page.evaluate(
    async ({ workspaceId, maxEdge }) => {
      const cardsResponse = await fetch(`/api/vita/item-cards?workspace_id=${encodeURIComponent(workspaceId)}`, {
        headers: { Accept: "application/json" },
      });

      if (!cardsResponse.ok) {
        throw new Error(`item-cards failed with HTTP ${cardsResponse.status}`);
      }

      const payload = await cardsResponse.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      const result = {
        workspaceId,
        scanned: items.length,
        updated: 0,
        skipped: 0,
        failed: 0,
        failedItems: [],
      };

      for (const item of items) {
        if (item?.type !== "image" || !item.imageUrl) {
          result.skipped += 1;
          continue;
        }

        if (item.thumbnailUrl && item.thumbnailUrl !== item.imageUrl) {
          result.skipped += 1;
          continue;
        }

        try {
          await retry(async () => {
            const thumbnail = await createThumbnailFile(item.imageUrl, item.id, maxEdge);
            const formData = new FormData();
            formData.set("workspace_id", workspaceId);
            formData.set("item_id", item.id);
            formData.set("thumbnail_file", thumbnail.file);

            const thumbnailResponse = await fetch("/api/vita/item-thumbnail", {
              method: "POST",
              headers: { Accept: "application/json" },
              body: formData,
            });

            if (!thumbnailResponse.ok) {
              throw new Error(`item-thumbnail failed with HTTP ${thumbnailResponse.status}`);
            }
          }, 3);
          result.updated += 1;
        } catch (error) {
          result.failed += 1;
          if (result.failedItems.length < 50) {
            result.failedItems.push({
              itemId: item.id,
              reason: error instanceof Error ? error.message : "thumbnail generation failed",
            });
          }
        }
      }

      return result;

      async function createThumbnailFile(fileRef, itemId, maxEdge) {
        const image = await loadImage(`/api/vita/imported-file?key=${encodeURIComponent(fileRef)}`);
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;

        if (!sourceWidth || !sourceHeight) {
          throw new Error("image has no drawable dimensions");
        }

        const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("canvas context unavailable");
        }

        context.drawImage(image, 0, 0, width, height);

        const blob =
          (await canvasToBlob(canvas, "image/webp", 0.78)) ??
          (await canvasToBlob(canvas, "image/jpeg", 0.82));

        if (!blob) {
          throw new Error("canvas export failed");
        }

        const extension = blob.type === "image/webp" ? "webp" : "jpg";
        return {
          file: new File([blob], `${safeName(itemId)}-thumb.${extension}`, {
            type: blob.type || `image/${extension}`,
            lastModified: Date.now(),
          }),
          width,
          height,
        };
      }

      function loadImage(src) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("image failed to load"));
          image.decoding = "async";
          image.src = src;
        });
      }

      function canvasToBlob(canvas, type, quality) {
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), type, quality);
        });
      }

      function safeName(value) {
        return String(value).replace(/[^a-zA-Z0-9._-]/g, "-") || "item";
      }

      async function retry(operation, attempts) {
        let lastError = null;

        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            return await operation();
          } catch (error) {
            lastError = error;
            await delay(120 * (attempt + 1));
          }
        }

        throw lastError || new Error("operation failed");
      }

      function delay(ms) {
        return new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      }
    },
    { workspaceId, maxEdge },
  );

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
