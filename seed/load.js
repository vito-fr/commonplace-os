#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const minNodeMajor = 24;

const fixturePlan = [
  { file: "00_workspaces.json", table: "workspaces", conflict: ["id"] },
  { file: "01_relationship_types.json", table: "relationship_types", conflict: ["type"] },
  { file: "02_sources.json", table: "sources", conflict: ["id"] },
  { file: "03_items.json", table: "items", conflict: ["id"] },
  { file: "04_items_image.json", table: "items_image", conflict: ["item_id"] },
  { file: "05_items_caption.json", table: "items_caption", conflict: ["item_id"] },
  { file: "06_items_note.json", table: "items_note", conflict: ["item_id"] },
  { file: "07_items_link.json", table: "items_link", conflict: ["item_id"] },
  { file: "08_campaign_profiles.json", table: "campaign_profiles", conflict: ["item_id"] },
  { file: "09_tags.json", table: "tags", conflict: ["id"] },
  { file: "10_item_tags.json", table: "item_tags", conflict: ["item_id", "tag_id"] },
  { file: "11_collections.json", table: "collections", conflict: ["id"] },
  { file: "12_collection_items.json", table: "collection_items", conflict: ["collection_id", "item_id"] },
  { file: "13_relationships.json", table: "relationships", conflict: ["id"] },
  { file: "14_ai_annotations.json", table: "ai_annotations", conflict: ["id"] },
  { file: "15_item_events.json", table: "item_events", conflict: ["id"] },
  { file: "16_banned_phrases.json", table: "banned_phrases", conflict: ["phrase"] },
  { file: "17_embeddings.json", table: "embeddings", conflict: ["item_id", "field_name", "model_name", "model_version"] },
];

function usage() {
  console.log(`Usage: node seed/load.js [options]

Runtime:
  Requires Node.js ${minNodeMajor}+; uses experimental node:sqlite.

Options:
  --db <path>        PocketBase data.db path
                     default: pocketbase/pb_data/data.db
  --fixtures <path>  Fixture directory
                     default: seed/fixtures
  --dry-run          Validate fixtures and migrated target database without writing rows
  --help             Show this help
`);
}

function parseArgs(argv) {
  const options = {
    dbPath: path.join(repoRoot, "pocketbase", "pb_data", "data.db"),
    fixturesDir: path.join(repoRoot, "seed", "fixtures"),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      usage();
      process.exit(0);
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--db") {
      index += 1;
      if (!argv[index]) {
        throw new Error("--db requires a path");
      }
      options.dbPath = path.resolve(argv[index]);
      continue;
    }

    if (arg === "--fixtures") {
      index += 1;
      if (!argv[index]) {
        throw new Error("--fixtures requires a path");
      }
      options.fixturesDir = path.resolve(argv[index]);
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

function assertNodeRuntime() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isInteger(nodeMajor) || nodeMajor < minNodeMajor) {
    throw new Error(
      `Node.js ${minNodeMajor} or newer is required because seed/load.js uses experimental node:sqlite; current Node.js is ${process.version}`,
    );
  }
}

async function loadDatabaseSync() {
  try {
    const sqlite = await import("node:sqlite");
    return sqlite.DatabaseSync;
  } catch (error) {
    throw new Error(`unable to load experimental node:sqlite from ${process.version}: ${error.message}`);
  }
}

function readFixtures(fixturesDir) {
  return fixturePlan.map((entry) => {
    const fixturePath = path.join(fixturesDir, entry.file);
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`missing fixture file: ${fixturePath}`);
    }

    let rows;
    try {
      rows = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    } catch (error) {
      throw new Error(`invalid JSON in ${entry.file}: ${error.message}`);
    }

    if (!Array.isArray(rows)) {
      throw new Error(`${entry.file} must contain a JSON array`);
    }

    rows.forEach((row, rowIndex) => {
      if (!row || Array.isArray(row) || typeof row !== "object") {
        throw new Error(`${entry.file}[${rowIndex}] must be an object`);
      }
    });

    return { ...entry, rows };
  });
}

