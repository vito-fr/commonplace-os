/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/vita/item-delete", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    item_id: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const itemId = requiredString(body.item_id, "item_id");

  function requiredString(value, fieldName) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new BadRequestError(`${fieldName} is required`);
    }

    return value.trim();
  }

  let result = null;

  e.app.runInTransaction((txApp) => {
    const itemRows = arrayOf(new DynamicModel({ id: "" }));
    txApp
      .db()
      .newQuery(
        `
          SELECT id
          FROM items
          WHERE workspace_id = {:workspaceId}
            AND id = {:itemId}
          LIMIT 1
        `,
      )
      .bind({ workspaceId, itemId })
      .all(itemRows);

    if (itemRows.length === 0) {
      throw new NotFoundError("item not found");
    }

    const cascade = {
      relationships: 0,
      itemTags: 0,
      collectionItems: 0,
      aiAnnotations: 0,
      itemEvents: 0,
      embeddings: 0,
    };

    const cascadeQueries = [
      {
        key: "relationships",
        sql: `
          DELETE FROM relationships
          WHERE workspace_id = {:workspaceId}
            AND (from_id = {:itemId} OR to_id = {:itemId})
        `,
      },
      {
        key: "itemTags",
        sql: `
          DELETE FROM item_tags
          WHERE workspace_id = {:workspaceId}
            AND item_id = {:itemId}
        `,
      },
      {
        key: "collectionItems",
        sql: `
          DELETE FROM collection_items
          WHERE item_id = {:itemId}
        `,
      },
      {
        key: "itemAssets",
        sql: `
          DELETE FROM item_assets
          WHERE workspace_id = {:workspaceId}
            AND item_id = {:itemId}
        `,
      },
      {
        key: "aiAnnotations",
        sql: `
          DELETE FROM ai_annotations
          WHERE workspace_id = {:workspaceId}
            AND item_id = {:itemId}
        `,
      },
      {
        key: "itemEvents",
        sql: `
          DELETE FROM item_events
          WHERE workspace_id = {:workspaceId}
            AND item_id = {:itemId}
        `,
      },
      {
        key: "embeddings",
        sql: `
          DELETE FROM embeddings
          WHERE item_id = {:itemId}
        `,
      },
    ];

    for (let index = 0; index < cascadeQueries.length; index += 1) {
      const { key, sql } = cascadeQueries[index];
      const deleteResult = txApp
        .db()
        .newQuery(sql)
        .bind({ workspaceId, itemId })
        .execute();
      cascade[key] = countAffected(deleteResult);
    }

    const extensionTables = [
      "items_image",
      "items_caption",
      "items_note",
      "items_link",
      "items_video",
    ];

    for (let index = 0; index < extensionTables.length; index += 1) {
      const table = extensionTables[index];
      txApp
        .db()
        .newQuery(`DELETE FROM ${table} WHERE item_id = {:itemId}`)
        .bind({ itemId })
        .execute();
    }

    txApp
      .db()
      .newQuery(
        `
          DELETE FROM items
          WHERE workspace_id = {:workspaceId}
            AND id = {:itemId}
        `,
      )
      .bind({ workspaceId, itemId })
      .execute();

    result = {
      itemId,
      cascade,
    };
  });

  return e.json(200, result);
});

function countAffected(deleteResult) {
  if (!deleteResult) {
    return 0;
  }

  if (typeof deleteResult.rowsAffected === "function") {
    return Number(deleteResult.rowsAffected()) || 0;
  }

  if (typeof deleteResult.rowsAffected === "number") {
    return deleteResult.rowsAffected;
  }

  return 0;
}
