/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/vita/import-arena", (e) => {
  const { createArenaApiClient } = require(__hooks + "/lib/arena_api_client.js");
  const { mapArenaConnectableToItemDraft } = require(__hooks + "/lib/arena_block_mapper.js");

  const body = new DynamicModel({
      workspace_id: "",
      channel: "",
      depth: 1,
      actor: "",
    });
    e.bindBody(body);

    const workspaceId = requiredString(body.workspace_id, "workspace_id");
    const channelSlug = requiredString(body.channel, "channel");
    const depth = nonNegativeInteger(body.depth, 1, "depth");
    const actor = optionalString(body.actor) || "subagent:import";
    const apiKey = optionalString($os.getenv("ARENA_API_KEY"));

    if (!localImportRequest(e.request)) {
      return e.json(403, { error: "Are.na import is only available from localhost" });
    }

    let channel;
    const client = createArenaApiClient({ apiKey });

    try {
      channel = client.getChannel(channelSlug);
    } catch (error) {
      return e.json(arenaFailureStatus(error), arenaFailureBody(error, apiKey));
    }

    const now = new Date().toISOString();
    const sourceId = ensureArenaSource(e.app, workspaceId, now);
    const collection = ensureArenaCollection(e.app, workspaceId, channel, now);
    const existingItems = existingArenaItems(e.app, workspaceId, sourceId);
    const summary = emptyImportSummary(workspaceId, channel, collection.id, sourceId, depth);

    try {
      importArenaChannel(e.app, {
        actor,
        client,
        collection,
        depthRemaining: depth,
        existingItems,
        sourceId,
        summary,
        visitedChannelIds: {},
        workspaceId,
      });
    } catch (error) {
      return e.json(arenaFailureStatus(error), arenaFailureBody(error, apiKey));
    }

    return e.json(200, summary);

  function ensureArenaSource(app, workspaceId, now) {
    const workspaceRows = queryAll(
      app,
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

    const sourceRows = queryAll(
      app,
      `
        SELECT id
        FROM sources
        WHERE workspace_id = {:workspaceId}
          AND kind = 'arena'
          AND identifier = 'global'
        LIMIT 1
      `,
      { id: "" },
      { workspaceId },
    );

    if (sourceRows.length > 0) {
      return sourceRows[0].id;
    }

    const sourceId = "source:arena:" + safePathSegment(workspaceId) + ":global";
    app
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
            'arena',
            'global',
            'Are.na',
            'personal',
            {:now}
          )
        `,
      )
      .bind({ sourceId, workspaceId, now })
      .execute();

    return sourceId;
  }

  function ensureArenaCollection(app, workspaceId, channel, now) {
    const channelId = requiredString(channel && channel.id != null ? String(channel.id) : channel && channel.slug, "channel id");
    const slug = optionalString(channel && channel.slug) || null;
    const collectionId = "collection:arena:" + safePathSegment(workspaceId) + ":" + safePathSegment(channelId);
    const rows = queryAll(
      app,
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

    if (rows.length > 0) {
      return {
        id: rows[0].id,
        name: rows[0].name,
        description: nullableString(rows[0].description),
        arenaChannelId: channelId,
        slug,
        created: false,
      };
    }

    const name = optionalString(channel && channel.title) || slug || "Are.na channel";
    const description = markdownValue(channel && channel.description);
    app
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

    return { id: collectionId, name, description, arenaChannelId: channelId, slug, created: true };
  }

  function existingArenaItems(app, workspaceId, sourceId) {
    const rows = queryAll(
      app,
      `
        SELECT
          i.id,
          i.source_external_id AS sourceExternalId,
          i.type,
          i.title,
          i.description,
          i.update_count AS updateCount,
          img.mime_type AS imageMimeType,
          CASE WHEN img.width IS NULL THEN NULL ELSE CAST(img.width AS TEXT) END AS imageWidth,
          CASE WHEN img.height IS NULL THEN NULL ELSE CAST(img.height AS TEXT) END AS imageHeight,
          note.body AS noteBody,
          note.format AS noteFormat,
          link.url AS linkUrl,
          link.content_type AS linkContentType,
          link.og_metadata AS linkOgMetadata
        FROM items i
        LEFT JOIN items_image img
          ON img.item_id = i.id
        LEFT JOIN items_note note
          ON note.item_id = i.id
        LEFT JOIN items_link link
          ON link.item_id = i.id
        WHERE i.workspace_id = {:workspaceId}
          AND i.source_id = {:sourceId}
      `,
      {
        id: "",
        sourceExternalId: "",
        type: "",
        title: nullString(),
        description: nullString(),
        updateCount: 0,
        imageMimeType: nullString(),
        imageWidth: nullString(),
        imageHeight: nullString(),
        noteBody: nullString(),
        noteFormat: nullString(),
        linkUrl: nullString(),
        linkContentType: nullString(),
        linkOgMetadata: nullString(),
      },
      { workspaceId, sourceId },
    );
    const index = {};

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      index[row.sourceExternalId] = {
        id: row.id,
        sourceExternalId: row.sourceExternalId,
        type: row.type,
        title: nullableString(row.title),
        description: nullableString(row.description),
        updateCount: Number(row.updateCount) || 0,
        imageMimeType: nullableString(row.imageMimeType),
        imageWidth: nullableNumber(row.imageWidth),
        imageHeight: nullableNumber(row.imageHeight),
        noteBody: nullableString(row.noteBody),
        noteFormat: nullableString(row.noteFormat),
        linkUrl: nullableString(row.linkUrl),
        linkContentType: nullableString(row.linkContentType),
        linkOgMetadata: nullableString(row.linkOgMetadata),
      };
    }

    return index;
  }

  function importArenaChannel(app, { actor, client, collection, depthRemaining, existingItems, sourceId, summary, visitedChannelIds, workspaceId }) {
    const channelKey = channelVisitedKey(collection);
    if (channelKey) {
      visitedChannelIds[channelKey] = true;
    }

    const contents = client.getChannelContents(channelHandle(collection), { per: 100, sort: "position_desc" });
    for (let index = 0; index < contents.length; index += 1) {
      const draft = mapArenaConnectableToItemDraft(contents[index]);
      processArenaDraft(app, {
        actor,
        client,
        collection,
        depthRemaining,
        draft,
        existingItems,
        position: index,
        sourceId,
        summary,
        visitedChannelIds,
        workspaceId,
      });
    }
  }

  function processArenaDraft(app, { actor, client, collection, depthRemaining, draft, existingItems, position, sourceId, summary, visitedChannelIds, workspaceId }) {
    recordArenaDraft(summary, draft);

    if (draft.itemType === "collection") {
      importNestedCollectionDraft(app, {
        actor,
        client,
        collection,
        depthRemaining,
        draft,
        existingItems,
        position,
        sourceId,
        summary,
        visitedChannelIds,
        workspaceId,
      });
      return;
    }

    const existing = existingItems[draft.sourceExternalId] || null;

    try {
      if (existing) {
        importExistingDraft(app, {
          actor,
          collection,
          draft,
          existing,
          sourceId,
          summary,
          workspaceId,
        });
        return;
      }

      existingItems[draft.sourceExternalId] = importNewDraft(app, {
        actor,
        collection,
        draft,
        sourceId,
        summary,
        workspaceId,
      });
    } catch (error) {
      summary.items_skipped += 1;
      summary.errors.push({
        source_external_id: draft.sourceExternalId,
        block_type: draft.blockType,
        error: error && error.message ? error.message : String(error),
      });
      console.warn("Are.na import skipped block " + draft.sourceExternalId, error);
    }
  }

  function importNestedCollectionDraft(app, { actor, client, collection, depthRemaining, draft, existingItems, position, sourceId, summary, visitedChannelIds, workspaceId }) {
    if (depthRemaining <= 0) {
      summary.sub_collections_skipped += 1;
      summary.warnings.push({
        source_external_id: draft.sourceExternalId,
        block_type: draft.blockType,
        warning: "nested channel skipped because depth limit was reached",
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const childCollection = ensureArenaCollection(app, workspaceId, draft.collection, now);

      if (childCollection.created) {
        summary.sub_collections_created += 1;
      } else {
        summary.sub_collections_skipped += 1;
      }

      if (childCollection.id === collection.id) {
        summary.warnings.push({
          source_external_id: draft.sourceExternalId,
          block_type: draft.blockType,
          warning: "nested channel self-reference skipped",
        });
        return;
      }

      ensureCollectionRelationship(app, {
        actor,
        childCollection,
        parentCollection: collection,
        position,
        summary,
        workspaceId,
        now,
      });

      const childKey = channelVisitedKey(childCollection);
      if (childKey && visitedChannelIds[childKey]) {
        summary.warnings.push({
          source_external_id: draft.sourceExternalId,
          block_type: draft.blockType,
          warning: "nested channel already visited; relationship kept without recursing",
        });
        return;
      }

      importArenaChannel(app, {
        actor,
        client,
        collection: childCollection,
        depthRemaining: depthRemaining - 1,
        existingItems,
        sourceId,
        summary,
        visitedChannelIds,
        workspaceId,
      });
    } catch (error) {
      summary.errors.push({
        source_external_id: draft.sourceExternalId,
        block_type: draft.blockType,
        error: error && error.message ? error.message : String(error),
      });
      console.warn("Are.na import skipped nested channel " + draft.sourceExternalId, error);
    }
  }

  function recordArenaDraft(summary, draft) {
    summary.blocks_seen += 1;
    summary.by_block_type[draft.blockType] = (summary.by_block_type[draft.blockType] || 0) + 1;
    summary.by_import_type[importTypeForDraft(draft)] = (summary.by_import_type[importTypeForDraft(draft)] || 0) + 1;

    for (let warningIndex = 0; warningIndex < draft.warnings.length; warningIndex += 1) {
      summary.warnings.push({
        source_external_id: draft.sourceExternalId,
        block_type: draft.blockType,
        warning: draft.warnings[warningIndex],
      });
    }
  }

  function importTypeForDraft(draft) {
    return draft.itemType === "collection" ? "nested_collection" : draft.itemType;
  }

  function ensureCollectionRelationship(app, { actor, childCollection, parentCollection, position, summary, workspaceId, now }) {
    const relationshipId = collectionRelationshipIdFor(workspaceId, parentCollection.id, childCollection.id);
    const result = app
      .db()
      .newQuery(
        `
          INSERT OR IGNORE INTO collection_relationships (
            id,
            workspace_id,
            parent_collection_id,
            child_collection_id,
            position,
            added_at,
            added_by
          ) VALUES (
            {:relationshipId},
            {:workspaceId},
            {:parentCollectionId},
            {:childCollectionId},
            {:position},
            {:now},
            {:actor}
          )
        `,
      )
      .bind({
        relationshipId,
        workspaceId,
        parentCollectionId: parentCollection.id,
        childCollectionId: childCollection.id,
        position: Number.isInteger(position) ? position : 0,
        now,
        actor,
      })
      .execute();

    if (countAffected(result) > 0) {
      summary.collection_relationships_created += 1;
    } else {
      summary.collection_relationships_skipped += 1;
    }
  }

  function channelHandle(collection) {
    return requiredString(collection.slug || collection.arenaChannelId, "channel handle");
  }

  function channelVisitedKey(collection) {
    return optionalString(collection && collection.arenaChannelId) || optionalString(collection && collection.slug) || optionalString(collection && collection.id);
  }

  function collectionRelationshipIdFor(workspaceId, parentCollectionId, childCollectionId) {
    return "collection-rel:arena:" + safePathSegment(workspaceId) + ":" + safePathSegment(parentCollectionId) + ":" + safePathSegment(childCollectionId);
  }

  function existingItemFromDraft(itemId, draft) {
    return {
      id: itemId,
      sourceExternalId: draft.sourceExternalId,
      type: draft.itemType,
      title: draft.item.title,
      description: draft.item.description,
      updateCount: 0,
      imageMimeType: draft.image ? draft.image.mimeType : null,
      imageWidth: draft.image ? draft.image.width : null,
      imageHeight: draft.image ? draft.image.height : null,
      noteBody: draft.note ? draft.note.body : null,
      noteFormat: draft.note ? draft.note.format : null,
      linkUrl: draft.link ? draft.link.url : null,
      linkContentType: draft.link ? draft.link.contentType : null,
      linkOgMetadata: draft.link ? JSON.stringify(draft.link.ogMetadata || { url: draft.link.url }) : null,
    };
  }

  function importExistingDraft(app, { actor, collection, draft, existing, sourceId, summary, workspaceId }) {
    const now = new Date().toISOString();
    const changedFields = changedFieldsForDraft(existing, draft);
    const membershipCreated = ensureCollectionMembership(app, {
      actor,
      collection,
      itemId: existing.id,
      metadata: {
        arena_block_id: draft.arenaId,
        arena_block_type: draft.blockType,
        source_id: sourceId,
        source_external_id: draft.sourceExternalId,
      },
      now,
      summary,
      workspaceId,
    });

    if (changedFields.length === 0) {
      summary.items_skipped += 1;
      return;
    }

    app.runInTransaction((txApp) => {
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

      insertItemEvent(txApp, {
        actor,
        eventType: "imported",
        itemId: existing.id,
        metadata: {
          arena_block_id: draft.arenaId,
          arena_block_type: draft.blockType,
          changed_fields: changedFields,
          collection_id: collection.id,
          collection_membership_created: membershipCreated,
          source_id: sourceId,
          source_external_id: draft.sourceExternalId,
        },
        now,
        workspaceId,
      });
    });

    summary.items_updated += 1;
  }

  function importNewDraft(app, { actor, collection, draft, sourceId, summary, workspaceId }) {
    const now = new Date().toISOString();
    const itemId = itemIdFor(workspaceId, draft.sourceExternalId);
    const storedFileRefs = [];
    let downloadedImage = null;

    if (draft.itemType === "image") {
      downloadedImage = downloadArenaImage(draft);
    }

    try {
      app.runInTransaction((txApp) => {
        let imageFileRef = null;

        if (draft.itemType === "image") {
          imageFileRef = imageFileKeyFor(workspaceId, itemId, downloadedImage.fileName);
          uploadStoredBytes(txApp, downloadedImage.bytes, imageFileRef, storedFileRefs);
        }

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
                {:itemType},
                'active',
                {:title},
                {:description},
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
          .bind({
            itemId,
            workspaceId,
            itemType: draft.itemType,
            title: draft.item.title,
            description: draft.item.description,
            sourceId,
            sourceExternalId: draft.sourceExternalId,
            now,
          })
          .execute();

        if (draft.itemType === "image") {
          insertImageExtension(txApp, { draft, imageFileRef, itemId });
        } else if (draft.itemType === "note") {
          insertNoteExtension(txApp, { draft, itemId });
        } else {
          insertLinkExtension(txApp, { draft, itemId, now });
        }

        insertItemEvent(txApp, {
          actor,
          eventType: "imported",
          itemId,
          metadata: {
            arena_block_id: draft.arenaId,
            arena_block_type: draft.blockType,
            collection_id: collection.id,
            source_id: sourceId,
            source_external_id: draft.sourceExternalId,
            fingerprint: draft.fingerprint,
          },
          now,
          workspaceId,
        });

        ensureCollectionMembership(txApp, {
          actor,
          collection,
          itemId,
          metadata: {
            arena_block_id: draft.arenaId,
            arena_block_type: draft.blockType,
            source_id: sourceId,
            source_external_id: draft.sourceExternalId,
          },
          now,
          summary,
          workspaceId,
        });
      });
    } catch (error) {
      cleanupStoredFiles(app, storedFileRefs);
      throw error;
    }

    summary.items_created += 1;
    return existingItemFromDraft(itemId, draft);
  }

  function insertImageExtension(app, { draft, imageFileRef, itemId }) {
    app
      .db()
      .newQuery(
        `
          INSERT INTO items_image (
            item_id,
            file_ref,
            mime_type,
            width,
            height,
            dominant_colors,
            perceptual_hash,
            ocr_text
          ) VALUES (
            {:itemId},
            {:fileRef},
            {:mimeType},
            {:width},
            {:height},
            NULL,
            NULL,
            NULL
          )
        `,
      )
      .bind({
        itemId,
        fileRef: imageFileRef,
        mimeType: draft.image.mimeType,
        width: draft.image.width,
        height: draft.image.height,
      })
      .execute();
  }

  function insertNoteExtension(app, { draft, itemId }) {
    app
      .db()
      .newQuery(
        `
          INSERT INTO items_note (
            item_id,
            body,
            format
          ) VALUES (
            {:itemId},
            {:body},
            'markdown'
          )
        `,
      )
      .bind({ itemId, body: draft.note.body })
      .execute();
  }

  function insertLinkExtension(app, { draft, itemId, now }) {
    app
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
            {:url},
            {:ogMetadata},
            {:contentType},
            {:now}
          )
        `,
      )
      .bind({
        itemId,
        url: draft.link.url,
        ogMetadata: JSON.stringify(draft.link.ogMetadata || { url: draft.link.url }),
        contentType: draft.link.contentType,
        now,
      })
      .execute();
  }

  function ensureCollectionMembership(app, { actor, collection, itemId, metadata, now, summary, workspaceId }) {
    const result = app
      .db()
      .newQuery(
        `
          INSERT OR IGNORE INTO collection_items (
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
      .bind({ collectionId: collection.id, itemId, now, actor })
      .execute();

    if (countAffected(result) === 0) {
      return false;
    }

    summary.collection_memberships_created += 1;
    insertItemEvent(app, {
      actor,
      eventType: "collection_added",
      itemId,
      metadata: {
        ...metadata,
        collection_id: collection.id,
        collection_name: collection.name,
      },
      now,
      workspaceId,
    });
    return true;
  }

  function insertItemEvent(app, { actor, eventType, itemId, metadata, now, workspaceId }) {
    const eventId = eventIdFor(eventType, itemId, now);
    app
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
            {:eventType},
            {:actor},
            {:metadata},
            {:now}
          )
        `,
      )
      .bind({ eventId, workspaceId, itemId, eventType, actor, metadata: JSON.stringify(metadata || {}), now })
      .execute();
  }

  function changedFieldsForDraft(existing, draft) {
    const changed = [];
    compareField(changed, "type", existing.type, draft.itemType);
    compareField(changed, "title", existing.title, draft.item.title);
    compareField(changed, "description", existing.description, draft.item.description);

    if (draft.itemType === "image") {
      compareField(changed, "items_image.mime_type", existing.imageMimeType, draft.image.mimeType);
      compareField(changed, "items_image.width", existing.imageWidth, draft.image.width);
      compareField(changed, "items_image.height", existing.imageHeight, draft.image.height);
    } else if (draft.itemType === "note") {
      compareField(changed, "items_note.body", existing.noteBody, draft.note.body);
      compareField(changed, "items_note.format", existing.noteFormat, draft.note.format);
    } else if (draft.itemType === "link") {
      compareField(changed, "items_link.url", existing.linkUrl, draft.link.url);
      compareField(changed, "items_link.content_type", existing.linkContentType, draft.link.contentType);
      compareField(changed, "items_link.og_metadata", normalizedJson(existing.linkOgMetadata), normalizedJson(draft.link.ogMetadata));
    }

    return changed;
  }

  function compareField(changed, field, previousValue, nextValue) {
    const previous = previousValue === null || previousValue === undefined ? "" : String(previousValue);
    const next = nextValue === null || nextValue === undefined ? "" : String(nextValue);
    if (previous !== next) {
      changed.push(field);
    }
  }

  function normalizedJson(value) {
    if (value === null || value === undefined || value === "") {
      return "";
    }

    if (typeof value !== "string") {
      return JSON.stringify(value);
    }

    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }

  function downloadArenaImage(draft) {
    const response = $http.send({
      method: "GET",
      url: draft.image.downloadUrl,
      timeout: 60,
      headers: {
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        "User-Agent": "CommonplaceOS/0.1 (+https://localhost)",
      },
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error("image download failed with HTTP " + response.statusCode);
    }

    const contentType = headerValue(response.headers, "Content-Type").split(";")[0].trim().toLowerCase();
    const mimeType = contentType && contentType.startsWith("image/") ? contentType : draft.image.mimeType;
    return {
      bytes: response.body || [],
      fileName: ensureFileExtension(draft.image.fileName, mimeType),
      mimeType,
    };
  }

  function uploadStoredBytes(app, bytes, fileRef, storedFileRefs) {
    const filesystem = app.newFilesystem();
    try {
      filesystem.upload(bytes, fileRef);
      storedFileRefs.push(fileRef);
    } finally {
      filesystem.close();
    }
  }

  function cleanupStoredFiles(app, fileRefs) {
    if (!fileRefs.length) {
      return;
    }

    const filesystem = app.newFilesystem();
    try {
      for (let index = fileRefs.length - 1; index >= 0; index -= 1) {
        try {
          filesystem.delete(fileRefs[index]);
        } catch (error) {
          console.warn("failed to clean up orphan Are.na import " + fileRefs[index], error);
        }
      }
    } finally {
      filesystem.close();
    }
  }

  function emptyImportSummary(workspaceId, channel, collectionId, sourceId, depth) {
    return {
      workspace_id: workspaceId,
      channel: {
        id: channel && channel.id != null ? String(channel.id) : null,
        slug: optionalString(channel && channel.slug) || null,
        title: optionalString(channel && channel.title) || null,
      },
      collection_id: collectionId,
      source_id: sourceId,
      depth,
      blocks_seen: 0,
      items_created: 0,
      items_skipped: 0,
      items_updated: 0,
      collection_memberships_created: 0,
      collection_relationships_created: 0,
      collection_relationships_skipped: 0,
      sub_collections_created: 0,
      sub_collections_skipped: 0,
      by_block_type: {},
      by_import_type: {},
      warnings: [],
      errors: [],
    };
  }

  function localImportRequest(request) {
    const remoteAddr = request && typeof request.remoteAddr === "string" ? request.remoteAddr : "";
    if (remoteAddr === "") {
      return true;
    }

    const host = remoteAddr.startsWith("[") ? remoteAddr.slice(1, remoteAddr.indexOf("]")) : remoteAddr.split(":")[0];
    return host === "127.0.0.1" || host === "::1" || host === "localhost";
  }

  function queryAll(app, sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    app.db().newQuery(sql).bind(params || {}).all(rows);
    return rows;
  }

  function arenaFailureStatus(error) {
    const statusCode = Number(error && error.statusCode);
    if (statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 429) {
      return statusCode;
    }
    return 502;
  }

  function arenaFailureBody(error, apiKey) {
    const statusCode = Number(error && error.statusCode) || null;
    return {
      error: "Are.na API request failed",
      status_code: statusCode,
      needs_api_key: statusCode === 401 && !apiKey,
      message: error && error.message ? error.message : String(error),
    };
  }

  function requiredString(value, fieldName) {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new BadRequestError(fieldName + " is required");
    }

    const text = String(value).trim();
    if (!text) {
      throw new BadRequestError(fieldName + " is required");
    }

    return text;
  }

  function nonNegativeInteger(value, fallback, fieldName) {
    const text = optionalString(value);
    if (!text) {
      return fallback;
    }

    const parsed = Number(text);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestError(fieldName + " must be a non-negative integer");
    }
    return parsed;
  }

  function optionalString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valid")) {
      return value.valid ? String(value.string || "").trim() : "";
    }

    return String(value).trim();
  }

  function nullableString(value) {
    const text = optionalString(value);
    return text || null;
  }

  function nullableNumber(value) {
    const text = optionalString(value);
    if (!text) {
      return null;
    }

    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function markdownValue(value) {
    if (!value) {
      return null;
    }

    if (typeof value === "string") {
      return value.trim() || null;
    }

    return optionalString(value.markdown) || optionalString(value.plain) || null;
  }

  function itemIdFor(workspaceId, sourceExternalId) {
    return "item:arena:" + safePathSegment(workspaceId) + ":" + safePathSegment(sourceExternalId);
  }

  function eventIdFor(eventType, itemId, now) {
    return "event:arena:" + safePathSegment(eventType) + ":" + safePathSegment(itemId) + ":" + safePathSegment(now) + ":" + Math.random().toString(36).slice(2, 10);
  }

  function imageFileKeyFor(workspaceId, itemId, fileName) {
    return "imports/" + safePathSegment(workspaceId) + "/" + safePathSegment(itemId) + "/" + safePathSegment(fileName);
  }

  function safePathSegment(value) {
    return String(value).replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  function ensureFileExtension(fileName, mimeType) {
    const cleanName = safeFileName(fileName);
    const lower = cleanName.toLowerCase();
    if (/\.[a-z0-9]{2,5}$/.test(lower)) {
      return cleanName;
    }

    return cleanName + extensionForMimeType(mimeType);
  }

  function safeFileName(value) {
    return String(value || "arena-file")
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "arena-file";
  }

  function extensionForMimeType(mimeType) {
    if (mimeType === "image/png") {
      return ".png";
    }
    if (mimeType === "image/webp") {
      return ".webp";
    }
    if (mimeType === "image/gif") {
      return ".gif";
    }
    if (mimeType === "image/avif") {
      return ".avif";
    }
    return ".jpg";
  }

  function headerValue(headers, name) {
    const lowerName = String(name || "").toLowerCase();
    const source = headers || {};
    for (const key in source) {
      if (String(key).toLowerCase() === lowerName) {
        const value = source[key];
        return Array.isArray(value) ? String(value[0] || "") : String(value || "");
      }
    }
    return "";
  }

  function countAffected(result) {
    if (!result) {
      return 0;
    }
    if (typeof result.rowsAffected === "function") {
      return Number(result.rowsAffected()) || 0;
    }
    if (typeof result.rowsAffected === "number") {
      return result.rowsAffected;
    }
    return 0;
  }
});
