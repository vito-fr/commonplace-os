/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/vita/item-detail", (e) => {
  const query = e.request.url.query();
  const workspaceId = query.get("workspace_id");
  const itemId = query.get("item_id");

  if (!workspaceId) {
    throw new BadRequestError("workspace_id is required");
  }

  if (!itemId) {
    throw new BadRequestError("item_id is required");
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

  function parseJson(value, fallback) {
    const text = nullableString(value);
    if (!text) {
      return fallback;
    }

    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function queryAll(sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    e.app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  const itemRows = queryAll(
    `
      SELECT
        i.id,
        i.workspace_id AS workspaceId,
        i.type,
        i.status,
        i.title,
        i.description,
        i.summary,
        i.source_id AS sourceId,
        s.kind AS sourceKind,
        s.identifier AS sourceIdentifier,
        s.label AS sourceLabel,
        i.source_external_id AS sourceExternalId,
        i.privacy_level AS privacyLevel,
        i.rights_status AS rightsStatus,
        i.rights_note AS rightsNote,
        i.rights_reviewed_at AS rightsReviewedAt,
        i.update_count AS updateCount,
        i.created_at AS createdAt,
        i.updated_at AS updatedAt,
        img.file_ref AS imageFileRef,
        img.mime_type AS imageMimeType,
        CASE WHEN img.width IS NULL THEN NULL ELSE CAST(img.width AS TEXT) END AS imageWidth,
        CASE WHEN img.height IS NULL THEN NULL ELSE CAST(img.height AS TEXT) END AS imageHeight,
        img.dominant_colors AS imageDominantColors,
        img.perceptual_hash AS imagePerceptualHash,
        img.ocr_text AS imageOcrText,
        caption.body AS captionBody,
        caption.tone AS captionTone,
        caption.cta_type AS captionCtaType,
        CASE WHEN caption.length_chars IS NULL THEN NULL ELSE CAST(caption.length_chars AS TEXT) END AS captionLengthChars,
        note.body AS noteBody,
        note.format AS noteFormat,
        link.url AS linkUrl,
        link.og_metadata AS linkOgMetadata,
        link.content_type AS linkContentType,
        link.fetched_at AS linkFetchedAt,
        video.file_ref AS videoFileRef,
        video.mime_type AS videoMimeType,
        CASE WHEN video.width IS NULL THEN NULL ELSE CAST(video.width AS TEXT) END AS videoWidth,
        CASE WHEN video.height IS NULL THEN NULL ELSE CAST(video.height AS TEXT) END AS videoHeight,
        CASE WHEN video.duration_ms IS NULL THEN NULL ELSE CAST(video.duration_ms AS TEXT) END AS videoDurationMs,
        video.poster_file_ref AS videoPosterFileRef,
        video.dominant_colors AS videoDominantColors,
        video.perceptual_hash AS videoPerceptualHash,
        CASE WHEN video.aspect_ratio IS NULL THEN NULL ELSE CAST(video.aspect_ratio AS TEXT) END AS videoAspectRatio,
        asset.file_ref AS assetFileRef,
        asset.original_name AS assetOriginalName,
        asset.mime_type AS assetMimeType,
        CASE WHEN asset.size_bytes IS NULL THEN NULL ELSE CAST(asset.size_bytes AS TEXT) END AS assetSizeBytes
      FROM items i
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
      LEFT JOIN items_video video
        ON video.item_id = i.id
      LEFT JOIN item_assets asset
        ON asset.item_id = i.id
        AND asset.workspace_id = i.workspace_id
        AND asset.role = 'source_file'
      WHERE i.workspace_id = {:workspaceId}
        AND i.id = {:itemId}
      LIMIT 1
    `,
    {
      id: "",
      workspaceId: "",
      type: "",
      status: "",
      title: nullString(),
      description: nullString(),
      summary: nullString(),
      sourceId: nullString(),
      sourceKind: nullString(),
      sourceIdentifier: nullString(),
      sourceLabel: nullString(),
      sourceExternalId: nullString(),
      privacyLevel: nullString(),
      rightsStatus: "",
      rightsNote: nullString(),
      rightsReviewedAt: nullString(),
      updateCount: 0,
      createdAt: "",
      updatedAt: "",
      imageFileRef: nullString(),
      imageMimeType: nullString(),
      imageWidth: nullString(),
      imageHeight: nullString(),
      imageDominantColors: nullString(),
      imagePerceptualHash: nullString(),
      imageOcrText: nullString(),
      captionBody: nullString(),
      captionTone: nullString(),
      captionCtaType: nullString(),
      captionLengthChars: nullString(),
      noteBody: nullString(),
      noteFormat: nullString(),
      linkUrl: nullString(),
      linkOgMetadata: nullString(),
      linkContentType: nullString(),
      linkFetchedAt: nullString(),
      videoFileRef: nullString(),
      videoMimeType: nullString(),
      videoWidth: nullString(),
      videoHeight: nullString(),
      videoDurationMs: nullString(),
      videoPosterFileRef: nullString(),
      videoDominantColors: nullString(),
      videoPerceptualHash: nullString(),
      videoAspectRatio: nullString(),
      assetFileRef: nullString(),
      assetOriginalName: nullString(),
      assetMimeType: nullString(),
      assetSizeBytes: nullString(),
    },
    { workspaceId, itemId },
  );

  if (itemRows.length === 0) {
    throw new NotFoundError("item not found");
  }

  const row = itemRows[0];
  const tagRows = queryAll(
    `
      SELECT
        t.id,
        t.name,
        t.status,
        it.applied_by AS appliedBy,
        it.applied_at AS appliedAt
      FROM item_tags it
      INNER JOIN items i
        ON i.id = it.item_id
      INNER JOIN tags t
        ON t.id = it.tag_id
        AND t.workspace_id = i.workspace_id
      WHERE i.workspace_id = {:workspaceId}
        AND i.id = {:itemId}
      ORDER BY t.status ASC, t.name ASC
    `,
    {
      id: "",
      name: "",
      status: "",
      appliedBy: "",
      appliedAt: "",
    },
    { workspaceId, itemId },
  );
  const relationshipRows = queryAll(
    `
      SELECT
        r.id,
        r.type,
        rt.description AS typeDescription,
        CASE WHEN r.from_id = {:itemId} THEN 'outgoing' ELSE 'incoming' END AS direction,
        CASE WHEN r.from_id = {:itemId} THEN r.to_id ELSE r.from_id END AS otherItemId,
        other.type AS otherItemType,
        other.status AS otherItemStatus,
        other.title AS otherItemTitle,
        CASE WHEN r.weight IS NULL THEN NULL ELSE CAST(r.weight AS TEXT) END AS weight,
        r.note,
        r.asserted_by AS assertedBy,
        r.created_at AS createdAt
      FROM relationships r
      INNER JOIN relationship_types rt
        ON rt.type = r.type
      INNER JOIN items other
        ON other.id = CASE WHEN r.from_id = {:itemId} THEN r.to_id ELSE r.from_id END
        AND other.workspace_id = r.workspace_id
      WHERE r.workspace_id = {:workspaceId}
        AND (r.from_id = {:itemId} OR r.to_id = {:itemId})
      ORDER BY r.created_at DESC, r.id ASC
    `,
    {
      id: "",
      type: "",
      typeDescription: "",
      direction: "",
      otherItemId: "",
      otherItemType: "",
      otherItemStatus: "",
      otherItemTitle: nullString(),
      weight: nullString(),
      note: nullString(),
      assertedBy: "",
      createdAt: "",
    },
    { workspaceId, itemId },
  );
  const collectionRows = queryAll(
    `
      SELECT
        c.id,
        c.name,
        c.description,
        ci.added_at AS addedAt,
        ci.added_by AS addedBy
      FROM collection_items ci
      INNER JOIN collections c
        ON c.id = ci.collection_id
      INNER JOIN items i
        ON i.id = ci.item_id
        AND i.workspace_id = c.workspace_id
      WHERE c.workspace_id = {:workspaceId}
        AND ci.item_id = {:itemId}
      ORDER BY c.name ASC
    `,
    {
      id: "",
      name: "",
      description: nullString(),
      addedAt: "",
      addedBy: "",
    },
    { workspaceId, itemId },
  );
  const annotationRows = queryAll(
    `
      SELECT
        id,
        field_name AS fieldName,
        payload,
        model_name AS modelName,
        model_version AS modelVersion,
        prompt_version AS promptVersion,
        CASE WHEN confidence IS NULL THEN NULL ELSE CAST(confidence AS TEXT) END AS confidence,
        review_status AS reviewStatus,
        reviewed_by AS reviewedBy,
        reviewed_at AS reviewedAt,
        created_at AS createdAt,
        superseded_at AS supersededAt
      FROM ai_annotations
      WHERE workspace_id = {:workspaceId}
        AND item_id = {:itemId}
      ORDER BY created_at DESC, id ASC
    `,
    {
      id: "",
      fieldName: "",
      payload: "",
      modelName: "",
      modelVersion: nullString(),
      promptVersion: nullString(),
      confidence: nullString(),
      reviewStatus: "",
      reviewedBy: nullString(),
      reviewedAt: nullString(),
      createdAt: "",
      supersededAt: nullString(),
    },
    { workspaceId, itemId },
  );
  const eventRows = queryAll(
    `
      SELECT
        id,
        event_type AS eventType,
        actor,
        metadata,
        created_at AS createdAt
      FROM item_events
      WHERE workspace_id = {:workspaceId}
        AND item_id = {:itemId}
      ORDER BY created_at DESC, id ASC
      LIMIT 25
    `,
    {
      id: "",
      eventType: "",
      actor: "",
      metadata: nullString(),
      createdAt: "",
    },
    { workspaceId, itemId },
  );

  const sourceId = nullableString(row.sourceId);
  const imageWidth = nullableNumber(row.imageWidth);
  const imageHeight = nullableNumber(row.imageHeight);
  const videoWidth = nullableNumber(row.videoWidth);
  const videoHeight = nullableNumber(row.videoHeight);
  const videoAspectRatio = nullableNumber(row.videoAspectRatio);
  const content = {
    kind: row.type,
    image:
      row.type === "image"
        ? {
            fileRef: nullableString(row.imageFileRef),
            mimeType: nullableString(row.imageMimeType),
            width: imageWidth,
            height: imageHeight,
            aspectRatio: aspectRatioFor(imageWidth, imageHeight),
            dominantColors: parseJson(row.imageDominantColors, null),
            perceptualHash: nullableString(row.imagePerceptualHash),
            ocrText: nullableString(row.imageOcrText),
          }
        : null,
    caption:
      row.type === "caption"
        ? {
            body: nullableString(row.captionBody),
            tone: nullableString(row.captionTone),
            ctaType: nullableString(row.captionCtaType),
            lengthChars: nullableNumber(row.captionLengthChars),
          }
        : null,
    note:
      row.type === "note"
        ? {
            body: nullableString(row.noteBody),
            format: nullableString(row.noteFormat),
          }
        : null,
    link:
      row.type === "link"
        ? {
            url: nullableString(row.linkUrl),
            ogMetadata: parseJson(row.linkOgMetadata, null),
            contentType: nullableString(row.linkContentType),
            fetchedAt: nullableString(row.linkFetchedAt),
            asset: nullableString(row.assetFileRef)
              ? {
                  fileRef: nullableString(row.assetFileRef),
                  originalName: nullableString(row.assetOriginalName),
                  mimeType: nullableString(row.assetMimeType),
                  sizeBytes: nullableNumber(row.assetSizeBytes),
                }
              : null,
          }
        : null,
    video:
      row.type === "video"
        ? {
            fileRef: nullableString(row.videoFileRef),
            mimeType: nullableString(row.videoMimeType),
            width: videoWidth,
            height: videoHeight,
            durationMs: nullableNumber(row.videoDurationMs),
            posterFileRef: nullableString(row.videoPosterFileRef),
            dominantColors: parseJson(row.videoDominantColors, null),
            perceptualHash: nullableString(row.videoPerceptualHash),
            aspectRatio: videoAspectRatio || aspectRatioFor(videoWidth, videoHeight),
            asset: nullableString(row.assetFileRef)
              ? {
                  fileRef: nullableString(row.assetFileRef),
                  originalName: nullableString(row.assetOriginalName),
                  mimeType: nullableString(row.assetMimeType),
                  sizeBytes: nullableNumber(row.assetSizeBytes),
                }
              : null,
          }
        : null,
  };

  const tags = [];
  for (let index = 0; index < tagRows.length; index += 1) {
    const tag = tagRows[index];
    tags.push({
      id: tag.id,
      name: tag.name,
      status: tag.status,
      appliedBy: tag.appliedBy,
      appliedAt: tag.appliedAt,
    });
  }

  const relationships = [];
  for (let index = 0; index < relationshipRows.length; index += 1) {
    const relationship = relationshipRows[index];
    relationships.push({
      id: relationship.id,
      type: relationship.type,
      typeDescription: relationship.typeDescription,
      direction: relationship.direction,
      otherItemId: relationship.otherItemId,
      otherItemType: relationship.otherItemType,
      otherItemStatus: relationship.otherItemStatus,
      otherItemTitle: nullableString(relationship.otherItemTitle),
      weight: nullableNumber(relationship.weight),
      note: nullableString(relationship.note),
      assertedBy: relationship.assertedBy,
      createdAt: relationship.createdAt,
    });
  }

  const collections = [];
  for (let index = 0; index < collectionRows.length; index += 1) {
    const collection = collectionRows[index];
    collections.push({
      id: collection.id,
      name: collection.name,
      description: nullableString(collection.description),
      addedAt: collection.addedAt,
      addedBy: collection.addedBy,
    });
  }

  const aiAnnotations = [];
  for (let index = 0; index < annotationRows.length; index += 1) {
    const annotation = annotationRows[index];
    aiAnnotations.push({
      id: annotation.id,
      fieldName: annotation.fieldName,
      payload: annotation.payload,
      modelName: annotation.modelName,
      modelVersion: nullableString(annotation.modelVersion),
      promptVersion: nullableString(annotation.promptVersion),
      confidence: nullableNumber(annotation.confidence),
      reviewStatus: annotation.reviewStatus,
      reviewedBy: nullableString(annotation.reviewedBy),
      reviewedAt: nullableString(annotation.reviewedAt),
      createdAt: annotation.createdAt,
      supersededAt: nullableString(annotation.supersededAt),
    });
  }

  const events = [];
  for (let index = 0; index < eventRows.length; index += 1) {
    const event = eventRows[index];
    events.push({
      id: event.id,
      eventType: event.eventType,
      actor: event.actor,
      metadata: parseJson(event.metadata, null),
      createdAt: event.createdAt,
    });
  }

  function aspectRatioFor(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    return width / height;
  }

  return e.json(200, {
    item: {
      id: row.id,
      workspaceId: row.workspaceId,
      type: row.type,
      status: row.status,
      title: nullableString(row.title),
      description: nullableString(row.description),
      summary: nullableString(row.summary),
      source: sourceId
        ? {
            id: sourceId,
            kind: nullableString(row.sourceKind),
            identifier: nullableString(row.sourceIdentifier),
            label: nullableString(row.sourceLabel),
          }
        : null,
      sourceExternalId: nullableString(row.sourceExternalId),
      privacyLevel: nullableString(row.privacyLevel),
      rightsStatus: row.rightsStatus,
      rightsNote: nullableString(row.rightsNote),
      rightsReviewedAt: nullableString(row.rightsReviewedAt),
      updateCount: row.updateCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      content,
      tags,
      relationships,
      collections,
      aiAnnotations,
      events,
    },
  });
});

routerAdd("POST", "/api/vita/item-note", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    item_id: "",
    body: "",
    format: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const itemId = requiredString(body.item_id, "item_id");
  const noteBody = textString(body.body);
  const noteFormat = optionalString(body.format) || "plain";
  const actor = optionalString(body.actor) || "system";

  if (!["plain", "markdown", "blocknote"].includes(noteFormat)) {
    throw new BadRequestError("format is invalid");
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

  function textString(value) {
    return typeof value === "string" ? value : "";
  }

  function queryAll(app, sql, shape, params) {
    const rows = arrayOf(new DynamicModel(shape));
    app.db().newQuery(sql).bind(params).all(rows);
    return rows;
  }

  function eventIdFor(itemId, timestamp) {
    const suffix = Math.random().toString(36).slice(2, 10);
    return `note:${itemId}:${timestamp}:${suffix}`;
  }

  let result = null;

  e.app.runInTransaction((txApp) => {
    const itemRows = queryAll(
      txApp,
      `
        SELECT id, workspace_id AS workspaceId, type, update_count AS updateCount
        FROM items
        WHERE workspace_id = {:workspaceId}
          AND id = {:itemId}
        LIMIT 1
      `,
      {
        id: "",
        workspaceId: "",
        type: "",
        updateCount: 0,
      },
      { workspaceId, itemId },
    );

    if (itemRows.length === 0) {
      throw new NotFoundError("item not found");
    }

    if (itemRows[0].type !== "note") {
      throw new BadRequestError("only note items can be edited through item-note");
    }

    const noteRows = queryAll(
      txApp,
      `
        SELECT item_id AS itemId
        FROM items_note
        WHERE item_id = {:itemId}
        LIMIT 1
      `,
      { itemId: "" },
      { itemId },
    );

    if (noteRows.length === 0) {
      throw new NotFoundError("note body not found");
    }

    const now = new Date().toISOString();
    const eventId = eventIdFor(itemId, now);
    const nextUpdateCount = Number(itemRows[0].updateCount || 0) + 1;
    const metadata = JSON.stringify({
      format: noteFormat,
      length_chars: noteBody.length,
    });

    txApp
      .db()
      .newQuery(
        `
          UPDATE items_note
          SET body = {:noteBody},
              format = {:noteFormat}
          WHERE item_id = {:itemId}
        `,
      )
      .bind({ itemId, noteBody, noteFormat })
      .execute();

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
      .bind({ workspaceId, itemId, now })
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
            'note_updated',
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
        updatedAt: now,
        updateCount: nextUpdateCount,
        content: {
          note: {
            body: noteBody,
            format: noteFormat,
          },
        },
      },
      event: {
        id: eventId,
        eventType: "note_updated",
        createdAt: now,
      },
    };
  });

  return e.json(200, result);
});
