/// <reference path="../pb_data/types.d.ts" />


routerAdd("GET", "/api/vita/imported-file", (e) => {
  const immutableFileCacheControl = "public, max-age=31536000, immutable";

  function isSafeImportedFileKey(fileKey) {
    return (
      typeof fileKey === "string" &&
      fileKey.startsWith("imports/") &&
      !fileKey.includes("..") &&
      !fileKey.includes("\\") &&
      fileKey.length <= 500
    );
  }

  function fileNameFromKey(fileKey) {
    const parts = fileKey.split("/");
    return parts[parts.length - 1] || "imported-file";
  }

  const fileKey = e.request.url.query().get("key");

  if (!isSafeImportedFileKey(fileKey)) {
    throw new BadRequestError("file key is invalid");
  }

  e.response.header().set("Cache-Control", immutableFileCacheControl);
  e.response.header().set("Accept-Ranges", "bytes");
  e.fileFS($os.dirFS($filepath.join(e.app.dataDir(), "storage")), fileKey);
});

routerAdd("POST", "/api/vita/backfill-image-dimensions", (e) => {
  const query = e.request.url.query();
  const workspaceId = requiredString(query.get("workspace_id"), "workspace_id");
  const force = isTruthy(query.get("force"));
  const dryRun = isTruthy(query.get("dry_run"));
  const maxReportedItems = 50;
  const localGuard = localBackfillRequest(e.request);

  if (!localGuard.ok) {
    return e.json(403, { error: "image dimension backfill is only available from localhost" });
  }

  const rows = arrayOf(
    new DynamicModel({
      itemId: "",
      fileRef: "",
      mimeType: nullString(),
      width: nullString(),
      height: nullString(),
    }),
  );

  e.app
    .db()
    .newQuery(
      `
        SELECT
          i.id AS itemId,
          img.file_ref AS fileRef,
          img.mime_type AS mimeType,
          CASE WHEN img.width IS NULL THEN NULL ELSE CAST(img.width AS TEXT) END AS width,
          CASE WHEN img.height IS NULL THEN NULL ELSE CAST(img.height AS TEXT) END AS height
        FROM items_image img
        INNER JOIN items i
          ON i.id = img.item_id
        WHERE i.workspace_id = {:workspaceId}
          AND img.file_ref IS NOT NULL
          AND img.file_ref != ''
        ORDER BY i.updated_at DESC, i.id ASC
      `,
    )
    .bind({ workspaceId })
    .all(rows);

  const summary = {
    workspaceId,
    force,
    dryRun,
    scanned: rows.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    skippedItems: [],
    failedItems: [],
  };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const itemId = row.itemId;
    const fileRef = row.fileRef;
    const currentWidth = nullableNumber(row.width);
    const currentHeight = nullableNumber(row.height);

    if (!force && currentWidth !== null && currentHeight !== null) {
      recordSkipped(summary, maxReportedItems, itemId, "dimensions already present");
      continue;
    }

    try {
      const dimensions = imageDimensionsForStoredFile(e.app, fileRef);

      if (!dimensions) {
        recordSkipped(summary, maxReportedItems, itemId, "unsupported or unreadable dimensions");
        continue;
      }

      if (!dryRun) {
        const widthExpression = force ? "width = {:width}" : "width = COALESCE(width, {:width})";
        const heightExpression = force ? "height = {:height}" : "height = COALESCE(height, {:height})";
        e.app
          .db()
          .newQuery(
            `
              UPDATE items_image
              SET
                ${widthExpression},
                ${heightExpression}
              WHERE item_id = {:itemId}
            `,
          )
          .bind({ itemId, width: dimensions.width, height: dimensions.height })
          .execute();
      }

      summary.updated += 1;
    } catch (error) {
      recordFailed(summary, maxReportedItems, itemId, error && error.message ? error.message : "file read failed");
      console.warn(`image dimension backfill failed for ${itemId}`, error);
    }
  }

  return e.json(200, summary);

  function requiredString(value, fieldName) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new BadRequestError(`${fieldName} is required`);
    }

    return value.trim();
  }

  function isTruthy(value) {
    return value === "1" || value === "true" || value === "yes";
  }

  function localBackfillRequest(request) {
    const remoteAddr = request && typeof request.remoteAddr === "string" ? request.remoteAddr : "";

    if (remoteAddr === "") {
      return { ok: true };
    }

    const host = remoteAddr.startsWith("[") ? remoteAddr.slice(1, remoteAddr.indexOf("]")) : remoteAddr.split(":")[0];
    return { ok: host === "127.0.0.1" || host === "::1" || host === "localhost" };
  }

  function nullableString(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valid")) {
      return value.valid ? value.string : null;
    }

    return value;
  }

  function nullableNumber(value) {
    const text = nullableString(value);
    if (text === null || text === "") {
      return null;
    }

    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function imageDimensionsForStoredFile(app, fileKey) {
    const filesystem = app.newFilesystem();
    let reader = null;

    try {
      reader = filesystem.getReader(fileKey);
      const bytes = normalizeBytes(toBytes(reader, 1024 * 1024));
      return dimensionsFromPng(bytes) || dimensionsFromJpeg(bytes) || dimensionsFromWebp(bytes) || dimensionsFromGif(bytes);
    } finally {
      if (reader) {
        reader.close();
      }

      filesystem.close();
    }
  }

  function normalizeBytes(value) {
    if (!value) {
      return [];
    }

    if (typeof value === "string") {
      const bytes = [];
      for (let index = 0; index < value.length; index += 1) {
        bytes.push(value.charCodeAt(index) & 255);
      }
      return bytes;
    }

    if (typeof value.length === "number") {
      const bytes = [];
      for (let index = 0; index < value.length; index += 1) {
        bytes.push(Number(value[index]) & 255);
      }
      return bytes;
    }

    return [];
  }

  function dimensionsFromPng(bytes) {
    if (
      bytes.length < 24 ||
      byteAt(bytes, 0) !== 0x89 ||
      byteAt(bytes, 1) !== 0x50 ||
      byteAt(bytes, 2) !== 0x4e ||
      byteAt(bytes, 3) !== 0x47 ||
      asciiAt(bytes, 12, 4) !== "IHDR"
    ) {
      return null;
    }

    return validDimensions(readUint32BE(bytes, 16), readUint32BE(bytes, 20));
  }

  function dimensionsFromGif(bytes) {
    const signature = asciiAt(bytes, 0, 6);
    if (bytes.length < 10 || (signature !== "GIF87a" && signature !== "GIF89a")) {
      return null;
    }

    return validDimensions(readUint16LE(bytes, 6), readUint16LE(bytes, 8));
  }

  function dimensionsFromJpeg(bytes) {
    if (bytes.length < 4 || byteAt(bytes, 0) !== 0xff || byteAt(bytes, 1) !== 0xd8) {
      return null;
    }

    let offset = 2;

    while (offset + 9 < bytes.length) {
      while (offset < bytes.length && byteAt(bytes, offset) !== 0xff) {
        offset += 1;
      }

      while (offset < bytes.length && byteAt(bytes, offset) === 0xff) {
        offset += 1;
      }

      if (offset >= bytes.length) {
        return null;
      }

      const marker = byteAt(bytes, offset);
      offset += 1;

      if (marker === 0xd9 || marker === 0xda) {
        return null;
      }

      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue;
      }

      if (offset + 2 > bytes.length) {
        return null;
      }

      const segmentLength = readUint16BE(bytes, offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) {
        return null;
      }

      if (isJpegStartOfFrame(marker) && offset + 7 <= bytes.length) {
        return validDimensions(readUint16BE(bytes, offset + 5), readUint16BE(bytes, offset + 3));
      }

      offset += segmentLength;
    }

    return null;
  }

  function dimensionsFromWebp(bytes) {
    if (bytes.length < 30 || asciiAt(bytes, 0, 4) !== "RIFF" || asciiAt(bytes, 8, 4) !== "WEBP") {
      return null;
    }

    let offset = 12;

    while (offset + 8 <= bytes.length) {
      const chunkType = asciiAt(bytes, offset, 4);
      const chunkSize = readUint32LE(bytes, offset + 4);
      const dataOffset = offset + 8;

      if (chunkType === "VP8X" && dataOffset + 10 <= bytes.length) {
        return validDimensions(readUint24LE(bytes, dataOffset + 4) + 1, readUint24LE(bytes, dataOffset + 7) + 1);
      }

      if (chunkType === "VP8L" && dataOffset + 5 <= bytes.length && byteAt(bytes, dataOffset) === 0x2f) {
        const b0 = byteAt(bytes, dataOffset + 1);
        const b1 = byteAt(bytes, dataOffset + 2);
        const b2 = byteAt(bytes, dataOffset + 3);
        const b3 = byteAt(bytes, dataOffset + 4);
        return validDimensions(((b1 & 0x3f) << 8) + b0 + 1, ((b3 & 0x0f) << 10) + (b2 << 2) + ((b1 & 0xc0) >> 6) + 1);
      }

      if (
        chunkType === "VP8 " &&
        dataOffset + 10 <= bytes.length &&
        byteAt(bytes, dataOffset + 3) === 0x9d &&
        byteAt(bytes, dataOffset + 4) === 0x01 &&
        byteAt(bytes, dataOffset + 5) === 0x2a
      ) {
        return validDimensions(readUint16LE(bytes, dataOffset + 6) & 0x3fff, readUint16LE(bytes, dataOffset + 8) & 0x3fff);
      }

      if (!Number.isFinite(chunkSize) || chunkSize < 0) {
        return null;
      }

      offset = dataOffset + chunkSize + (chunkSize % 2);
    }

    return null;
  }

  function isJpegStartOfFrame(marker) {
    return (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    );
  }

  function validDimensions(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 100000 || height > 100000) {
      return null;
    }

    return { width, height };
  }

  function asciiAt(bytes, offset, length) {
    let value = "";
    for (let index = 0; index < length; index += 1) {
      value += String.fromCharCode(byteAt(bytes, offset + index));
    }
    return value;
  }

  function byteAt(bytes, index) {
    return Number(bytes[index]) & 255;
  }

  function readUint16BE(bytes, offset) {
    return (byteAt(bytes, offset) << 8) + byteAt(bytes, offset + 1);
  }

  function readUint16LE(bytes, offset) {
    return byteAt(bytes, offset) + (byteAt(bytes, offset + 1) << 8);
  }

  function readUint24LE(bytes, offset) {
    return byteAt(bytes, offset) + (byteAt(bytes, offset + 1) << 8) + (byteAt(bytes, offset + 2) << 16);
  }

  function readUint32BE(bytes, offset) {
    return (
      byteAt(bytes, offset) * 0x1000000 +
      (byteAt(bytes, offset + 1) << 16) +
      (byteAt(bytes, offset + 2) << 8) +
      byteAt(bytes, offset + 3)
    );
  }

  function readUint32LE(bytes, offset) {
    return (
      byteAt(bytes, offset) +
      (byteAt(bytes, offset + 1) << 8) +
      (byteAt(bytes, offset + 2) << 16) +
      byteAt(bytes, offset + 3) * 0x1000000
    );
  }

  function recordSkipped(result, limit, itemId, reason) {
    result.skipped += 1;
    if (result.skippedItems.length < limit) {
      result.skippedItems.push({ itemId, reason });
    }
  }

  function recordFailed(result, limit, itemId, reason) {
    result.failed += 1;
    if (result.failedItems.length < limit) {
      result.failedItems.push({ itemId, reason });
    }
  }
});

