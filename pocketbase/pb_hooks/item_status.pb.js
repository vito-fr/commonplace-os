/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/vita/item-status", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    item_id: "",
    next_status: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const itemId = requiredString(body.item_id, "item_id");
  const nextStatus = requiredString(body.next_status, "next_status");
  const actor = optionalString(body.actor) || "system";

  if (!isKnownStatus(nextStatus)) {
    throw new BadRequestError("next_status is invalid");
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

  function isKnownStatus(status) {
    return ["active", "archived"].includes(status);
  }

  function canTransition(fromStatus, toStatus) {
    return (
      (fromStatus === "active" && toStatus === "archived") ||
      (fromStatus === "archived" && toStatus === "active")
    );
  }

  function queryAll(app, sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  function eventIdFor(itemId, timestamp) {
    const suffix = Math.random().toString(36).slice(2, 10);
    return `status:${itemId}:${timestamp}:${suffix}`;
  }

  let result = null;

  e.app.runInTransaction((txApp) => {
    const rows = queryAll(
      txApp,
      `
        SELECT id, workspace_id AS workspaceId, status
        FROM items
        WHERE workspace_id = {:workspaceId}
          AND id = {:itemId}
        LIMIT 1
      `,
      {
        id: "",
        workspaceId: "",
        status: "",
      },
      { workspaceId, itemId },
    );

    if (rows.length === 0) {
      throw new NotFoundError("item not found");
    }

    const currentStatus = rows[0].status;
    if (currentStatus === nextStatus) {
      throw new BadRequestError("item already has requested status");
    }

    if (!canTransition(currentStatus, nextStatus)) {
      throw new BadRequestError(`unsupported status transition: ${currentStatus} -> ${nextStatus}`);
    }

    const now = new Date().toISOString();
    const eventId = eventIdFor(itemId, now);
    const metadata = JSON.stringify({
      from_status: currentStatus,
      to_status: nextStatus,
    });

    txApp
      .db()
      .newQuery(
        `
          UPDATE items
          SET status = {:nextStatus},
              updated_at = {:now}
          WHERE workspace_id = {:workspaceId}
            AND id = {:itemId}
        `,
      )
      .bind({ workspaceId, itemId, nextStatus, now })
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
            'status_changed',
            {:actor},
            {:metadata},
            {:now}
          )
        `,
      )
      .bind({ eventId, workspaceId, itemId, actor, metadata, now })
      .execute();

    result = {
      item: {
        id: itemId,
        workspaceId,
        status: nextStatus,
        updatedAt: now,
      },
      event: {
        id: eventId,
        eventType: "status_changed",
        createdAt: now,
      },
    };
  });

  return e.json(200, result);
});
