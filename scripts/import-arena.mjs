#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));
const channel = args.channel;
const workspaceId = args.workspace || args["workspace-id"] || "seed:ws001";
const depth = parseDepth(args.depth ?? "1");
const baseUrl = normalizeBaseUrl(args["base-url"] || process.env.POCKETBASE_URL || "http://127.0.0.1:8090");

if (!channel) {
  printUsage();
  process.exit(1);
}

const response = await fetch(new URL("/api/vita/import-arena", baseUrl), {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    workspace_id: workspaceId,
    channel,
    depth,
  }),
});

const text = await response.text();
let payload = null;
try {
  payload = text ? JSON.parse(text) : null;
} catch {
  payload = text;
}

if (!response.ok) {
  console.error(JSON.stringify({
    error: "Are.na import failed",
    status: response.status,
    response: payload,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const eqIndex = arg.indexOf("=");
    if (eqIndex > -1) {
      parsed[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }

  return parsed;
}

function normalizeBaseUrl(value) {
  return String(value || "http://127.0.0.1:8090").endsWith("/") ? String(value) : `${value}/`;
}

function parseDepth(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.error("--depth must be a non-negative integer");
    process.exit(1);
  }

  return parsed;
}

function printUsage() {
  console.error("Usage: npm run import:arena -- --channel <slug> [--workspace seed:ws001] [--depth 1] [--base-url http://127.0.0.1:8090]");
}
