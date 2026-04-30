/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/vita/item-capture", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    type: "",
    body: "",
    source_external_id: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const type = requiredString(body.type, "type");
  const noteBody = requiredString(body.body, "body");
  const sourceExternalId = optionalString(body.source_external_id) || externalIdFor(new Date().toISOString());
  const actor = optionalString(body.actor) || "system";

  if (type !== "note") {
    throw new BadRequestError("only note capture is supported in this slice");
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

  function idSuffix() {
    return Math.random().toString(36).slice(2, 10);
  }

  function itemIdFor(timestamp) {
    return `capture:note:${timestamp}:${idSuffix()}`;
  }

  function externalIdFor(timestamp) {
    return `manual:note:${timestamp}:${idSuffix()}`;
  }

  function eventIdFor(itemId, timestamp) {
    return `capture:event:${itemId}:${timestamp}:${idSuffix()}`;
  }

  function manualSourceIdFor(workspaceId) {
    return `source:manual:${workspaceId}`;
  }

  let result = null;

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

    let sourceId = null;
    const sourceRows = queryAll(
      txApp,
      `
        SELECT id
        FROM sources
        WHERE workspace_id = {:workspaceId}
          AND kind = 'manual'
          AND identifier = 'manual'
        LIMIT 1
      `,
      { id: "" },
      { workspaceId },
    );

    if (sourceRows.length > 0) {
      sourceId = sourceRows[0].id;
    } else {
      sourceId = manualSourceIdFor(workspaceId);
      const now = new Date().toISOString();
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
              'manual',
              'manual',
              'Manual entries',
              'personal',
              {:now}
            )
          `,
        )
        .bind({ sourceId, workspaceId, now })
        .execute();
    }

    const existingRows = queryAll(
      txApp,
      `
        SELECT i.id, i.status, i.created_at AS createdAt, note.body AS noteBody
        FROM items i
        LEFT JOIN items_note note
          ON note.item_id = i.id
        WHERE i.workspace_id = {:workspaceId}
          AND i.source_id = {:sourceId}
          AND i.source_external_id = {:sourceExternalId}
        LIMIT 1
      `,
      {
        id: "",
        status: "",
        createdAt: "",
        noteBody: "",
      },
      { workspaceId, sourceId, sourceExternalId },
    );

    if (existingRows.length > 0) {
      const now = new Date().toISOString();
      const existing = existingRows[0];
      if (existing.noteBody !== noteBody) {
        throw new BadRequestError("capture already exists with different body");
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
          type: "note",
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

    const now = new Date().toISOString();
    const itemId = itemIdFor(now);
    const eventId = eventIdFor(itemId, now);
    const metadata = JSON.stringify({
      source_id: sourceId,
      source_external_id: sourceExternalId,
      capture_type: "manual_note",
    });

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
            'note',
            'inbox',
            NULL,
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
      .bind({ itemId, workspaceId, sourceId, sourceExternalId, now })
      .execute();

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
        type: "note",
        status: "inbox",
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

  return e.json(200, result);
});
