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

routerAdd("GET", "/api/vita/collection-index", (e) => {
  const query = e.request.url.query();
  const workspaceId = query.get("workspace_id");

  if (!workspaceId) {
    throw new BadRequestError("workspace_id is required");
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

  function formatKindSummary(row) {
    const parts = [];
    const imageCount = Number(row.imageCount) || 0;
    const captionCount = Number(row.captionCount) || 0;
    const noteCount = Number(row.noteCount) || 0;
    const linkCount = Number(row.linkCount) || 0;

    if (imageCount > 0) {
      parts.push(`${imageCount} ${imageCount === 1 ? "image" : "images"}`);
    }

    if (captionCount > 0) {
      parts.push(`${captionCount} ${captionCount === 1 ? "caption" : "captions"}`);
    }

    if (noteCount > 0) {
      parts.push(`${noteCount} ${noteCount === 1 ? "note" : "notes"}`);
    }

    if (linkCount > 0) {
      parts.push(`${linkCount} ${linkCount === 1 ? "link" : "links"}`);
    }

    return parts.join(" · ") || "no pieces";
  }

  const rows = arrayOf(
    new DynamicModel({
      id: "",
      workspaceId: "",
      name: "",
      description: nullString(),
      createdAt: "",
      lastUpdatedAt: "",
      pieceCount: 0,
      imageCount: 0,
      captionCount: 0,
      noteCount: 0,
      linkCount: 0,
    }),
  );

  e.app
    .db()
    .newQuery(
      `
        SELECT
          c.id,
          c.workspace_id AS workspaceId,
          c.name,
          c.description,
          c.created_at AS createdAt,
          CASE
            WHEN MAX(i.updated_at) IS NOT NULL AND MAX(i.updated_at) > c.created_at THEN MAX(i.updated_at)
            ELSE c.created_at
          END AS lastUpdatedAt,
          COUNT(i.id) AS pieceCount,
          SUM(CASE WHEN i.type = 'image' THEN 1 ELSE 0 END) AS imageCount,
          SUM(CASE WHEN i.type = 'caption' THEN 1 ELSE 0 END) AS captionCount,
          SUM(CASE WHEN i.type = 'note' THEN 1 ELSE 0 END) AS noteCount,
          SUM(CASE WHEN i.type = 'link' THEN 1 ELSE 0 END) AS linkCount
        FROM collections c
        LEFT JOIN collection_items ci
          ON ci.collection_id = c.id
        LEFT JOIN items i
          ON i.id = ci.item_id
          AND i.workspace_id = c.workspace_id
        WHERE c.workspace_id = {:workspaceId}
        GROUP BY c.id, c.workspace_id, c.name, c.description, c.created_at
        ORDER BY lastUpdatedAt DESC, c.name ASC, c.id ASC
      `,
    )
    .bind({ workspaceId })
    .all(rows);

  const collections = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    collections.push({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      description: nullableString(row.description),
      createdAt: row.createdAt,
      lastUpdatedAt: row.lastUpdatedAt,
      pieceCount: row.pieceCount,
      kindSummary: formatKindSummary(row),
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
    const order = ["image", "caption", "note", "link"];
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
        link.og_metadata AS ogMetadata
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

routerAdd("POST", "/api/vita/collection-create", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    item_id: "",
    name: "",
    description: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const itemId = requiredString(body.item_id, "item_id");
  const name = requiredString(body.name, "name");
  const description = optionalString(body.description) || null;
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

  function idSuffix() {
    return Math.random().toString(36).slice(2, 10);
  }

  function collectionIdFor(timestamp) {
    return `collection:${timestamp}:${idSuffix()}`;
  }

  function eventIdFor(itemId, collectionId, timestamp) {
    return `collection:${itemId}:${collectionId}:${timestamp}:${idSuffix()}`;
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

    const now = new Date().toISOString();
    const collectionId = collectionIdFor(now);
    const eventId = eventIdFor(itemId, collectionId, now);
    const metadata = JSON.stringify({
      collection_id: collectionId,
      collection_name: name,
    });

    txApp
      .db()
      .newQuery(
        `
          INSERT INTO collections (
            id,
            workspace_id,
            name,
            description,
            created_at
          ) VALUES (
            {:collectionId},
            {:workspaceId},
            {:name},
            {:description},
            {:now}
          )
        `,
      )
      .bind({ collectionId, workspaceId, name, description, now })
      .execute();

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
      collection: {
        id: collectionId,
        workspaceId,
        name,
        description: nullableString(description),
        createdAt: now,
      },
      membership: {
        collectionId,
        itemId,
        addedAt: now,
        addedBy: actor,
        collection: {
          id: collectionId,
          name,
          description: nullableString(description),
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
