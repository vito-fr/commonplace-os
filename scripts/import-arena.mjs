#!/usr/bin/env node

import http from "node:http";
import https from "node:https";

const args = parseArgs(process.argv.slice(2));
const channel = normalizeChannelInput(args.channel);
const workspaceId = args.workspace || args["workspace-id"] || "seed:ws001";
const baseUrl = normalizeBaseUrl(args["base-url"] || process.env.POCKETBASE_URL || "http://127.0.0.1:8090");

if (!channel) {
  printUsage();
  process.exit(1);
}

if (args.depth !== undefined) {
  console.error("--depth is no longer supported. Import nested channels separately with --channel <slug>.");
  process.exit(1);
}

const response = await postJson(new URL("/api/vita/import-arena", baseUrl), {
  workspace_id: workspaceId,
  channel,
});

const text = response.body;
let payload = null;
try {
  payload = text ? JSON.parse(text) : null;
} catch {
  payload = text;
}

if (!response.ok) {
  console.error(formatImportFailure(response.statusCode, payload));
  process.exit(1);
}

console.log(JSON.stringify(payload, null, 2));
printNestedChannelFollowup(payload);

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

function postJson(url, payload) {
  const body = JSON.stringify(payload);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 0,
      },
      (response) => {
        response.setEncoding("utf8");
        let responseBody = "";
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          resolve({
            body: responseBody,
            ok: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
          });
        });
      },
    );

    request.on("error", reject);
    request.setTimeout(0);
    request.end(body);
  });
}

function normalizeBaseUrl(value) {
  return String(value || "http://127.0.0.1:8090").endsWith("/") ? String(value) : `${value}/`;
}

function normalizeChannelInput(value) {
  const text = value == null ? "" : String(value).trim();
  if (!/^https?:\/\//i.test(text)) {
    return text.replace(/^@+/, "");
  }

  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    if (parts[0] === "block") {
      return "";
    }

    return decodeURIComponent(channelSlugFromUrlParts(parts) || "").trim();
  } catch {
    return text;
  }
}

function channelSlugFromUrlParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return "";
  }

  if (parts[0] === "channels" && parts[1]) {
    return parts[1];
  }

  if (parts[0] === "v3" && parts[1] === "channels" && parts[2]) {
    return parts[2];
  }

  return parts.length >= 2 ? parts[1] : parts[0];
}

function formatImportFailure(statusCode, payload) {
  const response = payload && typeof payload === "object" ? payload : null;
  const kind = response && typeof response.kind === "string" ? response.kind : "";
  const targetChannel = response && typeof response.channel === "string" ? response.channel : channel;
  const base = [`Are.na import failed${targetChannel ? ` for ${targetChannel}` : ""} (HTTP ${statusCode}).`];

  if (kind === "auth_required") {
    if (response && response.needs_api_key) {
      base.push("This channel requires an Are.na API token. ARENA_API_KEY must be set in the environment that starts PocketBase, not only in this CLI shell.");
    } else {
      base.push("The configured Are.na API token is invalid or does not have access to this channel.");
    }
  } else if (kind === "forbidden") {
    base.push("The configured Are.na API token does not have permission to read this channel.");
  } else if (kind === "not_found") {
    base.push("Are.na channel not found.");
  } else if (kind === "rate_limited") {
    base.push("Are.na rate limit hit. Try again after the retry window.");
  }

  if (response && response.arena_message) {
    base.push(`Are.na: ${response.arena_message}`);
  } else if (response && response.message) {
    base.push(String(response.message));
  }

  base.push("");
  base.push(JSON.stringify({
    error: "Are.na import failed",
    status: statusCode,
    response: payload,
  }, null, 2));
  return base.join("\n");
}

function printUsage() {
  console.error("Usage: npm run import:arena -- --channel <slug> [--workspace seed:ws001] [--base-url http://127.0.0.1:8090]");
}

function printNestedChannelFollowup(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  const nestedChannels = Array.isArray(payload.nested_channels) ? payload.nested_channels : [];
  const skippedCount = Number(payload.nested_channels_skipped) || nestedChannels.length;
  if (skippedCount <= 0) {
    return;
  }

  console.log("");
  console.log(`Skipped ${skippedCount} nested ${skippedCount === 1 ? "channel" : "channels"}:`);
  for (const nestedChannel of nestedChannels) {
    const title = nestedChannel && nestedChannel.title ? String(nestedChannel.title) : "Untitled channel";
    const slug = nestedChannel && nestedChannel.slug ? String(nestedChannel.slug) : "";
    console.log(`  - ${title}${slug ? `  (slug: ${slug})` : ""}`);
  }
  console.log("To import any of these as a separate top-level collection, run:");
  console.log("  npm run import:arena -- --channel <slug>");
}
