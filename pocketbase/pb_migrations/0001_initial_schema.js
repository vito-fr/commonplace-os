/// <reference path="../pb_data/types.d.ts" />

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

const upStatements = [
  `
    CREATE TABLE workspaces (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('personal', 'business')),
      created_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE sources (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('pinterest', 'arena', 'url', 'local', 'ios_capture', 'manual')),
      identifier TEXT NOT NULL,
      label TEXT NOT NULL,
      default_privacy_level TEXT NOT NULL CHECK (default_privacy_level IN ('private', 'personal', 'team', 'public')),
      created_at TEXT NOT NULL,
      CONSTRAINT fk_sources_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      CONSTRAINT unq_sources_workspace_kind_identifier
        UNIQUE (workspace_id, kind, identifier)
    )
  `,
  `
    CREATE TABLE items (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('image', 'caption', 'note', 'link', 'campaign')),
      status TEXT NOT NULL CHECK (status IN ('inbox', 'triaged', 'active', 'archived', 'retired')),
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
    )
  `,
  `
    CREATE INDEX idx_items_workspace_status_type
      ON items (workspace_id, status, type)
  `,
  `
    CREATE INDEX idx_items_workspace_updated_at
      ON items (workspace_id, updated_at)
  `,
  `
    CREATE UNIQUE INDEX unq_items_workspace_source_external
      ON items (workspace_id, source_id, source_external_id)
      WHERE source_id IS NOT NULL
  `,
  `
    CREATE TABLE items_image (
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
    )
  `,
  `
    CREATE INDEX idx_items_image_perceptual_hash
      ON items_image (perceptual_hash)
  `,
  `
    CREATE TABLE items_caption (
      item_id TEXT NOT NULL PRIMARY KEY,
      body TEXT NOT NULL,
      tone TEXT,
      cta_type TEXT,
      length_chars INTEGER,
      CONSTRAINT fk_items_caption_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `,
  `
    CREATE TABLE items_note (
      item_id TEXT NOT NULL PRIMARY KEY,
      body TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'blocknote' CHECK (format IN ('blocknote', 'markdown', 'plain')),
      CONSTRAINT fk_items_note_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `,
  `
    CREATE TABLE items_link (
      item_id TEXT NOT NULL PRIMARY KEY,
      url TEXT NOT NULL,
      og_metadata TEXT,
      content_type TEXT CHECK (content_type IS NULL OR content_type IN ('article', 'video', 'pdf', 'audio', 'unknown')),
      fetched_at TEXT,
      CONSTRAINT fk_items_link_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `,
  `
    CREATE TABLE campaign_profiles (
      item_id TEXT NOT NULL PRIMARY KEY,
      phase TEXT NOT NULL DEFAULT 'planning' CHECK (phase IN ('planning', 'live', 'wrapping', 'post_mortem')),
      channel TEXT CHECK (channel IS NULL OR channel IN ('email', 'social', 'paid', 'web', 'multi', 'other')),
      start_at TEXT,
      end_at TEXT,
      brief TEXT,
      kpi_summary TEXT,
      CONSTRAINT fk_campaign_profiles_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `,
  `
    CREATE TABLE relationship_types (
      type TEXT NOT NULL PRIMARY KEY,
      is_symmetric INTEGER NOT NULL CHECK (is_symmetric IN (0, 1)),
      description TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE relationships (
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
    )
  `,
  `
    CREATE TRIGGER trg_relationships_symmetric_ordering
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
    END
  `,
  `
    CREATE INDEX idx_relationships_workspace_from_type
      ON relationships (workspace_id, from_id, type)
  `,
  `
    CREATE INDEX idx_relationships_workspace_to_type
      ON relationships (workspace_id, to_id, type)
  `,
  `
    CREATE INDEX idx_relationships_workspace_type
      ON relationships (workspace_id, type)
  `,
  `
    CREATE TABLE tags (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
      created_by TEXT NOT NULL CHECK (created_by IN ('human', 'subagent:enrichment')),
      created_at TEXT NOT NULL,
      CONSTRAINT fk_tags_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      CONSTRAINT unq_tags_workspace_name
        UNIQUE (workspace_id, name)
    )
  `,
  `
    CREATE TABLE item_tags (
      item_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      applied_by TEXT NOT NULL CHECK (applied_by IN ('human', 'subagent:enrichment')),
      applied_at TEXT NOT NULL,
      PRIMARY KEY (item_id, tag_id),
      CONSTRAINT fk_item_tags_item
        FOREIGN KEY (item_id) REFERENCES items(id),
      CONSTRAINT fk_item_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags(id)
    )
  `,
  `
    CREATE TABLE collections (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      CONSTRAINT fk_collections_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
    )
  `,
  `
    CREATE TABLE collection_items (
      collection_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      added_by TEXT NOT NULL,
      PRIMARY KEY (collection_id, item_id),
      CONSTRAINT fk_collection_items_collection
        FOREIGN KEY (collection_id) REFERENCES collections(id),
      CONSTRAINT fk_collection_items_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `,
  `
    CREATE TABLE ai_annotations (
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
    )
  `,
  `
    CREATE INDEX idx_ai_annotations_workspace_item_field
      ON ai_annotations (workspace_id, item_id, field_name)
  `,
  `
    CREATE INDEX idx_ai_annotations_workspace_review_status_created
      ON ai_annotations (workspace_id, review_status, created_at)
  `,
  `
    CREATE TABLE item_events (
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
    )
  `,
  `
    CREATE INDEX idx_item_events_workspace_item_created
      ON item_events (workspace_id, item_id, created_at)
  `,
  `
    CREATE INDEX idx_item_events_workspace_event_type_created
      ON item_events (workspace_id, event_type, created_at)
  `,
  `
    CREATE TABLE banned_phrases (
      phrase TEXT NOT NULL PRIMARY KEY,
      added_at TEXT NOT NULL,
      added_by TEXT NOT NULL,
      reason TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE embeddings (
      item_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      model_name TEXT NOT NULL,
      model_version TEXT NOT NULL,
      vector BLOB NOT NULL,
      PRIMARY KEY (item_id, field_name, model_name, model_version),
      CONSTRAINT fk_embeddings_item
        FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `,
  `
    CREATE VIRTUAL TABLE items_fts USING fts5(
      title,
      description,
      summary,
      content='',
      tokenize='porter ascii'
    )
  `,
  `
    CREATE TRIGGER trg_items_fts_after_insert
    AFTER INSERT ON items
    BEGIN
      INSERT INTO items_fts(rowid, title, description, summary)
      VALUES (NEW.rowid, NEW.title, NEW.description, NEW.summary);
    END
  `,
  `
    CREATE TRIGGER trg_items_fts_after_update
    AFTER UPDATE OF title, description, summary ON items
    BEGIN
      INSERT INTO items_fts(items_fts, rowid, title, description, summary)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.summary);
      INSERT INTO items_fts(rowid, title, description, summary)
      VALUES (NEW.rowid, NEW.title, NEW.description, NEW.summary);
    END
  `,
  `
    CREATE TRIGGER trg_items_fts_before_delete
    BEFORE DELETE ON items
    BEGIN
      INSERT INTO items_fts(items_fts, rowid, title, description, summary)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.summary);
    END
  `,
];

