/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/vita/item-retirement", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    item_id: "",
    replacement_id: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const itemId = requiredString(body.item_id, "item_id");
  const replacementId = requiredString(body.replacement_id, "replacement_id");
  const actor = optionalString(body.actor) || "system";

  if (itemId === replacementId) {
    throw new BadRequestError("retirement replacement requires two distinct items");
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

  function canRetire(status) {
    return ["inbox", "triaged", "active", "archived"].includes(status);
  }

  function queryAll(app, sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  function idSuffix() {
    return Math.random().toString(36).slice(2, 10);
  }

  function relationshipIdFor(timestamp) {
    return `retired-by:${timestamp}:${idSuffix()}`;
  }

  function eventIdFor(relationshipId, itemId, kind) {
    return `event:${relationshipId}:${itemId}:${kind}`;
  }

  let result = null;

  e.app.runInTransaction((txApp) => {
    const typeRows = queryAll(
      txApp,
      `
        SELECT type, is_symmetric AS isSymmetric
        FROM relationship_types
        WHERE type = 'retired_by'
        LIMIT 1
      `,
      {
        type: "",
        isSymmetric: 0,
      },
      {},
    );

    if (typeRows.length === 0) {
      throw new BadRequestError("retired_by relationship type is not registered");
    }

    if (typeRows[0].isSymmetric !== 0) {
      throw new BadRequestError("retired_by relationship type must be directional");
    }

    const itemRows = queryAll(
      txApp,
      `
        SELECT id, status
        FROM items
        WHERE workspace_id = {:workspaceId}
          AND id = {:itemId}
        LIMIT 1
      `,
      {
        id: "",
        status: "",
      },
      { workspaceId, itemId },
    );

    if (itemRows.length === 0) {
      throw new NotFoundError("item not found");
    }

    const replacementRows = queryAll(
      txApp,
      `
        SELECT id, status
        FROM items
        WHERE workspace_id = {:workspaceId}
          AND id = {:replacementId}
        LIMIT 1
      `,
      {
        id: "",
        status: "",
      },
      { workspaceId, replacementId },
    );

    if (replacementRows.length === 0) {
      throw new NotFoundError("replacement item not found");
    }

    const currentStatus = itemRows[0].status;
    if (!canRetire(currentStatus)) {
      throw new BadRequestError(`unsupported retirement from status: ${currentStatus}`);
    }

    if (replacementRows[0].status === "retired") {
      throw new BadRequestError("retired items cannot be used as replacements in this slice");
    }

    const existingRetirementRows = queryAll(
      txApp,
      `
        SELECT id
        FROM relationships
        WHERE workspace_id = {:workspaceId}
          AND from_id = {:itemId}
          AND type = 'retired_by'
        LIMIT 1
      `,
      { id: "" },
      { workspaceId, itemId },
    );

    if (existingRetirementRows.length > 0) {
      throw new BadRequestError("item already has a retired_by relationship");
    }

    const now = new Date().toISOString();
    const relationshipId = relationshipIdFor(now);
    const statusEventId = eventIdFor(relationshipId, itemId, "status");
    const itemRelationshipEventId = eventIdFor(relationshipId, itemId, "outgoing");
    const replacementRelationshipEventId = eventIdFor(
      relationshipId,
      replacementId,
      "incoming",
    );
    const statusMetadata = JSON.stringify({
      from_status: currentStatus,
      to_status: "retired",
      replacement_id: replacementId,
      relationship_id: relationshipId,
    });
    const itemRelationshipMetadata = JSON.stringify({
      relationship_id: relationshipId,
      from_id: itemId,
      to_id: replacementId,
      type: "retired_by",
      direction: "outgoing",
    });
    const replacementRelationshipMetadata = JSON.stringify({
      relationship_id: relationshipId,
      from_id: itemId,
      to_id: replacementId,
      type: "retired_by",
      direction: "incoming",
    });

    txApp
      .db()
      .newQuery(
        `
          UPDATE items
          SET status = 'retired',
              updated_at = {:now}
          WHERE workspace_id = {:workspaceId}
            AND id = {:itemId}
        `,
      )
      .bind({ workspaceId, itemId, now })
      .execute();

    txApp
      .db()
      .newQuery(
        `
          INSERT INTO relationships (
            id,
            workspace_id,
            from_id,
            to_id,
            type,
            weight,
            metadata,
            note,
            asserted_by,
            created_at
          ) VALUES (
            {:relationshipId},
            {:workspaceId},
            {:itemId},
            {:replacementId},
            'retired_by',
            NULL,
            NULL,
            NULL,
            'human',
            {:now}
          )
        `,
      )
      .bind({ relationshipId, workspaceId, itemId, replacementId, now })
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
          ) VALUES
            (
              {:statusEventId},
              {:workspaceId},
              {:itemId},
              'status_changed',
              {:actor},
              {:statusMetadata},
              {:now}
            ),
            (
              {:itemRelationshipEventId},
              {:workspaceId},
              {:itemId},
              'relationship_added',
              {:actor},
              {:itemRelationshipMetadata},
              {:now}
            ),
            (
              {:replacementRelationshipEventId},
              {:workspaceId},
              {:replacementId},
              'relationship_added',
              {:actor},
              {:replacementRelationshipMetadata},
              {:now}
            )
        `,
      )
      .bind({
        statusEventId,
        itemRelationshipEventId,
        replacementRelationshipEventId,
        workspaceId,
        itemId,
        replacementId,
        actor,
        statusMetadata,
        itemRelationshipMetadata,
        replacementRelationshipMetadata,
        now,
      })
      .execute();

    result = {
      item: {
        id: itemId,
        workspaceId,
        status: "retired",
        updatedAt: now,
      },
      relationship: {
        id: relationshipId,
        workspaceId,
        fromId: itemId,
        toId: replacementId,
        type: "retired_by",
        assertedBy: "human",
        createdAt: now,
      },
      events: [
        {
          id: statusEventId,
          itemId,
          eventType: "status_changed",
          createdAt: now,
        },
        {
          id: itemRelationshipEventId,
          itemId,
          eventType: "relationship_added",
          createdAt: now,
        },
        {
          id: replacementRelationshipEventId,
          itemId: replacementId,
          eventType: "relationship_added",
          createdAt: now,
        },
      ],
    };
  });

  return e.json(200, result);
});
