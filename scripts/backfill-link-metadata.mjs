import { execFileSync } from "node:child_process";

const dbPath = process.env.VITA_PB_DB ?? "pocketbase/pb_data/data.db";
const workspaceId = process.env.VITA_WORKSPACE_ID ?? "seed:ws001";

const rows = queryJson(`
  SELECT
    item_id AS itemId,
    url,
    og_metadata AS ogMetadata
  FROM items_link
  WHERE url LIKE 'http://%' OR url LIKE 'https://%'
`);

const summary = {
  workspaceId,
  scanned: rows.length,
  updated: 0,
  skipped: 0,
  failed: 0,
  failedItems: [],
};

for (const row of rows) {
  const existing = parseMetadata(row.ogMetadata);

  if (existing.image && existing.providerName) {
    summary.skipped += 1;
    continue;
  }

  const providerMetadata = await providerLinkMetadataFor(row.url);
  if (!providerMetadata?.image) {
    summary.skipped += 1;
    continue;
  }

  const nextMetadata = compactMetadata({
    ...existing,
    ...providerMetadata,
    url: row.url,
  });

  try {
    execSql(`
      PRAGMA trusted_schema=ON;
      UPDATE items_link
      SET og_metadata = ${sqlString(JSON.stringify(nextMetadata))}
      WHERE item_id = ${sqlString(row.itemId)};

      UPDATE items
      SET title = COALESCE(NULLIF(title, ''), ${sqlString(nextMetadata.title || "")})
      WHERE workspace_id = ${sqlString(workspaceId)}
        AND id = ${sqlString(row.itemId)};
    `);
    summary.updated += 1;
  } catch (error) {
    summary.failed += 1;
    if (summary.failedItems.length < 50) {
      summary.failedItems.push({
        itemId: row.itemId,
        reason: error instanceof Error ? error.message : "metadata update failed",
      });
    }
  }
}

console.log(JSON.stringify(summary, null, 2));

function queryJson(sql) {
  const output = execFileSync("sqlite3", ["-json", dbPath, sql], { encoding: "utf8" });
  return output.trim() ? JSON.parse(output) : [];
}

function execSql(sql) {
  execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" });
}

async function providerLinkMetadataFor(value) {
  const host = hostFor(value);

  if (isPinterestHost(host) && host !== "pinimg.com" && !host.endsWith(".pinimg.com")) {
    return pinterestOembedMetadataFor(value);
  }

  if (isYouTubeHost(host)) {
    return youtubeOembedMetadataFor(value);
  }

  return null;
}

async function pinterestOembedMetadataFor(value) {
  const data = await fetchJson(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(value)}`);

  if (!data) {
    return null;
  }

  return compactMetadata({
    url: value,
    title: stringValue(data.title),
    image: stringValue(data.thumbnail_url),
    description: stringValue(data.description),
    siteName: "Pinterest",
    providerName: stringValue(data.provider_name) || "Pinterest",
  });
}

async function youtubeOembedMetadataFor(value) {
  const data = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(value)}&format=json`);
  const videoId = youtubeVideoIdFor(value);

  if (!data && !videoId) {
    return null;
  }

  return compactMetadata({
    url: value,
    title: data ? stringValue(data.title) : null,
    image: data ? stringValue(data.thumbnail_url) : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    description: data ? stringValue(data.author_name) : null,
    siteName: "YouTube",
    providerName: data ? stringValue(data.provider_name) || "YouTube" : "YouTube",
  });
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json,text/plain,*/*;q=0.8",
        "User-Agent": "VitaArchiveBot/0.1 (+https://localhost)",
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function compactMetadata(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => typeof entry === "string" ? entry.trim() : Boolean(entry)),
  );
}

function parseMetadata(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function hostFor(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isPinterestHost(host) {
  return (
    host === "pin.it" ||
    host === "pinterest.com" ||
    host.endsWith(".pinterest.com") ||
    host === "pinimg.com" ||
    host.endsWith(".pinimg.com")
  );
}

function isYouTubeHost(host) {
  return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com");
}

function youtubeVideoIdFor(value) {
  const shortMatch = value.match(/^https?:\/\/(?:www\.)?youtu\.be\/([^/?#]+)/i);
  if (shortMatch?.[1]) {
    return shortMatch[1];
  }

  const watchMatch = value.match(/[?&]v=([^&#]+)/i);
  if (watchMatch?.[1]) {
    return watchMatch[1];
  }

  const embedMatch = value.match(/\/(?:embed|shorts)\/([^/?#]+)/i);
  return embedMatch?.[1] ?? null;
}

function stringValue(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? secureRemoteMediaUrl(trimmed) : null;
}

function secureRemoteMediaUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local");

    if (url.protocol === "http:" && !isLocal) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