const downStatements = [
  "DROP TRIGGER IF EXISTS trg_items_fts_before_delete",
  "DROP TRIGGER IF EXISTS trg_items_fts_after_update",
  "DROP TRIGGER IF EXISTS trg_items_fts_after_insert",
  "DROP TRIGGER IF EXISTS trg_relationships_symmetric_ordering",
  "DROP TABLE IF EXISTS items_fts",
  "DROP TABLE IF EXISTS embeddings",
  "DROP TABLE IF EXISTS banned_phrases",
  "DROP TABLE IF EXISTS item_events",
  "DROP TABLE IF EXISTS ai_annotations",
  "DROP TABLE IF EXISTS collection_items",
  "DROP TABLE IF EXISTS collections",
  "DROP TABLE IF EXISTS item_tags",
  "DROP TABLE IF EXISTS tags",
  "DROP TABLE IF EXISTS relationships",
  "DROP TABLE IF EXISTS relationship_types",
  "DROP TABLE IF EXISTS campaign_profiles",
  "DROP TABLE IF EXISTS items_link",
  "DROP TABLE IF EXISTS items_note",
  "DROP TABLE IF EXISTS items_caption",
  "DROP TABLE IF EXISTS items_image",
  "DROP TABLE IF EXISTS items",
  "DROP TABLE IF EXISTS sources",
  "DROP TABLE IF EXISTS workspaces",
];

migrate((ctx) => {
  runStatements(ctx, upStatements);
}, (ctx) => {
  runStatements(ctx, downStatements);
});
