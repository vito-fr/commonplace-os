/// <reference path="../pb_data/types.d.ts" />

// Personal archive pivot. See docs/decisions/0006-personal-archive-pivot.md.
//
// Drops campaigns as an item type, narrows the lifecycle to active and
// archived, removes the retired_by relationship type, and clears all
// campaign-derived rows. Existing data is mapped:
//
//   - items.type = 'campaign'              -> deleted (with all dependents)
//   - items.status in ('inbox', 'triaged') -> 'active'
//   - items.status = 'retired'             -> 'archived'
//
// This migration is destructive. The down() restores the schema shape only;
// it cannot recover deleted data.

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
  // 1. Cascade-delete campaign-derived rows while foreign keys are still on.
  `DELETE FROM relationships
     WHERE from_id IN (SELECT id FROM items WHERE type = 'campaign')
        OR to_id IN (SELECT id FROM items WHERE type = 'campaign')`,
  `DELETE FROM relationships WHERE type = 'retired_by'`,
  `DELETE FROM item_tags
     WHERE item_id IN (SELECT id FROM items WHERE type = 'campaign')`,
  `DELETE FROM collection_items
     WHERE item_id IN (SELECT id FROM items WHERE type = 'campaign')`,
  `DELETE FROM ai_annotations
     WHERE item_id IN (SELECT id FROM items WHERE type = 'campaign')`,
  `DELETE FROM item_events
     WHERE item_id IN (SELECT id FROM items WHERE type = 'campaign')`,
  `DELETE FROM embeddings
     WHERE item_id IN (SELECT id FROM items WHERE type = 'campaign')`,
  `DELETE FROM campaign_profiles`,
  `DELETE FROM items WHERE type = 'campaign'`,

  // 2. Retire the retired_by relationship type.
  `DELETE FROM relationship_types WHERE type = 'retired_by'`,

  // 3. Map surviving items to the new lifecycle.
  `UPDATE items SET status = 'active' WHERE status IN ('inbox', 'triaged')`,
  `UPDATE items SET status = 'archived' WHERE status = 'retired'`,

  // 4. Drop the campaign extension table.
  "DROP TABLE IF EXISTS campaign_profiles",

  // 5. Rebuild items with the narrowed type and status check constraints.
  // SQLite cannot alter a CHECK constraint in place, so the table is rebuilt.
  // Foreign keys are disabled while the table is swapped under child tables.
  "PRAGMA foreign_keys = OFF",

  "DROP TRIGGER IF EXISTS trg_items_fts_before_delete",
  "DROP TRIGGER IF EXISTS trg_items_fts_after_update",
  "DROP TRIGGER IF EXISTS trg_items_fts_after_insert",
  "DROP INDEX IF EXISTS unq_items_workspace_source_external",
  "DROP INDEX IF EXISTS idx_items_workspace_updated_at",
  "DROP INDEX IF EXISTS idx_items_workspace_status_type",

  `CREATE TABLE items_new (
    id TEXT NOT NULL PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'caption', 'note', 'link')),
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
  )`,

  `INSERT INTO items_new (
    id, workspace_id, type, status, title, description, summary,
    source_id, source_external_id, privacy_level,
    rights_status, rights_note, rights_reviewed_at,
    update_count, created_at, updated_at
  )
  SELECT
    id, workspace_id, type, status, title, description, summary,
    source_id, source_external_id, privacy_level,
    rights_status, rights_note, rights_reviewed_at,
    update_count, created_at, updated_at
  FROM items`,

  "DROP TABLE items",
  "ALTER TABLE items_new RENAME TO items",

  `CREATE INDEX idx_items_workspace_status_type
     ON items (workspace_id, status, type)`,
  `CREATE INDEX idx_items_workspace_updated_at
     ON items (workspace_id, updated_at)`,
  `CREATE UNIQUE INDEX unq_items_workspace_source_external
     ON items (workspace_id, source_id, source_external_id)
     WHERE source_id IS NOT NULL`,

  // 6. Rebuild FTS rows and triggers; rowids changed when the table was rebuilt.
  "DELETE FROM items_fts",
  `INSERT INTO items_fts(rowid, title, description, summary)
     SELECT rowid, title, description, summary FROM items`,

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

  "PRAGMA foreign_keys = ON",
];

// Restores the schema shape only. Deleted campaign rows and retired/inbox/triaged
// status values cannot be recovered from this migration; restore from a backup.
const downStatements = [
  "PRAGMA foreign_keys = OFF",

  "DROP TRIGGER IF EXISTS trg_items_fts_before_delete",
  "DROP TRIGGER IF EXISTS trg_items_fts_after_update",
  "DROP TRIGGER IF EXISTS trg_items_fts_after_insert",
  "DROP INDEX IF EXISTS unq_items_workspace_source_external",
  "DROP INDEX IF EXISTS idx_items_workspace_updated_at",
  "DROP INDEX IF EXISTS idx_items_workspace_status_type",

  `CREATE TABLE items_old (
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
  )`,

  `INSERT INTO items_old (
    id, workspace_id, type, status, title, description, summary,
    source_id, source_external_id, privacy_level,
    rights_status, rights_note, rights_reviewed_at,
    update_count, created_at, updated_at
  )
  SELECT
    id, workspace_id, type, status, title, description, summary,
    source_id, source_external_id, privacy_level,
    rights_status, rights_note, rights_reviewed_at,
    update_count, created_at, updated_at
  FROM items`,

  "DROP TABLE items",
  "ALTER TABLE items_old RENAME TO items",

  `CREATE INDEX idx_items_workspace_status_type
     ON items (workspace_id, status, type)`,
  `CREATE INDEX idx_items_workspace_updated_at
     ON items (workspace_id, updated_at)`,
  `CREATE UNIQUE INDEX unq_items_workspace_source_external
     ON items (workspace_id, source_id, source_external_id)
     WHERE source_id IS NOT NULL`,

  "DELETE FROM items_fts",
  `INSERT INTO items_fts(rowid, title, description, summary)
     SELECT rowid, title, description, summary FROM items`,

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

  `CREATE TABLE IF NOT EXISTS campaign_profiles (
    item_id TEXT NOT NULL PRIMARY KEY,
    phase TEXT NOT NULL DEFAULT 'planning' CHECK (phase IN ('planning', 'live', 'wrapping', 'post_mortem')),
    channel TEXT CHECK (channel IS NULL OR channel IN ('email', 'social', 'paid', 'web', 'multi', 'other')),
    start_at TEXT,
    end_at TEXT,
    brief TEXT,
    kpi_summary TEXT,
    CONSTRAINT fk_campaign_profiles_item
      FOREIGN KEY (item_id) REFERENCES items(id)
  )`,

  `INSERT OR IGNORE INTO relationship_types (type, is_symmetric, description)
     VALUES ('retired_by', 0, 'asserts that the to-item supersedes the from-item')`,

  "PRAGMA foreign_keys = ON",
];

migrate((ctx) => {
  runStatements(ctx, upStatements);
}, (ctx) => {
  runStatements(ctx, downStatements);
});