function quoteIdent(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function getTableColumns(db, table) {
  const rows = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
  if (rows.length === 0) {
    throw new Error(`table not found or has no columns: ${table}`);
  }

  return new Set(rows.map((row) => row.name));
}

function getFixtureColumns(rows) {
  const columns = [];
  const seen = new Set();

  for (const row of rows) {
    for (const column of Object.keys(row)) {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    }
  }

  return columns;
}

function validateFixtureColumns(db, fixtures) {
  for (const fixture of fixtures) {
    const tableColumns = getTableColumns(db, fixture.table);
    const fixtureColumns = getFixtureColumns(fixture.rows);

    for (const column of fixture.conflict) {
      if (!tableColumns.has(column)) {
        throw new Error(`${fixture.table} conflict column does not exist: ${column}`);
      }
    }

    for (const column of fixtureColumns) {
      if (!tableColumns.has(column)) {
        throw new Error(`${fixture.file} has unknown ${fixture.table} column: ${column}`);
      }
    }
  }
}

function validateMigrationApplied(db) {
  const migration = db
    .prepare("SELECT file FROM _migrations WHERE file = ?")
    .get("0001_initial_schema.js");

  if (!migration) {
    throw new Error("0001_initial_schema.js is not recorded in _migrations; run PocketBase migrations before loading fixtures");
  }
}

function validateFixtureIntegrity(fixtures) {
  const byTable = new Map(fixtures.map((fixture) => [fixture.table, fixture.rows]));
  const ids = (table, key) => new Set(byTable.get(table).map((row) => row[key]));
  const workspaces = ids("workspaces", "id");
  const relationshipTypes = ids("relationship_types", "type");
  const sources = ids("sources", "id");
  const items = ids("items", "id");
  const tags = ids("tags", "id");
  const collections = ids("collections", "id");

  for (const source of byTable.get("sources")) {
    requireId(workspaces, source.workspace_id, `source ${source.id} workspace_id`);
  }

  for (const item of byTable.get("items")) {
    requireId(workspaces, item.workspace_id, `item ${item.id} workspace_id`);
    requireId(sources, item.source_id, `item ${item.id} source_id`);
  }

  validateExtensions(byTable.get("items_image"), items, "image extension");
  validateExtensions(byTable.get("items_caption"), items, "caption extension");
  validateExtensions(byTable.get("items_note"), items, "note extension");
  validateExtensions(byTable.get("items_link"), items, "link extension");
  validateExtensions(byTable.get("campaign_profiles"), items, "campaign profile");

  for (const tag of byTable.get("tags")) {
    requireId(workspaces, tag.workspace_id, `tag ${tag.id} workspace_id`);
  }

  for (const link of byTable.get("item_tags")) {
    requireId(items, link.item_id, `item_tags item_id ${link.item_id}`);
    requireId(tags, link.tag_id, `item_tags tag_id ${link.tag_id}`);
  }

  for (const collection of byTable.get("collections")) {
    requireId(workspaces, collection.workspace_id, `collection ${collection.id} workspace_id`);
  }

  for (const link of byTable.get("collection_items")) {
    requireId(collections, link.collection_id, `collection_items collection_id ${link.collection_id}`);
    requireId(items, link.item_id, `collection_items item_id ${link.item_id}`);
  }

  for (const relationship of byTable.get("relationships")) {
    requireId(workspaces, relationship.workspace_id, `relationship ${relationship.id} workspace_id`);
    requireId(items, relationship.from_id, `relationship ${relationship.id} from_id`);
    requireId(items, relationship.to_id, `relationship ${relationship.id} to_id`);
    requireId(relationshipTypes, relationship.type, `relationship ${relationship.id} type`);
    if (relationship.from_id === relationship.to_id) {
      throw new Error(`relationship ${relationship.id} cannot point to itself`);
    }
    const type = byTable.get("relationship_types").find((row) => row.type === relationship.type);
    if (type.is_symmetric === 1 && relationship.from_id > relationship.to_id) {
      throw new Error(`symmetric relationship ${relationship.id} is not canonically ordered`);
    }
  }

  for (const annotation of byTable.get("ai_annotations")) {
    requireId(workspaces, annotation.workspace_id, `annotation ${annotation.id} workspace_id`);
    requireId(items, annotation.item_id, `annotation ${annotation.id} item_id`);
  }

  for (const event of byTable.get("item_events")) {
    requireId(workspaces, event.workspace_id, `event ${event.id} workspace_id`);
    requireId(items, event.item_id, `event ${event.id} item_id`);
  }

  const canaryRelationships = byTable
    .get("relationships")
    .filter((relationship) => relationship.from_id === "seed:canary" && relationship.type === "references");

  if (!items.has("seed:canary")) {
    throw new Error("missing canary item seed:canary");
  }

  if (canaryRelationships.length !== 1) {
    throw new Error(`seed:canary must have exactly one references relationship; found ${canaryRelationships.length}`);
  }
}

function requireId(ids, value, label) {
  if (!ids.has(value)) {
    throw new Error(`missing ${label}: ${value}`);
  }
}

function validateExtensions(rows, items, label) {
  for (const row of rows) {
    requireId(items, row.item_id, `${label} item_id ${row.item_id}`);
  }
}

function makeUpsertSql(table, columns, conflictColumns) {
  if (columns.length === 0) {
    return null;
  }

  const quotedTable = quoteIdent(table);
  const quotedColumns = columns.map(quoteIdent).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const quotedConflict = conflictColumns.map(quoteIdent).join(", ");
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));

  if (updateColumns.length === 0) {
    return `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT (${quotedConflict}) DO NOTHING`;
  }

  const assignments = updateColumns
    .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
    .join(", ");

  return `INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT (${quotedConflict}) DO UPDATE SET ${assignments}`;
}

