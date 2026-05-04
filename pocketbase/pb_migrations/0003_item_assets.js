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
    CREATE TABLE item_assets (
      id TEXT NOT NULL PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('source_file')),
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
    )
  `,
  `
    CREATE INDEX idx_item_assets_workspace_item
      ON item_assets (workspace_id, item_id)
  `,
];

const downStatements = [
  "DROP INDEX IF EXISTS idx_item_assets_workspace_item",
  "DROP TABLE IF EXISTS item_assets",
];

migrate((ctx) => {
  runStatements(ctx, upStatements);
}, (ctx) => {
  runStatements(ctx, downStatements);
});
