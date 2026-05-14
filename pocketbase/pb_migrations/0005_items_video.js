/// <reference path="../pb_data/types.d.ts" />

// Adds local uploaded videos as a first-class item type. See
// docs/decisions/0007-video-as-item-type.md.
//
// SQLite cannot alter CHECK constraints in place, so items is rebuilt to add
// 'video' to the type discriminator. PocketBase runs JS migrations inside a
// transaction, where PRAGMA foreign_keys cannot be disabled. Rebuild every
// table with an items(id) foreign key in the same transaction so child FKs point
// back to the restored items table instead of a temporary legacy table.

function resolveDb(ctx) {
  if (ctx && typeof ctx.db === "function") {
    return ctx.db();
  }

  return ctx;
}

function executeStatements(db, statements) {
  statements.forEach((statement) => {
    db.newQuery(statement).execute();
  });
}

function runStatements(ctx, statements) {
  if (ctx && typeof ctx.db === "function") {
    executeStatements(resolveDb(ctx), statements);
    return;
  }

  if (ctx && typeof ctx.runInTransaction === "function") {
    ctx.runInTransaction((txDb) => {
      executeStatements(txDb, statements);
    });
    return;
  }

  executeStatements(resolveDb(ctx), statements);
}

const itemColumns = [
  "id",
  "workspace_id",
  "type",
  "status",
  "title",
  "description",
  "summary",
  "source_id",
  "source_external_id",
  "privacy_level",
  "rights_status",
  "rights_note",
  "rights_reviewed_at",
  "update_count",
  "created_at",
  "updated_at",
];

function createItemsTable(tableName, typeValues) {
  const typeCheck = typeValues.map((value) => `'${value}'`).join(", ");

  return `CREATE TABLE ${tableName} (
    id TEXT NOT NULL PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (${typeCheck})),
    status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
    title TEXT,
    description TEXT,
    summary TEXT,
    source_id TEXT,
    source_external_id TEXT,
    privacy_level TEXT CHECK (privacy_level IS NULL OR privacy_level IN ('private', 'personal', 'team', 'public')),
    rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'reference_only', 'approved_for_internal_use', 'approved_for_external_use', 'restricted', 'expired')),
    rights_note TEXT,
    rights_reviewed_at TEXT,
    update_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_items_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    CONSTRAINT fk_items_source
      FOREIGN KEY (source_id) REFERENCES sources(id)
  )`;
}

function copyItems(targetTable, sourceTable) {
  const columns = itemColumns.join(", ");

  return `INSERT INTO ${targetTable} (${columns})
    SELECT ${columns} FROM ${sourceTable}`;
}

const dropItemsFtsTriggers = [
  "DROP TRIGGER IF EXISTS trg_items_fts_before_delete",
  "DROP TRIGGER IF EXISTS trg_items_fts_after_update",
  "DROP TRIGGER IF EXISTS trg_items_fts_after_insert",
];

const createItemsFtsTriggers = [
  `CREATE TRIGGER trg_items_fts_after_insert
     AFTER INSERT ON items
     BEGIN
       INSERT INTO items_fts(rowid, title, description, summary)
       VALUES (NEW.rowid, NEW.title, NEW.description, NEW.summary);
     END`,
  `CREATE TRIGGER trg_items_fts_after_update
     AFTER UPDATE OF title, description, summary ON items
     BEGIN
       INSERT INTO items_fts(items_fts, rowid, title, description, summary)
       VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.summary);
       INSERT INTO items_fts(rowid, title, description, summary)
       VALUES (NEW.rowid, NEW.title, NEW.description, NEW.summary);
     END`,
  `CREATE TRIGGER trg_items_fts_before_delete
     BEFORE DELETE ON items
     BEGIN
       INSERT INTO items_fts(items_fts, rowid, title, description, summary)
       VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.summary);
     END`,
];

const dropItemsIndexes = [
  "DROP INDEX IF EXISTS unq_items_workspace_source_external",
  "DROP INDEX IF EXISTS idx_items_workspace_updated_at",
  "DROP INDEX IF EXISTS idx_items_workspace_status_type",
];

