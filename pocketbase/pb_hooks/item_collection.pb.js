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
