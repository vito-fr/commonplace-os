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
    return ["image", "caption", "note", "link"].includes(value);
  }

  function isKnownSource(value) {
    return ["pinterest", "arena", "url", "local", "ios_capture", "manual"].includes(value);
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
      captionText: nullString(),
      noteParagraph: nullString(),
      url: nullString(),
      ogMetadata: nullString(),
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
          caption.body AS captionText,
          note.body AS noteParagraph,
          link.url AS url,
          link.og_metadata AS ogMetadata,
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
        WHERE i.workspace_id = {:workspaceId}
          ${itemIdFilter}
          ${statusFilter}
          ${typeFilter}
          ${sourceFilter}
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

  const items = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const openGraph = parseOpenGraph(row.ogMetadata);

    items.push({
      id: row.id,
      type: row.type,
      status: row.status,
      source: row.source,
      usageCount: row.usageCount,
      collectionCount: row.collectionCount,
      title: nullableString(row.title),
      createdAt: row.createdAt,
      imageUrl: nullableString(row.imageUrl),
      captionText: nullableString(row.captionText),
      noteParagraph: nullableString(row.noteParagraph),
      url: nullableString(row.url),
      ogImageUrl: openGraph.image,
      ogTitle: openGraph.title,
      hasPendingAIAnnotations: row.hasPendingAIAnnotations === 1,
      rightsStatus: row.rightsStatus,
    });
  }

  return e.json(200, { items });
});