const createItemsIndexes = [
  `CREATE INDEX idx_items_workspace_status_type
     ON items (workspace_id, status, type)`,
  `CREATE INDEX idx_items_workspace_updated_at
     ON items (workspace_id, updated_at)`,
  `CREATE UNIQUE INDEX unq_items_workspace_source_external
     ON items (workspace_id, source_id, source_external_id)
     WHERE source_id IS NOT NULL`,
];

const relationshipOrderingTrigger = `CREATE TRIGGER trg_relationships_symmetric_ordering
  BEFORE INSERT ON relationships
  WHEN EXISTS (
    SELECT 1
    FROM relationship_types
    WHERE relationship_types.type = NEW.type
      AND relationship_types.is_symmetric = 1
  )
  AND NEW.from_id > NEW.to_id
  BEGIN
    SELECT RAISE(ABORT, 'symmetric relationships must use canonical ordering: from_id < to_id');
  END`;

const itemDependentTables = [
  {
    name: "items_image",
    columns: ["item_id", "file_ref", "mime_type", "width", "height", "dominant_colors", "perceptual_hash", "ocr_text"],
    create: `CREATE TABLE items_image (
      item_id TEXT NOT NULL PRIMARY KEY,
      file_ref TEXT,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      dominant_colors TEXT,
      perceptual_hash TEXT,
      ocr_text TEXT,
      CONSTRAINT fk_items_image_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
    indexes: [
      `CREATE INDEX idx_items_image_perceptual_hash
        ON items_image (perceptual_hash)`,
    ],
  },
  {
    name: "items_caption",
    columns: ["item_id", "body", "tone", "cta_type", "length_chars"],
    create: `CREATE TABLE items_caption (
      item_id TEXT NOT NULL PRIMARY KEY,
      body TEXT NOT NULL,
      tone TEXT,
      cta_type TEXT,
      length_chars INTEGER,
      CONSTRAINT fk_items_caption_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
  },
  {
    name: "items_note",
    columns: ["item_id", "body", "format"],
    create: `CREATE TABLE items_note (
      item_id TEXT NOT NULL PRIMARY KEY,
      body TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'blocknote' CHECK (format IN ('blocknote', 'markdown', 'plain')),
      CONSTRAINT fk_items_note_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
  },
  {
    name: "items_link",
    columns: ["item_id", "url", "og_metadata", "content_type", "fetched_at"],
    create: `CREATE TABLE items_link (
      item_id TEXT NOT NULL PRIMARY KEY,
      url TEXT NOT NULL,
      og_metadata TEXT,
      content_type TEXT CHECK (content_type IS NULL OR content_type IN ('article', 'video', 'pdf', 'audio', 'unknown')),
      fetched_at TEXT,
      CONSTRAINT fk_items_link_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
  },
  {
    name: "relationships",
    columns: ["id", "workspace_id", "from_id", "to_id", "type", "weight", "metadata", "note", "asserted_by", "created_at"],
    create: `CREATE TABLE relationships (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      type TEXT NOT NULL,
      weight REAL CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1)),
      metadata TEXT,
      note TEXT,
      asserted_by TEXT NOT NULL CHECK (asserted_by IN ('human', 'subagent:enrichment', 'subagent:import')),
      created_at TEXT NOT NULL,
      CHECK (from_id != to_id),
      CONSTRAINT fk_relationships_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      CONSTRAINT fk_relationships_from_item
        FOREIGN KEY (from_id) REFERENCES items(id),
      CONSTRAINT fk_relationships_to_item
        FOREIGN KEY (to_id) REFERENCES items(id),
      CONSTRAINT fk_relationships_type
        FOREIGN KEY (type) REFERENCES relationship_types(type),
      CONSTRAINT unq_relationships_workspace_from_to_type
        UNIQUE (workspace_id, from_id, to_id, type)
    )`,
    indexes: [
      `CREATE INDEX idx_relationships_workspace_from_type
        ON relationships (workspace_id, from_id, type)`,
      `CREATE INDEX idx_relationships_workspace_to_type
        ON relationships (workspace_id, to_id, type)`,
      `CREATE INDEX idx_relationships_workspace_type
        ON relationships (workspace_id, type)`,
    ],
    triggers: [relationshipOrderingTrigger],
  },
  {
    name: "item_tags",
    columns: ["item_id", "tag_id", "applied_by", "applied_at"],
    create: `CREATE TABLE item_tags (
      item_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      applied_by TEXT NOT NULL CHECK (applied_by IN ('human', 'subagent:enrichment')),
      applied_at TEXT NOT NULL,
      PRIMARY KEY (item_id, tag_id),
      CONSTRAINT fk_item_tags_item
        FOREIGN KEY (item_id) REFERENCES items(id),
      CONSTRAINT fk_item_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags(id)
    )`,
  },
  {
    name: "collection_items",
    columns: ["collection_id", "item_id", "added_at", "added_by"],
    create: `CREATE TABLE collection_items (
      collection_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      added_by TEXT NOT NULL,
      PRIMARY KEY (collection_id, item_id),
      CONSTRAINT fk_collection_items_collection
        FOREIGN KEY (collection_id) REFERENCES collections(id),
      CONSTRAINT fk_collection_items_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
  },
  {
    name: "ai_annotations",
    columns: ["id", "workspace_id", "item_id", "field_name", "payload", "model_name", "model_version", "prompt_version", "confidence", "review_status", "reviewed_by", "reviewed_at", "created_at", "superseded_at"],
    create: `CREATE TABLE ai_annotations (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      payload TEXT NOT NULL,
      model_name TEXT NOT NULL,
      model_version TEXT,
      prompt_version TEXT,
      confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
      review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'superseded')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      superseded_at TEXT,
      CONSTRAINT fk_ai_annotations_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      CONSTRAINT fk_ai_annotations_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
    indexes: [
      `CREATE INDEX idx_ai_annotations_workspace_item_field
        ON ai_annotations (workspace_id, item_id, field_name)`,
      `CREATE INDEX idx_ai_annotations_workspace_review_status_created
        ON ai_annotations (workspace_id, review_status, created_at)`,
    ],
  },
  {
    name: "item_events",
    columns: ["id", "workspace_id", "item_id", "event_type", "actor", "metadata", "created_at"],
    create: `CREATE TABLE item_events (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      CONSTRAINT fk_item_events_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      CONSTRAINT fk_item_events_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
    indexes: [
      `CREATE INDEX idx_item_events_workspace_item_created
        ON item_events (workspace_id, item_id, created_at)`,
      `CREATE INDEX idx_item_events_workspace_event_type_created
        ON item_events (workspace_id, event_type, created_at)`,
    ],
  },
  {
    name: "embeddings",
    columns: ["item_id", "field_name", "model_name", "model_version", "vector"],
    create: `CREATE TABLE embeddings (
      item_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      model_name TEXT NOT NULL,
      model_version TEXT NOT NULL,
      vector BLOB NOT NULL,
      PRIMARY KEY (item_id, field_name, model_name, model_version),
      CONSTRAINT fk_embeddings_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )`,
  },
  {
    name: "item_assets",
    columns: ["id", "workspace_id", "item_id", "role", "file_ref", "original_name", "mime_type", "size_bytes", "created_at"],
    create: `CREATE TABLE item_assets (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('source_file', 'thumbnail')),
      file_ref TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER,
      created_at TEXT NOT NULL,
      CONSTRAINT fk_item_assets_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      CONSTRAINT fk_item_assets_item
        FOREIGN KEY (item_id) REFERENCES items(id),
      CONSTRAINT unq_item_assets_item_role
        UNIQUE (item_id, role)
    )`,
    indexes: [
      `CREATE INDEX idx_item_assets_workspace_item
        ON item_assets (workspace_id, item_id)`,
    ],
  },
];

function legacyTableName(name, suffix) {
  return `${name}_${suffix}`;
}

function dropDependentIndexesAndTriggers() {
  return [
    "DROP TRIGGER IF EXISTS trg_relationships_symmetric_ordering",
    ...itemDependentTables.flatMap((table) =>
      (table.indexes || []).map((indexSql) => {
        const match = indexSql.match(/CREATE (?:UNIQUE )?INDEX ([^\s]+)/);
        return `DROP INDEX IF EXISTS ${match[1]}`;
      }),
    ),
  ];
}

function renameDependentTables(suffix) {
  return itemDependentTables.map(
    (table) => `ALTER TABLE ${table.name} RENAME TO ${legacyTableName(table.name, suffix)}`,
  );
}

function createDependentTables() {
  return itemDependentTables.map((table) => table.create);
}

function copyDependentTables(suffix) {
  return itemDependentTables.map((table) => {
    const columns = table.columns.join(", ");
    return `INSERT INTO ${table.name} (${columns})
      SELECT ${columns} FROM ${legacyTableName(table.name, suffix)}`;
  });
}

function dropLegacyDependentTables(suffix) {
  return itemDependentTables.map(
    (table) => `DROP TABLE ${legacyTableName(table.name, suffix)}`,
  );
}

function createDependentIndexesAndTriggers() {
  return itemDependentTables.flatMap((table) => [
    ...(table.indexes || []),
    ...(table.triggers || []),
  ]);
}

function rebuildItems(typeValues, suffix) {
  const legacyItems = legacyTableName("items", suffix);

  return [
    "PRAGMA defer_foreign_keys = ON",
    ...dropItemsFtsTriggers,
    ...dropDependentIndexesAndTriggers(),
    ...dropItemsIndexes,
    ...renameDependentTables(suffix),
    `ALTER TABLE items RENAME TO ${legacyItems}`,
    createItemsTable("items", typeValues),
    copyItems("items", legacyItems),
    ...createDependentTables(),
    ...copyDependentTables(suffix),
    ...dropLegacyDependentTables(suffix),
    `DROP TABLE ${legacyItems}`,
    ...createItemsIndexes,
    ...createDependentIndexesAndTriggers(),
    `INSERT INTO items_fts(items_fts) VALUES ('delete-all')`,
    `INSERT INTO items_fts(rowid, title, description, summary)
       SELECT rowid, title, description, summary FROM items`,
    ...createItemsFtsTriggers,
  ];
}

const deleteVideoRows = [
  `DELETE FROM relationships
     WHERE from_id IN (SELECT id FROM items WHERE type = 'video')
        OR to_id IN (SELECT id FROM items WHERE type = 'video')`,
  `DELETE FROM item_tags
     WHERE item_id IN (SELECT id FROM items WHERE type = 'video')`,
  `DELETE FROM collection_items
     WHERE item_id IN (SELECT id FROM items WHERE type = 'video')`,
  `DELETE FROM ai_annotations
     WHERE item_id IN (SELECT id FROM items WHERE type = 'video')`,
  `DELETE FROM item_events
     WHERE item_id IN (SELECT id FROM items WHERE type = 'video')`,
  `DELETE FROM embeddings
     WHERE item_id IN (SELECT id FROM items WHERE type = 'video')`,
  `DELETE FROM item_assets
     WHERE item_id IN (SELECT id FROM items WHERE type = 'video')`,
  `DELETE FROM items_video
     WHERE item_id IN (SELECT id FROM items WHERE type = 'video')`,
  `DELETE FROM items WHERE type = 'video'`,
];

const upStatements = [
  ...rebuildItems(["image", "caption", "note", "link", "video"], "video_rebuild"),
  `CREATE TABLE items_video (
    item_id TEXT NOT NULL PRIMARY KEY,
    file_ref TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('video/mp4', 'video/webm', 'video/quicktime')),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
    poster_file_ref TEXT NOT NULL,
    dominant_colors TEXT,
    perceptual_hash TEXT,
    aspect_ratio REAL NOT NULL CHECK (aspect_ratio > 0),
    CONSTRAINT fk_items_video_item
      FOREIGN KEY (item_id) REFERENCES items(id)
  )`,
  `CREATE INDEX idx_items_video_perceptual_hash
     ON items_video (perceptual_hash)`,
];

const downStatements = [
  ...deleteVideoRows,
  "DROP INDEX IF EXISTS idx_items_video_perceptual_hash",
  "DROP TABLE IF EXISTS items_video",
  ...rebuildItems(["image", "caption", "note", "link"], "without_video_rebuild"),
];

migrate((ctx) => {
  runStatements(ctx, upStatements);
}, (ctx) => {
  runStatements(ctx, downStatements);
});
