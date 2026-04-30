/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/vita/campaign-options", (e) => {
  const query = e.request.url.query();
  const workspaceId = query.get("workspace_id");
  const itemId = query.get("item_id") || "";

  if (!workspaceId) {
    throw new BadRequestError("workspace_id is required");
  }

  const rows = arrayOf(
    new DynamicModel({
      id: "",
      title: nullString(),
      status: "",
      phase: nullString(),
      alreadyAttached: 0,
    }),
  );

  e.app
    .db()
    .newQuery(
      `
        SELECT
          campaign.id,
          campaign.title,
          campaign.status,
          profile.phase,
          EXISTS (
            SELECT 1
            FROM relationships r
            WHERE r.workspace_id = campaign.workspace_id
              AND r.from_id = {:itemId}
              AND r.to_id = campaign.id
              AND r.type = 'used_in'
          ) AS alreadyAttached
        FROM items campaign
        LEFT JOIN campaign_profiles profile
          ON profile.item_id = campaign.id
        WHERE campaign.workspace_id = {:workspaceId}
          AND campaign.type = 'campaign'
          AND campaign.id != {:itemId}
          AND campaign.status != 'retired'
        ORDER BY campaign.updated_at DESC, campaign.id ASC
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

  const campaigns = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    campaigns.push({
      id: row.id,
      title: nullableString(row.title),
      status: row.status,
      phase: nullableString(row.phase),
      alreadyAttached: row.alreadyAttached === 1,
    });
  }

  return e.json(200, { campaigns });
});

routerAdd("POST", "/api/vita/item-campaign", (e) => {
  const body = new DynamicModel({
    workspace_id: "",
    item_id: "",
    campaign_id: "",
    role: "",
    rights_override_note: "",
    actor: "",
  });
  e.bindBody(body);

  const workspaceId = requiredString(body.workspace_id, "workspace_id");
  const itemId = requiredString(body.item_id, "item_id");
  const campaignId = requiredString(body.campaign_id, "campaign_id");
  const role = optionalString(body.role) || "supporting";
  const overrideNote = optionalString(body.rights_override_note);
  const actor = optionalString(body.actor) || "system";

  if (itemId === campaignId) {
    throw new BadRequestError("campaign attachments require distinct item and campaign ids");
  }

  if (!isKnownRole(role)) {
    throw new BadRequestError("campaign role is invalid");
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

  function nullableString(value) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "valid")) {
      return value.valid ? value.string : null;
    }

    return value;
  }

  function isKnownRole(value) {
    return ["primary", "supporting", "reference"].includes(value);
  }

  function rightsWarningState(rightsStatus, role) {
    if (rightsStatus === "restricted" || rightsStatus === "expired") {
      return "blocking";
    }

    if (rightsStatus === "unknown") {
      return "advisory";
    }

    if (rightsStatus === "reference_only" && (role === "primary" || role === "supporting")) {
      return "advisory";
    }

    return "none";
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
    return `campaign:${timestamp}:${idSuffix()}`;
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
        WHERE type = 'used_in'
        LIMIT 1
      `,
      {
        type: "",
        isSymmetric: 0,
      },
      {},
    );

    if (typeRows.length === 0) {
      throw new BadRequestError("used_in relationship type is not registered");
    }

    if (typeRows[0].isSymmetric !== 0) {
      throw new BadRequestError("used_in relationship type must be directional");
    }

    const itemRows = queryAll(
      txApp,
      `
        SELECT id, type, rights_status AS rightsStatus
        FROM items
        WHERE workspace_id = {:workspaceId}
          AND id = {:itemId}
        LIMIT 1
      `,
      {
        id: "",
        type: "",
        rightsStatus: "",
      },
      { workspaceId, itemId },
    );

    if (itemRows.length === 0) {
      throw new NotFoundError("item not found");
    }

    if (itemRows[0].type === "campaign") {
      throw new BadRequestError("campaign items cannot be attached as campaign assets in this slice");
    }

    const campaignRows = queryAll(
      txApp,
      `
        SELECT
          campaign.id,
          campaign.title,
          campaign.status,
          profile.phase
        FROM items campaign
        LEFT JOIN campaign_profiles profile
          ON profile.item_id = campaign.id
        WHERE campaign.workspace_id = {:workspaceId}
          AND campaign.id = {:campaignId}
          AND campaign.type = 'campaign'
        LIMIT 1
      `,
      {
        id: "",
        title: nullString(),
        status: "",
        phase: nullString(),
      },
      { workspaceId, campaignId },
    );

    if (campaignRows.length === 0) {
      throw new NotFoundError("campaign not found");
    }

    if (campaignRows[0].status === "retired") {
      throw new BadRequestError("retired campaigns cannot receive attachments in this slice");
    }

    const duplicateRows = queryAll(
      txApp,
      `
        SELECT id
        FROM relationships
        WHERE workspace_id = {:workspaceId}
          AND from_id = {:itemId}
          AND to_id = {:campaignId}
          AND type = 'used_in'
        LIMIT 1
      `,
      { id: "" },
      { workspaceId, itemId, campaignId },
    );

    if (duplicateRows.length > 0) {
      throw new BadRequestError("campaign attachment already exists");
    }

    const warningState = rightsWarningState(itemRows[0].rightsStatus, role);
    if (warningState === "blocking") {
      throw new BadRequestError("item rights_status blocks campaign attachment");
    }

    if (warningState === "advisory" && overrideNote === "") {
      throw new BadRequestError("rights override note is required");
    }

    const now = new Date().toISOString();
    const campaign = campaignRows[0];
    const relationshipId = relationshipIdFor(now);
    const itemEventId = eventIdFor(relationshipId, itemId, "asset");
    const campaignEventId = eventIdFor(relationshipId, campaignId, "campaign");
    const relationshipMetadata = {
      role,
      rights_warning_state: warningState,
    };

    if (warningState === "advisory") {
      relationshipMetadata.override_note = overrideNote;
    }

    const itemMetadata = {
      relationship_id: relationshipId,
      item_id: itemId,
      campaign_id: campaignId,
      campaign_title: nullableString(campaign.title),
      role,
      direction: "asset",
      rights_status: itemRows[0].rightsStatus,
      rights_warning_state: warningState,
    };
    const campaignMetadata = {
      relationship_id: relationshipId,
      item_id: itemId,
      campaign_id: campaignId,
      role,
      direction: "campaign",
      rights_status: itemRows[0].rightsStatus,
      rights_warning_state: warningState,
    };

    if (warningState === "advisory") {
      itemMetadata.override_note = overrideNote;
      campaignMetadata.override_note = overrideNote;
    }

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
            {:campaignId},
            'used_in',
            NULL,
            {:relationshipMetadata},
            NULL,
            'human',
            {:now}
          )
        `,
      )
      .bind({
        relationshipId,
        workspaceId,
        itemId,
        campaignId,
        relationshipMetadata: JSON.stringify(relationshipMetadata),
        now,
      })
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
              {:itemEventId},
              {:workspaceId},
              {:itemId},
              'campaign_attached',
              {:actor},
              {:itemMetadata},
              {:now}
            ),
            (
              {:campaignEventId},
              {:workspaceId},
              {:campaignId},
              'campaign_attached',
              {:actor},
              {:campaignMetadata},
              {:now}
            )
        `,
      )
      .bind({
        itemEventId,
        campaignEventId,
        workspaceId,
        itemId,
        campaignId,
        actor,
        itemMetadata: JSON.stringify(itemMetadata),
        campaignMetadata: JSON.stringify(campaignMetadata),
        now,
      })
      .execute();

    result = {
      attachment: {
        id: relationshipId,
        workspaceId,
        itemId,
        campaignId,
        role,
        campaignTitle: nullableString(campaign.title),
        phase: nullableString(campaign.phase),
        rightsWarningState: warningState,
        createdAt: now,
      },
      events: [
        {
          id: itemEventId,
          itemId,
          eventType: "campaign_attached",
          createdAt: now,
        },
        {
          id: campaignEventId,
          itemId: campaignId,
          eventType: "campaign_attached",
          createdAt: now,
        },
      ],
    };
  });

  return e.json(200, result);
});