function upsertFixture(db, fixture) {
  const columns = getFixtureColumns(fixture.rows);
  const sql = makeUpsertSql(fixture.table, columns, fixture.conflict);

  if (!sql) {
    return 0;
  }

  const statement = db.prepare(sql);

  for (const row of fixture.rows) {
    const values = columns.map((column) => (Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null));
    statement.run(...values);
  }

  return fixture.rows.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertNodeRuntime();
  const DatabaseSync = await loadDatabaseSync();
  const fixtures = readFixtures(options.fixturesDir);
  validateFixtureIntegrity(fixtures);

  if (!fs.existsSync(options.dbPath)) {
    throw new Error(`PocketBase data database not found: ${options.dbPath}`);
  }

  const db = new DatabaseSync(options.dbPath);

  try {
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA trusted_schema = ON");

    validateMigrationApplied(db);
    validateFixtureColumns(db, fixtures);

    if (options.dryRun) {
      report(fixtures, "validated");
      return;
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      for (const fixture of fixtures) {
        upsertFixture(db, fixture);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    report(fixtures, "loaded");
  } finally {
    db.close();
  }
}

function report(fixtures, action) {
  const total = fixtures.reduce((sum, fixture) => sum + fixture.rows.length, 0);
  for (const fixture of fixtures) {
    console.log(`${action}: ${fixture.file} -> ${fixture.table} (${fixture.rows.length})`);
  }
  console.log(`${action}: ${total} total rows`);
}

main().catch((error) => {
  console.error(`seed load failed: ${formatError(error)}`);
  process.exit(1);
});

function formatError(error) {
  if (/database is locked|SQLITE_BUSY/i.test(error.message)) {
    return `${error.message}\nStop PocketBase before running the loader against pocketbase/pb_data/data.db.`;
  }

  return error.message;
}
