/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/vita/item-capture", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    type: "",
    body: "",
    url: "",
    source_external_id: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const type = requiredString(body.type, "type");
  const noteBody = optionalString(body.body);
  const rawUrl = optionalString(body.url);
  const actor = optionalString(body.actor) || "system";

  if (!["note", "link"].includes(type)) {
    throw new BadRequestError("capture type must be note or link");
  }

  if (type === "note" && !noteBody) {
    throw new BadRequestError("body is required");
  }

  if (type === "link" && !rawUrl) {
    throw new BadRequestError("url is required");
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

  function rowString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valid")) {
      return value.valid && typeof value.string === "string" ? value.string.trim() : "";
    }

    return String(value).trim();
  }

  function queryAll(app, sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  function idSuffix() {
    return Math.random().toString(36).slice(2, 10);
  }

  function itemIdFor(itemType, timestamp) {
    if (itemType === "link") {
      return `capture:link:${timestamp}:${idSuffix()}`;
    }

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

  function urlSourceIdFor(workspaceId, identifier) {
    return `source:url:${workspaceId}:${identifier}`;
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();

    if (!/^https?:\/\//i.test(trimmed)) {
      throw new BadRequestError("url must start with http:// or https://");
    }

    return trimmed.replace(/#.*$/, "").replace(/\/$/, "");
  }

  function urlIdentifierFor(value) {
    const match = value.match(/^https?:\/\/([^/?#]+)/i);

    if (!match || !match[1]) {
      throw new BadRequestError("url host is required");
    }

    return match[1].toLowerCase();
  }

  function linkContentTypeFor(value) {
    const lower = value.toLowerCase();

    if (lower.endsWith(".pdf")) {
      return "pdf";
    }

    if (lower.includes("youtube.com/") || lower.includes("youtu.be/") || lower.includes("vimeo.com/")) {
      return "video";
    }

    return "unknown";
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

    const now = new Date().toISOString();
    let sourceId = null;
    let sourceExternalId = optionalString(body.source_external_id);
    let normalizedUrl = "";
    let linkContentType = null;
    let sourceKind = "manual";
    let sourceIdentifier = "manual";
    let sourceLabel = "Manual entries";

    if (type === "link") {
      normalizedUrl = normalizeUrl(rawUrl);
      sourceExternalId = sourceExternalId || normalizedUrl;
      sourceKind = "url";
      sourceIdentifier = urlIdentifierFor(normalizedUrl);
      sourceLabel = sourceIdentifier;
      linkContentType = linkContentTypeFor(normalizedUrl);
    } else {
      sourceExternalId = sourceExternalId || externalIdFor(now);
    }

    if (sourceKind === "url") {
      sourceId = urlSourceIdFor(workspaceId, sourceIdentifier);
      txApp
        .db()
        .newQuery(
          `
            INSERT OR IGNORE INTO sources (
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
              {:sourceKind},
              {:sourceIdentifier},
              {:sourceLabel},
              'personal',
              {:now}
            )
          `,
        )
        .bind({ sourceId, workspaceId, sourceKind, sourceIdentifier, sourceLabel, now })
        .execute();
    } else {
      const sourceRows = queryAll(
        txApp,
        `
          SELECT id
          FROM sources
          WHERE workspace_id = {:workspaceId}
            AND kind = {:sourceKind}
            AND identifier = {:sourceIdentifier}
          LIMIT 1
        `,
        { id: "" },
        { workspaceId, sourceKind, sourceIdentifier },
      );

      if (sourceRows.length > 0) {
        sourceId = sourceRows[0].id;
      } else {
        sourceId = manualSourceIdFor(workspaceId);
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
                {:sourceKind},
                {:sourceIdentifier},
                {:sourceLabel},
                'personal',
                {:now}
              )
            `,
          )
          .bind({ sourceId, workspaceId, sourceKind, sourceIdentifier, sourceLabel, now })
          .execute();
      }
    }

    const existingRows = queryAll(
      txApp,
      `
        SELECT i.id, i.type, i.status, i.created_at AS createdAt
        FROM items i
        WHERE i.workspace_id = {:workspaceId}
          AND i.source_id = {:sourceId}
          AND i.source_external_id = {:sourceExternalId}
        LIMIT 1
      `,
      {
        id: "",
        type: "",
        status: "",
        createdAt: "",
      },
      { workspaceId, sourceId, sourceExternalId },
    );

    if (existingRows.length > 0) {
      const existing = existingRows[0];

      if (type === "note") {
        const noteRows = queryAll(
          txApp,
          `
            SELECT body
            FROM items_note
            WHERE item_id = {:itemId}
            LIMIT 1
          `,
          { body: "" },
          { itemId: existing.id },
        );

        if (noteRows.length === 0 || rowString(noteRows[0].body) !== noteBody) {
          throw new BadRequestError("capture already exists with different body");
        }
      }

      if (type === "link") {
        result = {
          created: false,
          item: {
            id: existing.id,
            workspaceId,
            type,
            status: existing.status,
            sourceId,
            sourceExternalId,
            createdAt: existing.createdAt,
            updatedAt: existing.createdAt,
          },
          event: null,
        };
        return;
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
          type,
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

    const itemId = itemIdFor(type, now);
    const eventId = eventIdFor(itemId, now);
    const metadata = JSON.stringify({
      source_id: sourceId,
      source_external_id: sourceExternalId,
      capture_type: type === "link" ? "url" : "manual_note",
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
            {:type},
            'active',
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
      .bind({ itemId, workspaceId, type, sourceId, sourceExternalId, now })
      .execute();

    if (type === "note") {
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
    } else {
      txApp
        .db()
        .newQuery(
          `
            INSERT INTO items_link (
              item_id,
              url,
              og_metadata,
              content_type,
              fetched_at
            ) VALUES (
              {:itemId},
              {:normalizedUrl},
              {:ogMetadata},
              {:linkContentType},
              {:now}
            )
          `,
        )
        .bind({
          itemId,
          normalizedUrl,
          ogMetadata: JSON.stringify({ url: normalizedUrl }),
          linkContentType,
          now,
        })
        .execute();
    }

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
          type,
          status: "active",
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