routerAdd("POST", "/api/vita/item-thumbnail", (e) => {
  const localGuard = localThumbnailRequest(e.request);
  if (!localGuard.ok) {
    return e.json(403, { error: "thumbnail backfill is only available from localhost" });
  }

  const body = new DynamicModel({
    workspace_id: "",
    item_id: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const itemId = requiredString(body.item_id, "item_id");
  const uploadedFiles = e.findUploadedFiles("thumbnail_file");
  const thumbnailFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;

  if (!thumbnailFile) {
    throw new BadRequestError("thumbnail_file is required");
  }

  const thumbnailFileName = fileOriginalName(thumbnailFile, "thumbnail.webp");
  const thumbnailMimeType = thumbnailMimeTypeForFileName(thumbnailFileName);

  if (!thumbnailMimeType) {
    throw new BadRequestError("thumbnail_file must be jpg, png, or webp");
  }

  const itemRows = arrayOf(
    new DynamicModel({
      id: "",
    }),
  );

  e.app
    .db()
    .newQuery(
      `
        SELECT i.id
        FROM items i
        INNER JOIN items_image img
          ON img.item_id = i.id
        WHERE i.workspace_id = {:workspaceId}
          AND i.id = {:itemId}
          AND img.file_ref IS NOT NULL
          AND img.file_ref != ''
        LIMIT 1
      `,
    )
    .bind({ workspaceId, itemId })
    .all(itemRows);

  if (itemRows.length === 0) {
    throw new NotFoundError("image item not found");
  }

  const now = new Date().toISOString();
  const thumbnailFileRef = thumbnailFileKeyFor(workspaceId, itemId, thumbnailFileName);
  const filesystem = e.app.newFilesystem();

  try {
    filesystem.uploadFile(thumbnailFile, thumbnailFileRef);
  } finally {
    filesystem.close();
  }

  e.app
    .db()
    .newQuery(
      `
        DELETE FROM item_assets
        WHERE workspace_id = {:workspaceId}
          AND item_id = {:itemId}
          AND role = 'thumbnail'
      `,
    )
    .bind({ workspaceId, itemId })
    .execute();

  e.app
    .db()
    .newQuery(
      `
        INSERT INTO item_assets (
          id,
          workspace_id,
          item_id,
          role,
          file_ref,
          original_name,
          mime_type,
          size_bytes,
          created_at
        ) VALUES (
          {:assetId},
          {:workspaceId},
          {:itemId},
          'thumbnail',
          {:thumbnailFileRef},
          {:thumbnailFileName},
          {:thumbnailMimeType},
          {:thumbnailSize},
          {:now}
        )
      `,
    )
    .bind({
      assetId: `asset:${itemId}:thumbnail`,
      workspaceId,
      itemId,
      thumbnailFileRef,
      thumbnailFileName,
      thumbnailMimeType,
      thumbnailSize: thumbnailFile.size,
      now,
    })
    .execute();

  return e.json(200, {
    itemId,
    thumbnailFileRef,
    thumbnailMimeType,
    thumbnailSize: thumbnailFile.size,
  });

  function requiredString(value, fieldName) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new BadRequestError(`${fieldName} is required`);
    }

    return value.trim();
  }

  function localThumbnailRequest(request) {
    const remoteAddr = request && typeof request.remoteAddr === "string" ? request.remoteAddr : "";

    if (remoteAddr === "") {
      return { ok: true };
    }

    const host = remoteAddr.startsWith("[") ? remoteAddr.slice(1, remoteAddr.indexOf("]")) : remoteAddr.split(":")[0];
    return { ok: host === "127.0.0.1" || host === "::1" || host === "localhost" };
  }

  function fileOriginalName(file, fallbackName) {
    return sanitizeFileName(file.originalName || file.name || fallbackName, fallbackName);
  }

  function sanitizeFileName(value, fallbackName) {
    const cleaned = String(value)
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    return cleaned || fallbackName;
  }

  function safePathSegment(value) {
    return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  function thumbnailFileKeyFor(workspaceId, itemId, fileName) {
    return `imports/${safePathSegment(workspaceId)}/${safePathSegment(itemId)}/thumb-${fileName}`;
  }

  function thumbnailMimeTypeForFileName(fileName) {
    const lower = fileName.toLowerCase();

    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      return "image/jpeg";
    }

    if (lower.endsWith(".png")) {
      return "image/png";
    }

    if (lower.endsWith(".webp")) {
      return "image/webp";
    }

    return "";
  }
});

