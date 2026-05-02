/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/vita/collection-options", (e) => {
  const query = e.request.url.query();
  const workspaceId = query.get("workspace_id");
  const itemId = query.get("item_id") || "";

  if (!workspaceId) {
    throw new BadRequestError("workspace_id is required");
  }

  const rows = arrayOf(
    new DynamicModel({
      id: "",
      name: "",
      description: nullString(),
      alreadyAttached: 0,
    }),
  );

  e.app
    .db()
    .newQuery(
      `
        SELECT
          c.id,
          c.name,
          c.description,
          EXISTS (
            SELECT 1
            FROM collection_items ci
            WHERE ci.collection_id = c.id
              AND ci.item_id = {:itemId}
          ) AS alreadyAttached
        FROM collections c
        WHERE c.workspace_id = {:workspaceId}
        ORDER BY c.name ASC, c.id ASC
      `,
    )
    .bind({ workspaceId, itemId })
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

  const collections = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    collections.push({
      id: row.id,
      name: row.name,
      description: nullableString(row.description),
      alreadyAttached: row.alreadyAttached === 1,
    });
  }

  return e.json(200, { collections });
});

routerAdd("GET", "/api/vita/collection-detail", (e) => {
  const query = e.request.url.query();
  const workspaceId = query.get("workspace_id");
  const collectionId = query.get("collection_id");

  if (!workspaceId) {
    throw new BadRequestError("workspace_id is required");
  }

  if (!collectionId) {
    throw new BadRequestError("collection_id is required");
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

  function queryAll(sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    e.app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  function formatKindSummary(items) {
    const order = ["image", "caption", "note", "link", "campaign"];
    const counts = {};

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      counts[item.type] = (counts[item.type] || 0) + 1;
    }

    const parts = [];
    for (let index = 0; index < order.length; index += 1) {
      const type = order[index];
      const count = counts[type] || 0;
      if (count > 0) {
        parts.push(`${count} ${count === 1 ? type : `${type}s`}`);
      }
    }

    return parts.join(" · ") || "no pieces";
  }

  const collectionRows = queryAll(
    `
      SELECT
        id,
        workspace_id AS workspaceId,
        name,
        description,
        created_at AS createdAt
      FROM collections
      WHERE workspace_id = {:workspaceId}
        AND id = {:collectionId}
      LIMIT 1
    `,
    {
      id: "",
      workspaceId: "",
      name: "",
      description: nullString(),
      createdAt: "",
    },
    { workspaceId, collectionId },
  );

  if (collectionRows.length === 0) {
    throw new NotFoundError("collection not found");
  }

  const itemRows = queryAll(
    `
      SELECT
        i.id,
        i.type,
        i.status,
        i.title,
        i.description,
        i.summary,
        i.created_at AS createdAt,
        i.updated_at AS updatedAt,
        COALESCE(s.kind, 'manual') AS sourceKind,
        s.label AS sourceLabel,
        s.identifier AS sourceIdentifier,
        ci.added_at AS addedAt,
        img.file_ref AS imageUrl,
        CASE WHEN img.width IS NULL THEN NULL ELSE CAST(img.width AS TEXT) END AS imageWidth,
        CASE WHEN img.height IS NULL THEN NULL ELSE CAST(img.height AS TEXT) END AS imageHeight,
        caption.body AS captionText,
        note.body AS noteParagraph,
        link.url AS url,
        link.og_metadata AS ogMetadata,
        campaign.phase AS campaignPhase,
        campaign.brief AS campaignBrief
      FROM collection_items ci
      INNER JOIN collections c
        ON c.id = ci.collection_id
      INNER JOIN items i
        ON i.id = ci.item_id
        AND i.workspace_id = c.workspace_id
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
      LEFT JOIN campaign_profiles campaign
        ON campaign.item_id = i.id
      WHERE c.workspace_id = {:workspaceId}
        AND c.id = {:collectionId}
      ORDER BY ci.added_at ASC, ci.item_id ASC
    `,
    {
      id: "",
      type: "",
      status: "",
      title: nullString(),
      description: nullString(),
      summary: nullString(),
      createdAt: "",
      updatedAt: "",
      sourceKind: "",
      sourceLabel: nullString(),
      sourceIdentifier: nullString(),
      addedAt: "",
      imageUrl: nullString(),
      imageWidth: nullString(),
      imageHeight: nullString(),
      captionText: nullString(),
      noteParagraph: nullString(),
      url: nullString(),
      ogMetadata: nullString(),
      campaignPhase: nullString(),
      campaignBrief: nullString(),
    },
    { workspaceId, collectionId },
  );

  const items = [];
  let lastUpdatedAt = collectionRows[0].createdAt;

  for (let index = 0; index < itemRows.length; index += 1) {
    const row = itemRows[index];
    const openGraph = parseOpenGraph(row.ogMetadata);
    const sourceLabel =
      nullableString(row.sourceLabel) ||
      nullableString(row.sourceIdentifier) ||
      nullableString(row.sourceKind) ||
      "manual";

    if (row.updatedAt > lastUpdatedAt) {
      lastUpdatedAt = row.updatedAt;
    }

    items.push({
      id: row.id,
      type: row.type,
      status: row.status,
      title: nullableString(row.title),
      description: nullableString(row.description),
      summary: nullableString(row.summary),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      addedAt: row.addedAt,
      source: {
        kind: nullableString(row.sourceKind) || "manual",
        label: sourceLabel,
      },
      imageUrl: nullableString(row.imageUrl),
      imageWidth: nullableNumber(row.imageWidth),
      imageHeight: nullableNumber(row.imageHeight),
      captionText: nullableString(row.captionText),
      noteParagraph: nullableString(row.noteParagraph),
      url: nullableString(row.url),
      ogImageUrl: openGraph.image,
      ogTitle: openGraph.title,
      campaignPhase: nullableString(row.campaignPhase),
      campaignBrief: nullableString(row.campaignBrief),
    });
  }

  const collection = collectionRows[0];
  return e.json(200, {
    collection: {
      id: collection.id,
      workspaceId: collection.workspaceId,
      name: collection.name,
      description: nullableString(collection.description),
      createdAt: collection.createdAt,
      lastUpdatedAt,
      pieceCount: items.length,
      kindSummary: formatKindSummary(items),
      items,
    },
  });
});

routerAdd("POST", "/api/vita/item-collection", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    item_id: "",
    collection_id: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const itemId = requiredString(body.item_id, "item_id");
  const collectionId = requiredString(body.collection_id, "collection_id");
  const actor = optionalString(body.actor) || "system";

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

  function nullableString(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valid")) {
      return value.valid ? value.string : null;
    }

    return value;
  }

  function queryAll(app, sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  function eventIdFor(itemId, collectionId, timestamp) {
    const suffix = Math.random().toString(36).slice(2, 10);
    return `collection:${itemId}:${collectionId}:${timestamp}:${suffix}`;
  }

  let result = null;

  e.app.runInTransaction((txApp) => {
    const itemRows = queryAll(
      txApp,
      `
        SELECT id
        FROM items
        WHERE workspace_id = {:workspaceId}
          AND id = {:itemId}
        LIMIT 1
      `,
      { id: "" },
      { workspaceId, itemId },
    );

    if (itemRows.length === 0) {
      throw new NotFoundError("item not found");
    }

    const collectionRows = queryAll(
      txApp,
      `
        SELECT id, name, description
        FROM collections
        WHERE workspace_id = {:workspaceId}
          AND id = {:collectionId}
        LIMIT 1
      `,
      {
        id: "",
        name: "",
        description: nullString(),
      },
      { workspaceId, collectionId },
    );

    if (collectionRows.length === 0) {
      throw new NotFoundError("collection not found");
    }

    const existingRows = queryAll(
      txApp,
      `
        SELECT collection_id AS collectionId
        FROM collection_items
        WHERE collection_id = {:collectionId}
          AND item_id = {:itemId}
        LIMIT 1
      `,
      { collectionId: "" },
      { collectionId, itemId },
    );

    if (existingRows.length > 0) {
      throw new BadRequestError("item is already in collection");
    }

    const now = new Date().toISOString();
    const collection = collectionRows[0];
    const eventId = eventIdFor(itemId, collectionId, now);
    const metadata = JSON.stringify({
      collection_id: collectionId,
      collection_name: collection.name,
    });

    txApp
      .db()
      .newQuery(
        `
          INSERT INTO collection_items (
            collection_id,
            item_id,
            added_at,
            added_by
          ) VALUES (
            {:collectionId},
            {:itemId},
            {:now},
            {:actor}
          )
        `,
      )
      .bind({ collectionId, itemId, now, actor })
      .execute();

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
            'collection_added',
            {:actor},
            {:metadata},
            {:now}
          )
        `,
      )
      .bind({ eventId, workspaceId, itemId, actor, metadata, now })
      .execute();

    result = {
      membership: {
        collectionId,
        itemId,
        addedAt: now,
        addedBy: actor,
        collection: {
          id: collection.id,
          name: collection.name,
          description: nullableString(collection.description),
        },
      },
      event: {
        id: eventId,
        eventType: "collection_added",
        createdAt: now,
      },
    };
  });

  return e.json(200, result);
});
