/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/vita/item-cards", (e) => {
  const query = e.request.url.query();
  const workspaceId = query.get("workspace_id");

  if (!workspaceId) {
    throw new BadRequestError("workspace_id is required");
  }

  const status = normalizedFilter(query.get("status"));
  const type = normalizedFilter(query.get("type"));
  const source = normalizedFilter(query.get("source"));
  const format = normalizedFilter(query.get("format"));
  const collection = normalizedFilter(query.get("collection"));
  const textQuery = normalizedTextQuery(query.get("q"));
  const rawItemIds = query.get("item_ids");
  const itemIds = rawItemIds
    ? rawItemIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : [];
  const params = { workspaceId };
  let itemIdFilter = "";
  let statusFilter = "";
  let typeFilter = "";
  let sourceFilter = "";
  let formatFilter = "";
  let collectionFilter = "";
  let textQueryFilter = "";
  let orderBy = "ORDER BY i.updated_at DESC, i.id ASC";

  if (textQuery.length > 120) {
    throw new BadRequestError("q is too long");
  }

  if (status) {
    if (!isKnownStatus(status)) {
      throw new BadRequestError("status filter is invalid");
    }

    params.status = status;
    statusFilter = "AND i.status = {:status}";
  }

  if (type) {
    if (!isKnownType(type)) {
      throw new BadRequestError("type filter is invalid");
    }

    params.type = type;
    typeFilter = "AND i.type = {:type}";
  }

  if (source) {
    if (!isKnownSource(source)) {
      throw new BadRequestError("source filter is invalid");
    }

    params.source = source;
    sourceFilter = "AND COALESCE(s.kind, 'manual') = {:source}";
  }

  if (format) {
    if (!isKnownFormat(format)) {
      throw new BadRequestError("format filter is invalid");
    }

    params.format = format;
    formatFilter =
      format === "website"
        ? "AND i.type = 'link' AND COALESCE(link.content_type, 'unknown') IN ('website', 'unknown')"
        : format === "video"
          ? "AND (i.type = 'video' OR (i.type = 'link' AND link.content_type = {:format}))"
          : "AND i.type = 'link' AND link.content_type = {:format}";
  }

  if (collection) {
    if (collection === "none") {
      collectionFilter = `
        AND NOT EXISTS (
          SELECT 1
          FROM collection_items collectionFilterItem
          INNER JOIN collections collectionFilterCollection
            ON collectionFilterCollection.id = collectionFilterItem.collection_id
            AND collectionFilterCollection.workspace_id = i.workspace_id
          WHERE collectionFilterItem.item_id = i.id
        )
      `;
    } else {
      params.collection = collection;
      collectionFilter = `
        AND EXISTS (
          SELECT 1
          FROM collection_items collectionFilterItem
          INNER JOIN collections collectionFilterCollection
            ON collectionFilterCollection.id = collectionFilterItem.collection_id
            AND collectionFilterCollection.workspace_id = i.workspace_id
          WHERE collectionFilterItem.item_id = i.id
            AND collectionFilterItem.collection_id = {:collection}
        )
      `;
    }
  }

  if (textQuery) {
    params.textQueryPattern = `%${escapeLike(textQuery.toLowerCase())}%`;
    textQueryFilter = `
      AND LOWER(
        COALESCE(i.title, '') || ' ' ||
        COALESCE(i.description, '') || ' ' ||
        COALESCE(i.summary, '') || ' ' ||
        COALESCE(caption.body, '') || ' ' ||
        COALESCE(note.body, '') || ' ' ||
        COALESCE(link.url, '') || ' ' ||
        COALESCE(link.og_metadata, '')
      ) LIKE {:textQueryPattern} ESCAPE char(92)
    `;
  }

  if (itemIds.length > 0) {
    const placeholders = [];
    itemIds.forEach((id, index) => {
      const key = `itemId${index}`;
      placeholders.push(`{:${key}}`);
      params[key] = id;
    });

    itemIdFilter = `AND i.id IN (${placeholders.join(", ")})`;
    params.itemIdsOrder = `,${itemIds.join(",")},`;
    orderBy = "ORDER BY instr({:itemIdsOrder}, ',' || i.id || ',')";
  }

  function normalizedFilter(value) {
    if (typeof value !== "string") {
      return "";
    }

    const normalized = value.trim();
    return normalized === "all" ? "" : normalized;
  }

  function normalizedTextQuery(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim().replace(/\s+/g, " ");
  }

  function escapeLike(value) {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  function isKnownStatus(value) {
    return ["active", "archived"].includes(value);
  }

  function isKnownType(value) {
    return ["image", "caption", "note", "link", "video"].includes(value);
  }

  function isKnownSource(value) {
    return ["pinterest", "arena", "url", "local", "ios_capture", "manual"].includes(value);
  }

  function isKnownFormat(value) {
    return ["pdf", "video", "website"].includes(value);
  }

  const rows = arrayOf(
    new DynamicModel({
      id: "",
      type: "",
      status: "",
      source: "",
      usageCount: 0,
      collectionCount: 0,
      title: nullString(),
      createdAt: "",
      imageUrl: nullString(),
      imageWidth: nullString(),
      imageHeight: nullString(),
      captionText: nullString(),
      noteParagraph: nullString(),
      url: nullString(),
      linkContentType: nullString(),
      ogMetadata: nullString(),
      videoFileRef: nullString(),
      videoMimeType: nullString(),
      videoWidth: nullString(),
      videoHeight: nullString(),
      videoDurationMs: nullString(),
      videoPosterFileRef: nullString(),
      videoAspectRatio: nullString(),
      assetFileRef: nullString(),
      assetMimeType: nullString(),
      thumbnailFileRef: nullString(),
      hasPendingAIAnnotations: 0,
      rightsStatus: "",
    }),
  );

  e.app
    .db()
    .newQuery(
      `
        SELECT
          i.id,
          i.type,
          i.status,
          COALESCE(s.kind, 'manual') AS source,
          i.created_at AS createdAt,
          (
            SELECT COUNT(1)
            FROM relationships r
            WHERE r.workspace_id = i.workspace_id
              AND r.from_id = i.id
              AND r.type = 'used_in'
          ) AS usageCount,
          (
            SELECT COUNT(1)
            FROM collection_items ci
            INNER JOIN collections c
              ON c.id = ci.collection_id
              AND c.workspace_id = i.workspace_id
            WHERE ci.item_id = i.id
          ) AS collectionCount,
          i.title AS title,
          img.file_ref AS imageUrl,
          CASE WHEN img.width IS NULL THEN NULL ELSE CAST(img.width AS TEXT) END AS imageWidth,
          CASE WHEN img.height IS NULL THEN NULL ELSE CAST(img.height AS TEXT) END AS imageHeight,
          caption.body AS captionText,
          note.body AS noteParagraph,
          link.url AS url,
          link.content_type AS linkContentType,
          link.og_metadata AS ogMetadata,
          video.file_ref AS videoFileRef,
          video.mime_type AS videoMimeType,
          CASE WHEN video.width IS NULL THEN NULL ELSE CAST(video.width AS TEXT) END AS videoWidth,
          CASE WHEN video.height IS NULL THEN NULL ELSE CAST(video.height AS TEXT) END AS videoHeight,
          CASE WHEN video.duration_ms IS NULL THEN NULL ELSE CAST(video.duration_ms AS TEXT) END AS videoDurationMs,
          video.poster_file_ref AS videoPosterFileRef,
          CASE WHEN video.aspect_ratio IS NULL THEN NULL ELSE CAST(video.aspect_ratio AS TEXT) END AS videoAspectRatio,
          asset.file_ref AS assetFileRef,
          asset.mime_type AS assetMimeType,
          thumb.file_ref AS thumbnailFileRef,
          EXISTS (
            SELECT 1
            FROM ai_annotations annotation
            WHERE annotation.workspace_id = i.workspace_id
              AND annotation.item_id = i.id
              AND annotation.review_status = 'pending'
          ) AS hasPendingAIAnnotations,
          i.rights_status AS rightsStatus
        FROM items i
        LEFT JOIN sources s
          ON s.id = i.source_id
          AND s.workspace_id = i.workspace_id
        LEFT JOIN items_image img
          ON img.item_id = i.id
        LEFT JOIN items_caption caption
          ON caption.item_id = i.id
        LEFT JOIN items_note note
          ON note.item_id = i.id
        LEFT JOIN items_link link
          ON link.item_id = i.id
        LEFT JOIN items_video video
          ON video.item_id = i.id
        LEFT JOIN item_assets asset
          ON asset.item_id = i.id
          AND asset.workspace_id = i.workspace_id
          AND asset.role = 'source_file'
        LEFT JOIN item_assets thumb
          ON thumb.item_id = i.id
          AND thumb.workspace_id = i.workspace_id
          AND thumb.role = 'thumbnail'
        WHERE i.workspace_id = {:workspaceId}
          ${itemIdFilter}
          ${statusFilter}
          ${typeFilter}
          ${sourceFilter}
          ${formatFilter}
          ${collectionFilter}
          ${textQueryFilter}
        ${orderBy}
      `,
    )
    .bind(params)
    .all(rows);

  function nullableString(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valid")) {
      return value.valid ? value.string : null;
    }

    return value;
  }

  function parseOpenGraph(value) {
    const metadata = nullableString(value);
    if (!metadata) {
      return { image: null, title: null };
    }

    try {
      const parsed = JSON.parse(metadata);
      return {
        image: typeof parsed.image === "string" ? parsed.image : null,
        title: typeof parsed.title === "string" ? parsed.title : null,
      };
    } catch {
      return { image: null, title: null };
    }
  }

  function nullableNumber(value) {
    const text = nullableString(value);
    if (text === null || text === "") {
      return null;
    }

    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function aspectRatioFor(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    return width / height;
  }

  function isDirectImageUrl(value) {
    const url = nullableString(value);
    if (!url) {
      return false;
    }

    const lower = url.toLowerCase().replace(/[?#].*$/, "");
    return (
      lower.includes("://i.pinimg.com/") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".avif")
    );
  }

  const items = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const openGraph = parseOpenGraph(row.ogMetadata);
    const rowUrl = nullableString(row.url);
    const imageUrl = nullableString(row.imageUrl);
    const linkContentType = nullableString(row.linkContentType);
    const videoFileRef = nullableString(row.videoFileRef);
    const videoMimeType = nullableString(row.videoMimeType);
    const videoWidth = nullableNumber(row.videoWidth);
    const videoHeight = nullableNumber(row.videoHeight);
    const videoDurationMs = nullableNumber(row.videoDurationMs);
    const videoPosterFileRef = nullableString(row.videoPosterFileRef);
    const videoAspectRatio = nullableNumber(row.videoAspectRatio);
    const assetFileUrl = videoFileRef || nullableString(row.assetFileRef);
    const assetMimeType = videoMimeType || nullableString(row.assetMimeType);
    const imageWidth = row.type === "video" ? videoWidth : nullableNumber(row.imageWidth);
    const imageHeight = row.type === "video" ? videoHeight : nullableNumber(row.imageHeight);
    const thumbnailFileRef = nullableString(row.thumbnailFileRef);
    const aspectRatio = row.type === "video" ? videoAspectRatio || aspectRatioFor(videoWidth, videoHeight) : aspectRatioFor(imageWidth, imageHeight);
    const fallbackImageUrl = !openGraph.image && isDirectImageUrl(rowUrl) ? rowUrl : null;
    const ogImageUrl = openGraph.image || fallbackImageUrl;
    const videoPosterUrl = row.type === "video" ? videoPosterFileRef || thumbnailFileRef : linkContentType === "video" ? ogImageUrl : null;
    const previewUrl = imageUrl || videoPosterUrl || ogImageUrl || (linkContentType === "pdf" ? assetFileUrl : null);

    items.push({
      id: row.id,
      type: row.type,
      status: row.status,
      source: row.source,
      usageCount: row.usageCount,
      collectionCount: row.collectionCount,
      title: nullableString(row.title),
      createdAt: row.createdAt,
      imageUrl,
      captionText: nullableString(row.captionText),
      noteParagraph: nullableString(row.noteParagraph),
      url: rowUrl,
      linkContentType,
      videoDurationMs,
      ogImageUrl,
      ogTitle: openGraph.title,
      assetFileUrl,
      assetMimeType,
      previewUrl,
      thumbnailUrl: thumbnailFileRef || videoPosterFileRef || imageUrl || ogImageUrl,
      videoPosterUrl,
      imageWidth,
      imageHeight,
      aspectRatio,
      mediaPreview: {
        previewUrl,
        imageUrl,
        thumbnailUrl: thumbnailFileRef || videoPosterFileRef || imageUrl || ogImageUrl,
        ogImageUrl,
        videoPosterUrl,
        assetFileUrl,
        assetMimeType,
        width: imageWidth,
        height: imageHeight,
        aspectRatio,
      },
      hasPendingAIAnnotations: row.hasPendingAIAnnotations === 1,
      rightsStatus: row.rightsStatus,
    });
  }

  return e.json(200, { items });
});