routerAdd("POST", "/api/vita/item-capture", (e) => {
  const videoUploadMaxBytes = 250 * 1024 * 1024;
  const videoPosterMaxBytes = 10 * 1024 * 1024;

  const body = new DynamicModel({
    workspace_id: "",
    type: "",
    body: "",
    url: "",
    source_external_id: "",
    actor: "",
    width: "",
    height: "",
    duration_ms: "",
    aspect_ratio: "",
    dominant_colors: "",
    perceptual_hash: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const type = requiredString(body.type, "type");
  const noteBody = optionalString(body.body);
  const rawUrl = optionalString(body.url);
  const actor = optionalString(body.actor) || "system";
  let uploadedFile = null;
  let uploadedThumbnailFile = null;
  let uploadedPosterFile = null;

  if (!["note", "link", "image", "pdf", "video"].includes(type)) {
    throw new BadRequestError("capture type must be note, link, image, pdf, or video");
  }

  if (type === "note" && !noteBody) {
    throw new BadRequestError("body is required");
  }

  if (type === "link" && !rawUrl) {
    throw new BadRequestError("url is required");
  }

  if (type === "image" || type === "pdf" || type === "video") {
    const uploadedFiles = e.findUploadedFiles("file");
    uploadedFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;

    if (type === "image") {
      const uploadedThumbnailFiles = e.findUploadedFiles("thumbnail_file");
      uploadedThumbnailFile = uploadedThumbnailFiles.length > 0 ? uploadedThumbnailFiles[0] : null;
    }

    if (type === "video") {
      const uploadedPosterFiles = e.findUploadedFiles("poster_file");
      uploadedPosterFile = uploadedPosterFiles.length > 0 ? uploadedPosterFiles[0] : null;
    }
  }

  if ((type === "image" || type === "pdf" || type === "video") && !uploadedFile) {
    throw new BadRequestError("file is required");
  }

  if (type === "video" && !uploadedPosterFile) {
    throw new BadRequestError("poster_file is required");
  }

  function requiredString(value, fieldName) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new BadRequestError(`${fieldName} is required`);
    }

    return value.trim();
  }

  function optionalString(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim();
  }

  function rowString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valid")) {
      return value.valid && typeof value.string === "string" ? value.string.trim() : "";
    }

    return String(value).trim();
  }

  function queryAll(app, sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  function idSuffix() {
    return Math.random().toString(36).slice(2, 10);
  }

  function itemIdFor(itemType, timestamp) {
    if (itemType === "image") {
      return `capture:image:${timestamp}:${idSuffix()}`;
    }

    if (itemType === "pdf") {
      return `capture:pdf:${timestamp}:${idSuffix()}`;
    }

    if (itemType === "video") {
      return `capture:video:${timestamp}:${idSuffix()}`;
    }

    if (itemType === "link") {
      return `capture:link:${timestamp}:${idSuffix()}`;
    }

    return `capture:note:${timestamp}:${idSuffix()}`;
  }

  function externalIdFor(timestamp) {
    return `manual:note:${timestamp}:${idSuffix()}`;
  }

  function imageExternalIdFor(timestamp) {
    return `local:image:${timestamp}:${idSuffix()}`;
  }

  function pdfExternalIdFor(fileName, fileSize) {
    return `local:pdf:${safePathSegment(fileName)}:${fileSize || 0}`;
  }

  function videoExternalIdFor(fileName, fileSize, durationMs, width, height) {
    return `local:video:${safePathSegment(fileName)}:${fileSize || 0}:${durationMs}:${width}x${height}`;
  }

  function eventIdFor(itemId, timestamp) {
    return `capture:event:${itemId}:${timestamp}:${idSuffix()}`;
  }

  function manualSourceIdFor(workspaceId) {
    return `source:manual:${workspaceId}`;
  }

  function localSourceIdFor(workspaceId) {
    return `source:local:${workspaceId}`;
  }

  function sourceIdFor(workspaceId, sourceKind, sourceIdentifier) {
    if (sourceKind === "local") {
      return localSourceIdFor(workspaceId);
    }

    if (sourceKind === "manual") {
      return manualSourceIdFor(workspaceId);
    }

    return `source:${sourceKind}:${workspaceId}:${sourceIdentifier.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  }

  function urlSourceIdFor(workspaceId, identifier) {
    return `source:url:${workspaceId}:${identifier}`;
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();

    if (!/^https?:\/\//i.test(trimmed)) {
      throw new BadRequestError("url must start with http:// or https://");
    }

    return trimmed.replace(/#.*$/, "").replace(/\/$/, "");
  }

  function urlIdentifierFor(value) {
    const match = value.match(/^https?:\/\/([^/?#]+)/i);

    if (!match || !match[1]) {
      throw new BadRequestError("url host is required");
    }

    return match[1].toLowerCase();
  }

  function linkSourceFor(value) {
    const host = urlIdentifierFor(value);

    if (isPinterestHost(host)) {
      return {
        kind: "pinterest",
        identifier: "pinterest",
        label: "Pinterest",
      };
    }

    if (isArenaHost(host)) {
      return {
        kind: "arena",
        identifier: "arena",
        label: "Are.na",
      };
    }

    if (isYouTubeHost(host)) {
      return {
        kind: "url",
        identifier: "youtube",
        label: "YouTube",
      };
    }

    return {
      kind: "url",
      identifier: host,
      label: host,
    };
  }

  function isPinterestHost(host) {
    return (
      host === "pin.it" ||
      host === "pinterest.com" ||
      host.endsWith(".pinterest.com") ||
      host === "pinimg.com" ||
      host.endsWith(".pinimg.com")
    );
  }

  function isArenaHost(host) {
    return host === "are.na" || host.endsWith(".are.na");
  }

  function linkContentTypeFor(value) {
    const lower = value.toLowerCase();

    if (lower.endsWith(".pdf")) {
      return "pdf";
    }

    if (lower.includes("youtube.com/") || lower.includes("youtu.be/") || lower.includes("vimeo.com/")) {
      return "video";
    }

    return "unknown";
  }

  function linkMetadataFor(value) {
    const fallback = { url: value };

    if (isDirectImageUrl(value)) {
      return {
        url: value,
        title: fileTitleForUrl(value),
        image: value,
      };
    }

    const providerMetadata = providerLinkMetadataFor(value);
    if (providerMetadata && providerMetadata.image) {
      return providerMetadata;
    }

    try {
      const response = $http.send({
        method: "GET",
        url: value,
        timeout: 8,
        headers: {
          Accept: "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8",
          "User-Agent": "VitaArchiveBot/0.1 (+https://localhost)",
        },
      });

      if (response.statusCode < 200 || response.statusCode >= 400) {
        return fallback;
      }

      const contentType = headerValue(response.headers, "Content-Type").toLowerCase();
      if (contentType.startsWith("image/")) {
        return {
          url: value,
          title: fileTitleForUrl(value),
          image: value,
        };
      }

      if (contentType && !contentType.includes("html")) {
        return fallback;
      }

      const html = String(toString(response.body || [])).slice(0, 300000);
      const image = firstMetaContent(html, [
        "og:image:secure_url",
        "og:image",
        "twitter:image",
        "twitter:image:src",
      ]);
      const title =
        firstMetaContent(html, ["og:title", "twitter:title"]) ||
        titleTagContent(html) ||
        "";
      const description = firstMetaContent(html, [
        "og:description",
        "twitter:description",
        "description",
      ]);
      const siteName = firstMetaContent(html, ["og:site_name", "application-name"]);
      const metadata = { url: value };

      if (title) {
        metadata.title = title;
      }

      if (image) {
        metadata.image = absoluteUrlFor(image, value);
      }

      if (description) {
        metadata.description = description;
      }

      if (siteName) {
        metadata.siteName = siteName;
      }

      if (!metadata.image && providerMetadata && providerMetadata.image) {
        metadata.image = providerMetadata.image;
      }

      if (!metadata.title && providerMetadata && providerMetadata.title) {
        metadata.title = providerMetadata.title;
      }

      if (!metadata.description && providerMetadata && providerMetadata.description) {
        metadata.description = providerMetadata.description;
      }

      if (!metadata.siteName && providerMetadata && providerMetadata.siteName) {
        metadata.siteName = providerMetadata.siteName;
      }

      if (providerMetadata && providerMetadata.providerName) {
        metadata.providerName = providerMetadata.providerName;
      }

      return metadata;
    } catch {
      return providerMetadata || fallback;
    }
  }

  function providerLinkMetadataFor(value) {
    const host = urlIdentifierFor(value);

    if (isPinterestHost(host) && host !== "pinimg.com" && !host.endsWith(".pinimg.com")) {
      return pinterestOembedMetadataFor(value);
    }

    if (isYouTubeHost(host)) {
      return youtubeOembedMetadataFor(value);
    }

    return null;
  }

  function isYouTubeHost(host) {
    return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com");
  }

  function pinterestOembedMetadataFor(value) {
    const data = fetchJsonFor(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(value)}`);

    if (!data) {
      return null;
    }

    return compactMetadata({
      url: value,
      title: stringValue(data.title),
      image: stringValue(data.thumbnail_url),
      description: stringValue(data.description),
      siteName: "Pinterest",
      providerName: stringValue(data.provider_name) || "Pinterest",
    });
  }

  function youtubeOembedMetadataFor(value) {
    const data = fetchJsonFor(`https://www.youtube.com/oembed?url=${encodeURIComponent(value)}&format=json`);
    const videoId = youtubeVideoIdFor(value);

    if (!data && !videoId) {
      return null;
    }

    return compactMetadata({
      url: value,
      title: data ? stringValue(data.title) : null,
      image: data ? stringValue(data.thumbnail_url) : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      description: data ? stringValue(data.author_name) : null,
      siteName: "YouTube",
      providerName: data ? stringValue(data.provider_name) || "YouTube" : "YouTube",
    });
  }

  function youtubeVideoIdFor(value) {
    const trimmed = String(value || "").trim();
    const shortMatch = trimmed.match(/^https?:\/\/(?:www\.)?youtu\.be\/([^/?#]+)/i);
    if (shortMatch && shortMatch[1]) {
      return shortMatch[1];
    }

    const watchMatch = trimmed.match(/[?&]v=([^&#]+)/i);
    if (watchMatch && watchMatch[1]) {
      return watchMatch[1];
    }

    const embedMatch = trimmed.match(/\/(?:embed|shorts)\/([^/?#]+)/i);
    return embedMatch && embedMatch[1] ? embedMatch[1] : null;
  }

  function fetchJsonFor(url) {
    try {
      const response = $http.send({
        method: "GET",
        url,
        timeout: 8,
        headers: {
          Accept: "application/json,text/plain,*/*;q=0.8",
          "User-Agent": "VitaArchiveBot/0.1 (+https://localhost)",
        },
      });

      if (response.statusCode < 200 || response.statusCode >= 400) {
        return null;
      }

      return JSON.parse(String(toString(response.body || [])));
    } catch {
      return null;
    }
  }

  function compactMetadata(value) {
    const metadata = { url: value.url };

    if (value.title) {
      metadata.title = value.title;
    }

    if (value.image) {
      metadata.image = value.image;
    }

    if (value.description) {
      metadata.description = value.description;
    }

    if (value.siteName) {
      metadata.siteName = value.siteName;
    }

    if (value.providerName) {
      metadata.providerName = value.providerName;
    }

    return metadata;
  }

  function stringValue(value) {
    const trimmed = String(value || "").trim();
    return trimmed || null;
  }

  function headerValue(headers, name) {
    const lowerName = name.toLowerCase();

    for (const key in headers) {
      if (key.toLowerCase() === lowerName) {
        const value = headers[key];
        return Array.isArray(value) ? String(value[0] || "") : String(value || "");
      }
    }

    return "";
  }

  function firstMetaContent(html, names) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];

    for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
      const tag = tags[tagIndex];
      const property = attrValue(tag, "property") || attrValue(tag, "name");

      if (!property) {
        continue;
      }

      for (let nameIndex = 0; nameIndex < names.length; nameIndex += 1) {
        if (property.toLowerCase() === names[nameIndex].toLowerCase()) {
          const content = attrValue(tag, "content");
          if (content) {
            return normalizeMetadataText(content);
          }
        }
      }
    }

    return "";
  }

  function attrValue(tag, attrName) {
    const quoted = tag.match(new RegExp(`${attrName}\\s*=\\s*([\"'])(.*?)\\1`, "i"));
    if (quoted && quoted[2]) {
      return decodeHtmlEntities(quoted[2]);
    }

    const unquoted = tag.match(new RegExp(`${attrName}\\s*=\\s*([^\\s>]+)`, "i"));
    return unquoted && unquoted[1] ? decodeHtmlEntities(unquoted[1]) : "";
  }

  function titleTagContent(html) {
    const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    return match && match[1] ? normalizeMetadataText(match[1].replace(/<[^>]+>/g, "")) : "";
  }

  function normalizeMetadataText(value) {
    return decodeHtmlEntities(value).replace(/\s+/g, " ").trim().slice(0, 500);
  }

  function decodeHtmlEntities(value) {
    return String(value)
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function absoluteUrlFor(value, baseUrl) {
    const trimmed = String(value || "").trim();

    if (/^https?:\/\//i.test(trimmed)) {
      return secureRemoteMediaUrl(trimmed);
    }

    const origin = baseUrl.match(/^(https?:)\/\/([^/]+)/i);
    if (!origin) {
      return trimmed;
    }

    if (trimmed.startsWith("//")) {
      return `${origin[1]}${trimmed}`;
    }

    if (trimmed.startsWith("/")) {
      return `${origin[1]}//${origin[2]}${trimmed}`;
    }

    return `${baseUrl.replace(/\/[^/]*$/, "/")}${trimmed}`;
  }

  function secureRemoteMediaUrl(value) {
    const match = String(value || "").match(/^http:\/\/([^/?#]+)(.*)$/i);
    if (!match) {
      return value;
    }

    const host = match[1].toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) {
      return value;
    }

    return `https://${match[1]}${match[2] || ""}`;
  }

  function isDirectImageUrl(value) {
    const lower = value.toLowerCase();
    const host = urlIdentifierFor(value);
    const path = lower.replace(/[?#].*$/, "");

    return (
      host === "i.pinimg.com" ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".png") ||
      path.endsWith(".webp") ||
      path.endsWith(".gif") ||
      path.endsWith(".avif")
    );
  }

  function fileTitleForUrl(value) {
    const path = value.replace(/[?#].*$/, "").split("/");
    const fileName = decodeHtmlEntities(path[path.length - 1] || "").replace(/[-_]+/g, " ").trim();
    return fileName || urlIdentifierFor(value);
  }

  function fileOriginalName(file, fallbackName) {
    return sanitizeFileName(file.originalName || file.name || fallbackName, fallbackName);
  }

  function sanitizeFileName(value, fallbackName) {
    const cleaned = String(value)
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    return cleaned || fallbackName;
  }

  function safePathSegment(value) {
    return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  function mimeTypeForFileName(fileName) {
    const lower = fileName.toLowerCase();

    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      return "image/jpeg";
    }

    if (lower.endsWith(".png")) {
      return "image/png";
    }

    if (lower.endsWith(".webp")) {
      return "image/webp";
    }

    if (lower.endsWith(".gif")) {
      return "image/gif";
    }

    if (lower.endsWith(".avif")) {
      return "image/avif";
    }

    return "";
  }

  function imageDimensionsForUploadedFile(file, mimeType) {
    if (!file || typeof mimeType !== "string" || !mimeType.toLowerCase().startsWith("image/")) {
      return { width: null, height: null };
    }

    let reader = null;

    try {
      reader = file.reader.open();
      const maxHeaderBytes = Math.min(Math.max(Number(file.size) || 0, 4096), 1024 * 1024);
      const bytes = normalizeBytes(toBytes(reader, maxHeaderBytes));
      const dimensions =
        dimensionsFromPng(bytes) ||
        dimensionsFromJpeg(bytes) ||
        dimensionsFromWebp(bytes) ||
        dimensionsFromGif(bytes);

      if (dimensions) {
        return dimensions;
      }

      console.warn(`image dimension extraction skipped for unsupported or unreadable image: ${file.originalName || file.name || "upload"}`);
    } catch (error) {
      console.warn(`image dimension extraction failed for ${file.originalName || file.name || "upload"}`, error);
    } finally {
      if (reader) {
        reader.close();
      }
    }

    return { width: null, height: null };
  }

  function normalizeBytes(value) {
    if (!value) {
      return [];
    }

    if (typeof value === "string") {
      const bytes = [];
      for (let index = 0; index < value.length; index += 1) {
        bytes.push(value.charCodeAt(index) & 255);
      }
      return bytes;
    }

    if (typeof value.length === "number") {
      const bytes = [];
      for (let index = 0; index < value.length; index += 1) {
        bytes.push(Number(value[index]) & 255);
      }
      return bytes;
    }

    return [];
  }

  function dimensionsFromPng(bytes) {
    if (
      bytes.length < 24 ||
      byteAt(bytes, 0) !== 0x89 ||
      byteAt(bytes, 1) !== 0x50 ||
      byteAt(bytes, 2) !== 0x4e ||
      byteAt(bytes, 3) !== 0x47 ||
      asciiAt(bytes, 12, 4) !== "IHDR"
    ) {
      return null;
    }

    return validDimensions(readUint32BE(bytes, 16), readUint32BE(bytes, 20));
  }

  function dimensionsFromGif(bytes) {
    const signature = asciiAt(bytes, 0, 6);
    if (bytes.length < 10 || (signature !== "GIF87a" && signature !== "GIF89a")) {
      return null;
    }

    return validDimensions(readUint16LE(bytes, 6), readUint16LE(bytes, 8));
  }

  function dimensionsFromJpeg(bytes) {
    if (bytes.length < 4 || byteAt(bytes, 0) !== 0xff || byteAt(bytes, 1) !== 0xd8) {
      return null;
    }

    let offset = 2;

    while (offset + 9 < bytes.length) {
      while (offset < bytes.length && byteAt(bytes, offset) !== 0xff) {
        offset += 1;
      }

      while (offset < bytes.length && byteAt(bytes, offset) === 0xff) {
        offset += 1;
      }

      if (offset >= bytes.length) {
        return null;
      }

      const marker = byteAt(bytes, offset);
      offset += 1;

      if (marker === 0xd9 || marker === 0xda) {
        return null;
      }

      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue;
      }

      if (offset + 2 > bytes.length) {
        return null;
      }

      const segmentLength = readUint16BE(bytes, offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) {
        return null;
      }

      if (isJpegStartOfFrame(marker) && offset + 7 <= bytes.length) {
        return validDimensions(readUint16BE(bytes, offset + 5), readUint16BE(bytes, offset + 3));
      }

      offset += segmentLength;
    }

    return null;
  }

  function dimensionsFromWebp(bytes) {
    if (bytes.length < 30 || asciiAt(bytes, 0, 4) !== "RIFF" || asciiAt(bytes, 8, 4) !== "WEBP") {
      return null;
    }

    let offset = 12;

    while (offset + 8 <= bytes.length) {
      const chunkType = asciiAt(bytes, offset, 4);
      const chunkSize = readUint32LE(bytes, offset + 4);
      const dataOffset = offset + 8;

      if (chunkType === "VP8X" && dataOffset + 10 <= bytes.length) {
        return validDimensions(readUint24LE(bytes, dataOffset + 4) + 1, readUint24LE(bytes, dataOffset + 7) + 1);
      }

      if (chunkType === "VP8L" && dataOffset + 5 <= bytes.length && byteAt(bytes, dataOffset) === 0x2f) {
        const b0 = byteAt(bytes, dataOffset + 1);
        const b1 = byteAt(bytes, dataOffset + 2);
        const b2 = byteAt(bytes, dataOffset + 3);
        const b3 = byteAt(bytes, dataOffset + 4);
        return validDimensions(((b1 & 0x3f) << 8) + b0 + 1, ((b3 & 0x0f) << 10) + (b2 << 2) + ((b1 & 0xc0) >> 6) + 1);
      }

      if (
        chunkType === "VP8 " &&
        dataOffset + 10 <= bytes.length &&
        byteAt(bytes, dataOffset + 3) === 0x9d &&
        byteAt(bytes, dataOffset + 4) === 0x01 &&
        byteAt(bytes, dataOffset + 5) === 0x2a
      ) {
        return validDimensions(readUint16LE(bytes, dataOffset + 6) & 0x3fff, readUint16LE(bytes, dataOffset + 8) & 0x3fff);
      }

      if (!Number.isFinite(chunkSize) || chunkSize < 0) {
        return null;
      }

      offset = dataOffset + chunkSize + (chunkSize % 2);
    }

    return null;
  }

  function isJpegStartOfFrame(marker) {
    return (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    );
  }

  function validDimensions(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 100000 || height > 100000) {
      return null;
    }

    return { width, height };
  }

  function asciiAt(bytes, offset, length) {
    let value = "";
    for (let index = 0; index < length; index += 1) {
      value += String.fromCharCode(byteAt(bytes, offset + index));
    }
    return value;
  }

  function byteAt(bytes, index) {
    return Number(bytes[index]) & 255;
  }

  function readUint16BE(bytes, offset) {
    return (byteAt(bytes, offset) << 8) + byteAt(bytes, offset + 1);
  }

  function readUint16LE(bytes, offset) {
    return byteAt(bytes, offset) + (byteAt(bytes, offset + 1) << 8);
  }

  function readUint24LE(bytes, offset) {
    return byteAt(bytes, offset) + (byteAt(bytes, offset + 1) << 8) + (byteAt(bytes, offset + 2) << 16);
  }

  function readUint32BE(bytes, offset) {
    return (
      byteAt(bytes, offset) * 0x1000000 +
      (byteAt(bytes, offset + 1) << 16) +
      (byteAt(bytes, offset + 2) << 8) +
      byteAt(bytes, offset + 3)
    );
  }

  function readUint32LE(bytes, offset) {
    return (
      byteAt(bytes, offset) +
      (byteAt(bytes, offset + 1) << 8) +
      (byteAt(bytes, offset + 2) << 16) +
      byteAt(bytes, offset + 3) * 0x1000000
    );
  }

  function imageFileKeyFor(workspaceId, itemId, fileName) {
    return `imports/${safePathSegment(workspaceId)}/${safePathSegment(itemId)}/${fileName}`;
  }

  function thumbnailFileKeyFor(workspaceId, itemId, fileName) {
    return `imports/${safePathSegment(workspaceId)}/${safePathSegment(itemId)}/thumb-${fileName}`;
  }

  function videoPosterFileKeyFor(workspaceId, itemId, fileName) {
    return `imports/${safePathSegment(workspaceId)}/${safePathSegment(itemId)}/poster-${fileName}`;
  }

  function thumbnailMimeTypeForFileName(fileName) {
    const lower = fileName.toLowerCase();

    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      return "image/jpeg";
    }

    if (lower.endsWith(".png")) {
      return "image/png";
    }

    if (lower.endsWith(".webp")) {
      return "image/webp";
    }

    return "";
  }

  function storeThumbnailAsset(app, workspaceId, itemId, thumbnailFile, now) {
    if (!thumbnailFile) {
      return "";
    }

    const thumbnailFileName = fileOriginalName(thumbnailFile, "thumbnail.webp");
    const thumbnailMimeType = thumbnailMimeTypeForFileName(thumbnailFileName);

    if (!thumbnailMimeType) {
      return "";
    }

    const thumbnailFileRef = thumbnailFileKeyFor(workspaceId, itemId, thumbnailFileName);
    const filesystem = app.newFilesystem();

    try {
      filesystem.uploadFile(thumbnailFile, thumbnailFileRef);
    } finally {
      filesystem.close();
    }

    app
      .db()
      .newQuery(
        `
          DELETE FROM item_assets
          WHERE workspace_id = {:workspaceId}
            AND item_id = {:itemId}
            AND role = 'thumbnail'
        `,
      )
      .bind({ workspaceId, itemId })
      .execute();

    app
      .db()
      .newQuery(
        `
          INSERT INTO item_assets (
            id,
            workspace_id,
            item_id,
            role,
            file_ref,
            original_name,
            mime_type,
            size_bytes,
            created_at
          ) VALUES (
            {:assetId},
            {:workspaceId},
            {:itemId},
            'thumbnail',
            {:thumbnailFileRef},
            {:thumbnailFileName},
            {:thumbnailMimeType},
            {:thumbnailSize},
            {:now}
          )
        `,
      )
      .bind({
        assetId: `asset:${itemId}:thumbnail`,
        workspaceId,
        itemId,
        thumbnailFileRef,
        thumbnailFileName,
        thumbnailMimeType,
        thumbnailSize: thumbnailFile.size,
        now,
      })
      .execute();

    return thumbnailFileRef;
  }

  function pdfMimeTypeForFile(file, fileName) {
    const uploadedType = typeof file.type === "string" ? file.type.toLowerCase() : "";

    if (uploadedType === "application/pdf") {
      return "application/pdf";
    }

    return fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "";
  }

  function videoMimeTypeForFile(file, fileName) {
    const uploadedType = typeof file.type === "string" ? file.type.toLowerCase() : "";

    if (["video/mp4", "video/webm", "video/quicktime"].includes(uploadedType)) {
      return uploadedType;
    }

    const lower = fileName.toLowerCase();
    if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) {
      return "video/mp4";
    }

    if (lower.endsWith(".webm")) {
      return "video/webm";
    }

    if (lower.endsWith(".mov") || lower.endsWith(".qt")) {
      return "video/quicktime";
    }

    return "";
  }

  function posterMimeTypeForFile(file, fileName) {
    const uploadedType = typeof file.type === "string" ? file.type.toLowerCase() : "";

    if (["image/jpeg", "image/png", "image/webp"].includes(uploadedType)) {
      return uploadedType;
    }

    return thumbnailMimeTypeForFileName(fileName);
  }

  function assertMaxFileSize(file, maxBytes, label) {
    const fileSize = Number(file && file.size) || 0;
    if (fileSize > maxBytes) {
      throw new BadRequestError(label + " must be " + formatMegabytes(maxBytes) + "MB or smaller");
    }
  }

  function formatMegabytes(bytes) {
    return Math.floor(bytes / 1024 / 1024);
  }

  function videoMetadataFromBody(value) {
    const width = requiredPositiveInteger(value.width, "width", 100000);
    const height = requiredPositiveInteger(value.height, "height", 100000);
    const durationMs = requiredPositiveInteger(value.duration_ms, "duration_ms", 24 * 60 * 60 * 1000);
    const aspectRatio = requiredPositiveNumber(value.aspect_ratio, "aspect_ratio", 1000);
    const expectedAspectRatio = width / height;
    const tolerance = Math.max(0.01, expectedAspectRatio * 0.02);

    if (Math.abs(aspectRatio - expectedAspectRatio) > tolerance) {
      throw new BadRequestError("aspect_ratio must match width / height");
    }

    return {
      width,
      height,
      durationMs,
      aspectRatio,
      dominantColors: normalizedDominantColorsJson(value.dominant_colors),
      perceptualHash: optionalHashString(value.perceptual_hash),
    };
  }

  function requiredPositiveInteger(value, fieldName, maxValue) {
    const parsed = Number(optionalString(value));

    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maxValue) {
      throw new BadRequestError(fieldName + " must be a positive integer");
    }

    return parsed;
  }

  function requiredPositiveNumber(value, fieldName, maxValue) {
    const parsed = Number(optionalString(value));

    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maxValue) {
      throw new BadRequestError(fieldName + " must be a positive number");
    }

    return parsed;
  }

  function normalizedDominantColorsJson(value) {
    const raw = optionalString(value);
    if (!raw) {
      return null;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestError("dominant_colors must be a JSON array of hex colors");
    }

    if (!Array.isArray(parsed) || parsed.length > 12) {
      throw new BadRequestError("dominant_colors must be a JSON array of up to 12 hex colors");
    }

    const colors = parsed.map((color) => String(color || "").trim().toLowerCase());
    for (let index = 0; index < colors.length; index += 1) {
      if (!/^#[0-9a-f]{6}$/.test(colors[index])) {
        throw new BadRequestError("dominant_colors must contain only #rrggbb values");
      }
    }

    return JSON.stringify(colors);
  }

  function optionalHashString(value) {
    const raw = optionalString(value);
    if (!raw) {
      return null;
    }

    if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(raw)) {
      throw new BadRequestError("perceptual_hash is invalid");
    }

    return raw;
  }

  function uploadStoredFile(app, file, fileRef, storedFileRefs) {
    const filesystem = app.newFilesystem();
    try {
      filesystem.uploadFile(file, fileRef);
      storedFileRefs.push(fileRef);
    } finally {
      filesystem.close();
    }
  }

  function cleanupStoredFiles(app, fileRefs) {
    if (!fileRefs.length) {
      return;
    }

    const filesystem = app.newFilesystem();
    try {
      for (let index = fileRefs.length - 1; index >= 0; index -= 1) {
        try {
          filesystem.delete(fileRefs[index]);
        } catch (error) {
          console.warn("failed to clean up orphan upload " + fileRefs[index], error);
        }
      }
    } finally {
      filesystem.close();
    }
  }

  let linkMetadata = null;

  if (type === "link") {
    linkMetadata = linkMetadataFor(normalizeUrl(rawUrl));
  }

  let result = null;
  const storedFileRefs = [];

  try {
    e.app.runInTransaction((txApp) => {
    const workspaceRows = queryAll(
      txApp,
      `
        SELECT id
        FROM workspaces
        WHERE id = {:workspaceId}
        LIMIT 1
      `,
      { id: "" },
      { workspaceId },
    );

    if (workspaceRows.length === 0) {
      throw new NotFoundError("workspace not found");
    }

    const now = new Date().toISOString();
    let sourceId = null;
    let sourceExternalId = optionalString(body.source_external_id);
    let normalizedUrl = "";
    let linkContentType = null;
    let assetFileName = "";
    let assetFileRef = "";
    let assetMimeType = "";
    let sourceKind = "manual";
    let sourceIdentifier = "manual";
    let sourceLabel = "Manual entries";
    let itemTitle = null;
    let storedItemType = type;
    let imageWidth = null;
    let imageHeight = null;
    let videoMetadata = null;
    let videoPosterFileName = "";
    let videoPosterFileRef = "";
    let videoPosterMimeType = "";

    if (type === "link") {
      normalizedUrl = normalizeUrl(rawUrl);
      sourceExternalId = sourceExternalId || normalizedUrl;
      const linkSource = linkSourceFor(normalizedUrl);
      sourceKind = linkSource.kind;
      sourceIdentifier = linkSource.identifier;
      sourceLabel = linkSource.label;
      linkContentType = linkContentTypeFor(normalizedUrl);
      itemTitle = linkMetadata && linkMetadata.title ? linkMetadata.title : null;
    } else if (type === "image") {
      assetFileName = fileOriginalName(uploadedFile, "imported-image");
      assetMimeType = mimeTypeForFileName(assetFileName);

      if (!assetMimeType) {
        throw new BadRequestError("image file must be jpg, png, webp, gif, or avif");
      }

      const dimensions = imageDimensionsForUploadedFile(uploadedFile, assetMimeType);
      imageWidth = dimensions.width;
      imageHeight = dimensions.height;
      sourceExternalId = sourceExternalId || imageExternalIdFor(now);
      sourceKind = "local";
      sourceIdentifier = "local";
      sourceLabel = "Local files";
      itemTitle = assetFileName;
    } else if (type === "pdf") {
      assetFileName = fileOriginalName(uploadedFile, "imported-document.pdf");
      assetMimeType = pdfMimeTypeForFile(uploadedFile, assetFileName);

      if (!assetMimeType) {
        throw new BadRequestError("pdf file must be application/pdf or end with .pdf");
      }

      sourceExternalId = sourceExternalId || pdfExternalIdFor(assetFileName, uploadedFile.size);
      sourceKind = "local";
      sourceIdentifier = "local";
      sourceLabel = "Local files";
      linkContentType = "pdf";
      itemTitle = assetFileName;
      storedItemType = "link";
    } else if (type === "video") {
      assetFileName = fileOriginalName(uploadedFile, "imported-video.mp4");
      assetMimeType = videoMimeTypeForFile(uploadedFile, assetFileName);

      if (!assetMimeType) {
        throw new BadRequestError("video file must be mp4, webm, or quicktime");
      }

      assertMaxFileSize(uploadedFile, videoUploadMaxBytes, "video file");
      videoPosterFileName = fileOriginalName(uploadedPosterFile, "poster.webp");
      videoPosterMimeType = posterMimeTypeForFile(uploadedPosterFile, videoPosterFileName);

      if (!videoPosterMimeType) {
        throw new BadRequestError("poster_file must be jpg, png, or webp");
      }

      assertMaxFileSize(uploadedPosterFile, videoPosterMaxBytes, "poster_file");
      videoMetadata = videoMetadataFromBody(body);
      sourceExternalId = sourceExternalId || videoExternalIdFor(assetFileName, uploadedFile.size, videoMetadata.durationMs, videoMetadata.width, videoMetadata.height);
      sourceKind = "local";
      sourceIdentifier = "local";
      sourceLabel = "Local files";
      itemTitle = assetFileName;
    } else {
      sourceExternalId = sourceExternalId || externalIdFor(now);
    }

    if (sourceKind === "url") {
      sourceId = urlSourceIdFor(workspaceId, sourceIdentifier);
      txApp
        .db()
        .newQuery(
          `
            INSERT OR IGNORE INTO sources (
              id,
              workspace_id,
              kind,
              identifier,
              label,
              default_privacy_level,
              created_at
            ) VALUES (
              {:sourceId},
              {:workspaceId},
              {:sourceKind},
              {:sourceIdentifier},
              {:sourceLabel},
              'personal',
              {:now}
            )
          `,
        )
        .bind({ sourceId, workspaceId, sourceKind, sourceIdentifier, sourceLabel, now })
        .execute();
    } else {
      const sourceRows = queryAll(
        txApp,
        `
          SELECT id
          FROM sources
          WHERE workspace_id = {:workspaceId}
            AND kind = {:sourceKind}
            AND identifier = {:sourceIdentifier}
          LIMIT 1
        `,
        { id: "" },
        { workspaceId, sourceKind, sourceIdentifier },
      );

      if (sourceRows.length > 0) {
        sourceId = sourceRows[0].id;
      } else {
        sourceId = sourceIdFor(workspaceId, sourceKind, sourceIdentifier);
        txApp
          .db()
          .newQuery(
            `
              INSERT INTO sources (
                id,
                workspace_id,
                kind,
                identifier,
                label,
                default_privacy_level,
                created_at
              ) VALUES (
                {:sourceId},
                {:workspaceId},
                {:sourceKind},
                {:sourceIdentifier},
                {:sourceLabel},
                'personal',
                {:now}
              )
            `,
          )
          .bind({ sourceId, workspaceId, sourceKind, sourceIdentifier, sourceLabel, now })
          .execute();
      }
    }

    const existingRows = queryAll(
      txApp,
      `
        SELECT i.id, i.type, i.status, i.created_at AS createdAt
        FROM items i
        WHERE i.workspace_id = {:workspaceId}
          AND i.source_id = {:sourceId}
          AND i.source_external_id = {:sourceExternalId}
        LIMIT 1
      `,
      {
        id: "",
        type: "",
        status: "",
        createdAt: "",
      },
      { workspaceId, sourceId, sourceExternalId },
    );

    if (existingRows.length > 0) {
      const existing = existingRows[0];

      if (type === "note") {
        const noteRows = queryAll(
          txApp,
          `
            SELECT body
            FROM items_note
            WHERE item_id = {:itemId}
            LIMIT 1
          `,
          { body: "" },
          { itemId: existing.id },
        );

        if (noteRows.length === 0 || rowString(noteRows[0].body) !== noteBody) {
          throw new BadRequestError("capture already exists with different body");
        }
      }

      if (type === "link" || type === "pdf" || type === "video") {
        result = {
          created: false,
          item: {
            id: existing.id,
            workspaceId,
            type: storedItemType,
            status: existing.status,
            sourceId,
            sourceExternalId,
            createdAt: existing.createdAt,
            updatedAt: existing.createdAt,
          },
          event: null,
        };
        return;
      }

      if (type === "image") {
        if (imageWidth !== null && imageHeight !== null) {
          txApp
            .db()
            .newQuery(
              `
                UPDATE items_image
                SET
                  width = COALESCE(width, {:imageWidth}),
                  height = COALESCE(height, {:imageHeight})
                WHERE item_id = {:itemId}
              `,
            )
            .bind({ itemId: existing.id, imageWidth, imageHeight })
            .execute();
        }

        storeThumbnailAsset(txApp, workspaceId, existing.id, uploadedThumbnailFile, now);

        result = {
          created: false,
          item: {
            id: existing.id,
            workspaceId,
            type,
            status: existing.status,
            sourceId,
            sourceExternalId,
            createdAt: existing.createdAt,
            updatedAt: existing.createdAt,
          },
          event: null,
        };
        return;
      }

      txApp
        .db()
        .newQuery(
          `
            UPDATE items
            SET update_count = update_count + 1,
                updated_at = {:now}
            WHERE workspace_id = {:workspaceId}
              AND id = {:itemId}
          `,
        )
        .bind({ workspaceId, itemId: existing.id, now })
        .execute();

      result = {
        created: false,
        item: {
          id: existing.id,
          workspaceId,
          type,
          status: existing.status,
          sourceId,
          sourceExternalId,
          createdAt: existing.createdAt,
          updatedAt: now,
        },
        event: null,
      };
      return;
    }

    const itemId = itemIdFor(type, now);
    const eventId = eventIdFor(itemId, now);
    if (type === "image" || type === "pdf" || type === "video") {
      assetFileRef = imageFileKeyFor(workspaceId, itemId, assetFileName);
      uploadStoredFile(txApp, uploadedFile, assetFileRef, storedFileRefs);

      if (type === "video") {
        videoPosterFileRef = videoPosterFileKeyFor(workspaceId, itemId, videoPosterFileName);
        uploadStoredFile(txApp, uploadedPosterFile, videoPosterFileRef, storedFileRefs);
      }
    }

    const metadataBody = {
      source_id: sourceId,
      source_external_id: sourceExternalId,
      capture_type: type === "link" ? "url" : type === "image" ? "local_image" : type === "pdf" ? "local_pdf" : type === "video" ? "local_video" : "manual_note",
    };

    if (type === "image" || type === "pdf" || type === "video") {
      metadataBody.file_ref = assetFileRef;
      metadataBody.mime_type = assetMimeType;
      metadataBody.original_name = assetFileName;
      metadataBody.size = uploadedFile.size;
      if (type === "image" && imageWidth !== null && imageHeight !== null) {
        metadataBody.width = imageWidth;
        metadataBody.height = imageHeight;
      }
      if (type === "video" && videoMetadata) {
        metadataBody.width = videoMetadata.width;
        metadataBody.height = videoMetadata.height;
        metadataBody.duration_ms = videoMetadata.durationMs;
        metadataBody.aspect_ratio = videoMetadata.aspectRatio;
        metadataBody.poster_file_ref = videoPosterFileRef;
      }
    }

    const metadata = JSON.stringify(metadataBody);

    txApp
      .db()
      .newQuery(
        `
          INSERT INTO items (
            id,
            workspace_id,
            type,
            status,
            title,
            description,
            summary,
            source_id,
            source_external_id,
            privacy_level,
            rights_status,
            rights_note,
            rights_reviewed_at,
            update_count,
            created_at,
            updated_at
          ) VALUES (
            {:itemId},
            {:workspaceId},
            {:storedItemType},
            'active',
            {:itemTitle},
            NULL,
            NULL,
            {:sourceId},
            {:sourceExternalId},
            NULL,
            'unknown',
            NULL,
            NULL,
            0,
            {:now},
            {:now}
          )
        `,
      )
      .bind({ itemId, workspaceId, storedItemType, itemTitle, sourceId, sourceExternalId, now })
      .execute();

    if (type === "note") {
      txApp
        .db()
        .newQuery(
          `
            INSERT INTO items_note (
              item_id,
              body,
              format
            ) VALUES (
              {:itemId},
              {:noteBody},
              'plain'
            )
          `,
        )
        .bind({ itemId, noteBody })
        .execute();
    } else if (type === "link" || type === "pdf") {
      txApp
        .db()
        .newQuery(
          `
            INSERT INTO items_link (
              item_id,
              url,
              og_metadata,
              content_type,
              fetched_at
            ) VALUES (
              {:itemId},
              {:normalizedUrl},
              {:ogMetadata},
              {:linkContentType},
              {:now}
            )
          `,
        )
        .bind({
          itemId,
          normalizedUrl: type === "pdf" ? assetFileRef : normalizedUrl,
          ogMetadata: JSON.stringify(
            type === "pdf"
              ? { file_ref: assetFileRef, original_name: assetFileName }
              : linkMetadata || { url: normalizedUrl },
          ),
          linkContentType,
          now,
        })
        .execute();
    } else if (type === "image") {
      txApp
        .db()
        .newQuery(
          `
            INSERT INTO items_image (
              item_id,
              file_ref,
              mime_type,
              width,
              height,
              dominant_colors,
              perceptual_hash,
              ocr_text
            ) VALUES (
              {:itemId},
              {:assetFileRef},
              {:assetMimeType},
              {:imageWidth},
              {:imageHeight},
              NULL,
              NULL,
              NULL
            )
          `,
        )
        .bind({ itemId, assetFileRef, assetMimeType, imageWidth, imageHeight })
        .execute();

      storeThumbnailAsset(txApp, workspaceId, itemId, uploadedThumbnailFile, now);
    } else if (type === "video" && videoMetadata) {
      txApp
        .db()
        .newQuery(
          `
            INSERT INTO items_video (
              item_id,
              file_ref,
              mime_type,
              width,
              height,
              duration_ms,
              poster_file_ref,
              dominant_colors,
              perceptual_hash,
              aspect_ratio
            ) VALUES (
              {:itemId},
              {:assetFileRef},
              {:assetMimeType},
              {:videoWidth},
              {:videoHeight},
              {:durationMs},
              {:posterFileRef},
              {:dominantColors},
              {:perceptualHash},
              {:aspectRatio}
            )
          `,
        )
        .bind({
          itemId,
          assetFileRef,
          assetMimeType,
          videoWidth: videoMetadata.width,
          videoHeight: videoMetadata.height,
          durationMs: videoMetadata.durationMs,
          posterFileRef: videoPosterFileRef,
          dominantColors: videoMetadata.dominantColors,
          perceptualHash: videoMetadata.perceptualHash,
          aspectRatio: videoMetadata.aspectRatio,
        })
        .execute();
    }

    if (type === "pdf") {
      txApp
        .db()
        .newQuery(
          `
            INSERT INTO item_assets (
              id,
              workspace_id,
              item_id,
              role,
              file_ref,
              original_name,
              mime_type,
              size_bytes,
              created_at
            ) VALUES (
              {:assetId},
              {:workspaceId},
              {:itemId},
              'source_file',
              {:assetFileRef},
              {:assetFileName},
              {:assetMimeType},
              {:assetSize},
              {:now}
            )
          `,
        )
        .bind({
          assetId: `asset:${itemId}:source_file`,
          workspaceId,
          itemId,
          assetFileRef,
          assetFileName,
          assetMimeType,
          assetSize: uploadedFile.size,
          now,
        })
        .execute();
    } else if (type === "video") {
      txApp
        .db()
        .newQuery(
          `
            INSERT INTO item_assets (
              id,
              workspace_id,
              item_id,
              role,
              file_ref,
              original_name,
              mime_type,
              size_bytes,
              created_at
            ) VALUES (
              {:sourceAssetId},
              {:workspaceId},
              {:itemId},
              'source_file',
              {:assetFileRef},
              {:assetFileName},
              {:assetMimeType},
              {:assetSize},
              {:now}
            ), (
              {:posterAssetId},
              {:workspaceId},
              {:itemId},
              'thumbnail',
              {:posterFileRef},
              {:posterFileName},
              {:posterMimeType},
              {:posterSize},
              {:now}
            )
          `,
        )
        .bind({
          sourceAssetId: "asset:" + itemId + ":source_file",
          posterAssetId: "asset:" + itemId + ":thumbnail",
          workspaceId,
          itemId,
          assetFileRef,
          assetFileName,
          assetMimeType,
          assetSize: uploadedFile.size,
          posterFileRef: videoPosterFileRef,
          posterFileName: videoPosterFileName,
          posterMimeType: videoPosterMimeType,
          posterSize: uploadedPosterFile.size,
          now,
        })
        .execute();
    }

    txApp
      .db()
      .newQuery(
        `
          INSERT INTO item_events (
            id,
            workspace_id,
            item_id,
            event_type,
            actor,
            metadata,
            created_at
          ) VALUES (
            {:eventId},
            {:workspaceId},
            {:itemId},
            'imported',
            {:actor},
            {:metadata},
            {:now}
          )
        `,
      )
      .bind({ eventId, workspaceId, itemId, actor, metadata, now })
      .execute();

    result = {
      created: true,
      item: {
        id: itemId,
        workspaceId,
        type: storedItemType,
        status: "active",
        sourceId,
        sourceExternalId,
        createdAt: now,
        updatedAt: now,
      },
      event: {
        id: eventId,
        eventType: "imported",
        createdAt: now,
      },
    };
    });
  } catch (error) {
    cleanupStoredFiles(e.app, storedFileRefs);
    throw error;
  }

  return e.json(200, result);
}, $apis.bodyLimit(250 * 1024 * 1024 + 10 * 1024 * 1024 + 1024 * 1024));
