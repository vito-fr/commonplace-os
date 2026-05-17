import http from "node:http";
import { chromium } from "playwright";

const pbUrl = normalizeBaseUrl(process.env.VITA_PB_URL ?? "http://127.0.0.1:8090");
const workspaceId = process.env.VITA_WORKSPACE_ID ?? "seed:ws001";
const port = Number(process.env.VITA_LINK_SCREENSHOT_PORT ?? 5178);
const maxItems = Number(process.env.VITA_LINK_SCREENSHOT_LIMIT ?? 0);
const forceRefresh = process.env.VITA_LINK_SCREENSHOT_FORCE === "1";
const mode = process.argv.includes("--serve") ? "serve" : "backfill";
const thumbnailViewportSize = 1200;
const browser = await chromium.launch();

try {
  if (mode === "serve") {
    await serve();
  } else {
    const summary = await backfill();
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  if (mode !== "serve") {
    await browser.close();
  }
}

async function serve() {
  const server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/api/link-screenshot") {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
      return;
    }

    try {
      const body = await readJson(request);
      const itemId = requiredString(body.itemId, "itemId");
      const url = normalizeHttpUrl(requiredString(body.url, "url"));
      const targetWorkspaceId = requiredString(body.workspaceId || workspaceId, "workspaceId");
      await captureAndUpload({ itemId, url, workspaceId: targetWorkspaceId });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ itemId, ok: true }));
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "screenshot failed" }));
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`link screenshot worker listening on http://127.0.0.1:${port}`);
  });
}

async function backfill() {
  const items = await listLinkItems();
  const summary = {
    workspaceId,
    scanned: items.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    failedItems: [],
  };
  let processed = 0;

  for (const item of items) {
    if (maxItems > 0 && processed >= maxItems) {
      break;
    }

    if (!item.url || item.type !== "link" || (!forceRefresh && hasLocalThumbnail(item.thumbnailUrl))) {
      summary.skipped += 1;
      continue;
    }

    processed += 1;
    try {
      await captureAndUpload({ itemId: item.id, url: item.url, workspaceId });
      summary.updated += 1;
    } catch (error) {
      summary.failed += 1;
      if (summary.failedItems.length < 50) {
        summary.failedItems.push({
          itemId: item.id,
          url: item.url,
          reason: error instanceof Error ? error.message : "screenshot failed",
        });
      }
    }
  }

  return summary;
}

async function listLinkItems() {
  const response = await fetch(`${pbUrl}api/vita/item-cards?workspace_id=${encodeURIComponent(workspaceId)}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`item-cards failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

async function captureAndUpload({ itemId, url, workspaceId }) {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: thumbnailViewportSize, height: thumbnailViewportSize },
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
    await dismissCookiePrompts(page);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.documentElement.style.scrollBehavior = "auto";
    });
    const screenshot = await page.screenshot({
      animations: "disabled",
      fullPage: false,
      quality: 78,
      scale: "css",
      type: "jpeg",
    });
    const formData = new FormData();
    const blob = new Blob([screenshot], { type: "image/jpeg" });
    formData.set("workspace_id", workspaceId);
    formData.set("item_id", itemId);
    formData.set("thumbnail_file", blob, `${safeName(itemId)}-website-${Date.now()}.jpg`);

    const response = await fetch(`${pbUrl}api/vita/item-thumbnail`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`item-thumbnail failed with HTTP ${response.status}${text ? `: ${text}` : ""}`);
    }
  } finally {
    await page.close();
  }
}

function hasLocalThumbnail(value) {
  if (typeof value !== "string" || value === "") {
    return false;
  }

  if (value.startsWith(pbUrl)) {
    return true;
  }

  return !/^(https?:|data:|blob:)/i.test(value);
}

async function dismissCookiePrompts(page) {
  const labels = [
    "Accept all",
    "Accept All",
    "Allow all",
    "I agree",
    "Got it",
    "Accept",
    "Accept required only",
    "Reject all",
    "Continue",
  ];

  for (const label of labels) {
    const button = page.getByRole("button", { name: new RegExp(`^${escapeRegex(label)}$`, "i") }).first();
    try {
      if (await button.isVisible({ timeout: 450 })) {
        await button.click({ timeout: 900 });
        await page.waitForTimeout(250);
        return;
      }
    } catch {
      // Cookie banners vary by site; failing to dismiss one should not block the thumbnail.
    }
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeHttpUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("url must be http or https");
  }
  url.hash = "";
  return url.toString();
}

function requiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "link";
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64_000) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}
