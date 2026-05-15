/// <reference path="../pb_data/types.d.ts" />

// Allows collections to reference other collections without making the archive
// folder-first. See docs/decisions/0008-collections-may-reference-other-collections.md.

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
    CREATE TABLE collection_relationships (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      parent_collection_id TEXT NOT NULL,
      child_collection_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL,
      added_by TEXT NOT NULL,
      CONSTRAINT fk_collection_relationships_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
      CONSTRAINT fk_collection_relationships_parent
        FOREIGN KEY (parent_collection_id) REFERENCES collections(id),
      CONSTRAINT fk_collection_relationships_child
        FOREIGN KEY (child_collection_id) REFERENCES collections(id),
      CONSTRAINT chk_collection_relationships_not_self
        CHECK (parent_collection_id != child_collection_id),
      CONSTRAINT unq_collection_relationships_parent_child
        UNIQUE (workspace_id, parent_collection_id, child_collection_id)
    )
  `,
  `
    CREATE INDEX idx_collection_relationships_parent
      ON collection_relationships (workspace_id, parent_collection_id, position)
  `,
  `
    CREATE INDEX idx_collection_relationships_child
      ON collection_relationships (workspace_id, child_collection_id)
  `,
];

const downStatements = [
  "DROP INDEX IF EXISTS idx_collection_relationships_child",
  "DROP INDEX IF EXISTS idx_collection_relationships_parent",
  "DROP TABLE IF EXISTS collection_relationships",
];

migrate((ctx) => {
  runStatements(ctx, upStatements);
}, (ctx) => {
  runStatements(ctx, downStatements);
});
