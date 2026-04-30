/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/vita/item-relationship", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    from_id: "",
    to_id: "",
    type: "",
    note: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const fromId = requiredString(body.from_id, "from_id");
  const toId = requiredString(body.to_id, "to_id");
  const type = requiredString(body.type, "type");
  const note = optionalString(body.note) || null;
  const actor = optionalString(body.actor) || "system";

  if (type !== "references") {
    throw new BadRequestError("only references relationships are supported in this slice");
  }

  if (fromId === toId) {
    throw new BadRequestError("relationships require two distinct items");
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

  function queryAll(app, sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  function relationshipIdFor(timestamp) {
    const suffix = Math.random().toString(36).slice(2, 10);
    return `rel:${timestamp}:${suffix}`;
  }

  function eventIdFor(relationshipId, itemId, direction) {
    return `event:${relationshipId}:${itemId}:${direction}`;
  }

  let result = null;

  e.app.runInTransaction((txApp) => {
    const typeRows = queryAll(
      txApp,
      `
        SELECT type, is_symmetric AS isSymmetric
        FROM relationship_types
        WHERE type = {:type}
        LIMIT 1
      `,
      {
        type: "",
        isSymmetric: 0,
      },
      { type },
    );

    if (typeRows.length === 0) {
      throw new BadRequestError("relationship type is not registered");
    }

    if (typeRows[0].isSymmetric !== 0) {
      throw new BadRequestError("symmetric relationship creation is not supported in this slice");
    }

    const endpointRows = queryAll(
      txApp,
      `
        SELECT id
        FROM items
        WHERE workspace_id = {:workspaceId}
          AND id IN ({:fromId}, {:toId})
      `,
      { id: "" },
      { workspaceId, fromId, toId },
    );

    if (endpointRows.length !== 2) {
      throw new NotFoundError("relationship endpoint item not found");
    }

    const duplicateRows = queryAll(
      txApp,
      `
        SELECT id
        FROM relationships
        WHERE workspace_id = {:workspaceId}
          AND from_id = {:fromId}
          AND to_id = {:toId}
          AND type = {:type}
        LIMIT 1
      `,
      { id: "" },
      { workspaceId, fromId, toId, type },
    );

    if (duplicateRows.length > 0) {
      throw new BadRequestError("relationship already exists");
    }

    const now = new Date().toISOString();
    const relationshipId = relationshipIdFor(now);
    const fromEventId = eventIdFor(relationshipId, fromId, "outgoing");
    const toEventId = eventIdFor(relationshipId, toId, "incoming");
    const fromMetadata = JSON.stringify({
      relationship_id: relationshipId,
      from_id: fromId,
      to_id: toId,
      type,
      direction: "outgoing",
    });
    const toMetadata = JSON.stringify({
      relationship_id: relationshipId,
      from_id: fromId,
      to_id: toId,
      type,
      direction: "incoming",
    });

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
            {:fromId},
            {:toId},
            {:type},
            NULL,
            NULL,
            {:note},
            'human',
            {:now}
          )
        `,
      )
      .bind({ relationshipId, workspaceId, fromId, toId, type, note, now })
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
              {:fromEventId},
              {:workspaceId},
              {:fromId},
              'relationship_added',
              {:actor},
              {:fromMetadata},
              {:now}
            ),
            (
              {:toEventId},
              {:workspaceId},
              {:toId},
              'relationship_added',
              {:actor},
              {:toMetadata},
              {:now}
            )
        `,
      )
      .bind({
        fromEventId,
        toEventId,
        workspaceId,
        fromId,
        toId,
        actor,
        fromMetadata,
        toMetadata,
        now,
      })
      .execute();

    result = {
      relationship: {
        id: relationshipId,
        workspaceId,
        fromId,
        toId,
        type,
        note,
        assertedBy: "human",
        createdAt: now,
      },
      events: [
        {
          id: fromEventId,
          itemId: fromId,
          eventType: "relationship_added",
          createdAt: now,
        },
        {
          id: toEventId,
          itemId: toId,
          eventType: "relationship_added",
          createdAt: now,
        },
      ],
    };
  });

  return e.json(200, result);
});
