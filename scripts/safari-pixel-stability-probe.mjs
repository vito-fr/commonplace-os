import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const baseUrl = process.env.VITA_SAFARI_PIXEL_URL ?? "http://127.0.0.1:5173/?mode=items&view=masonry";
const driverUrl = process.env.SAFARI_DRIVER_URL ?? "http://127.0.0.1:4444";
const outDir = path.resolve(process.env.VITA_SAFARI_PIXEL_OUT ?? "screenshots/current/safari-pixel-stability-probe");

await fs.mkdir(outDir, { recursive: true });

const session = await webdriver("POST", "/session", {
  capabilities: {
    alwaysMatch: {
      browserName: "safari",
    },
  },
});

const sessionId = session.sessionId ?? session.value?.sessionId;
if (!sessionId) {
  throw new Error(`Unable to create Safari session: ${JSON.stringify(session)}`);
}

try {
  await webdriver("POST", `/session/${sessionId}/window/rect`, {
    width: 1440,
    height: 1100,
    x: 40,
    y: 40,
  });

  await webdriver("POST", `/session/${sessionId}/url`, { url: baseUrl });
  await sleep(2200);

  const target = await execute(sessionId, collectPixelTarget);
  const states = [];

  states.push(await capturePair(sessionId, "idle", target));

  await pointerMove(sessionId, target.hoverPoint.x, target.hoverPoint.y);
  await sleep(720);
  states.push(await capturePair(sessionId, "hover", target));

  await pointerMove(sessionId, target.selectCenter.x, target.selectCenter.y);
  await click(sessionId);
  await sleep(720);
  states.push(await capturePair(sessionId, "selected", target));

  await pointerMove(sessionId, target.moreCenter.x, target.moreCenter.y);
  await click(sessionId);
  await sleep(720);
  states.push(await capturePair(sessionId, "menu-open", target));

  const result = {
    outDir,
    url: baseUrl,
    target,
    states,
  };
  await fs.writeFile(path.join(outDir, "pixel-stability-results.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await webdriver("DELETE", `/session/${sessionId}`).catch(() => null);
}

async function capturePair(sessionId, name, target) {
  const first = await captureScreenshot(sessionId, path.join(outDir, `${name}-a.png`));
  await sleep(260);
  const second = await captureScreenshot(sessionId, path.join(outDir, `${name}-b.png`));
  const comparison = compareScreenshotCrop(first, second, target.crop, target.viewport);
  return {
    name,
    files: {
      first: path.join(outDir, `${name}-a.png`),
      second: path.join(outDir, `${name}-b.png`),
    },
    comparison,
  };
}

async function captureScreenshot(sessionId, filePath) {
  const response = await webdriver("GET", `/session/${sessionId}/screenshot`);
  const base64 = response.value ?? response;
  const buffer = Buffer.from(base64, "base64");
  await fs.writeFile(filePath, buffer);
  return decodePng(buffer);
}

async function pointerMove(sessionId, x, y) {
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [{ type: "pointerMove", duration: 0, origin: "viewport", x: Math.round(x), y: Math.round(y) }],
      },
    ],
  });
}

async function click(sessionId) {
  await webdriver("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 40 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

async function execute(sessionId, fn, args = []) {
  return webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `return (${fn}).apply(null, arguments);`,
    args,
  });
}

async function webdriver(method, endpoint, body) {
  const response = await fetch(`${driverUrl}${endpoint}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: ${text}`);
  }
  return payload.value ?? payload;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectPixelTarget() {
  const round = (value) => Math.round(value * 1000) / 1000;
  const serializeRect = (rect) => ({
    bottom: round(rect.bottom),
    height: round(rect.height),
    left: round(rect.left),
    right: round(rect.right),
    top: round(rect.top),
    width: round(rect.width),
  });
  const cards = Array.from(document.querySelectorAll(".masonry-view__item .item-card"))
    .map((card) => {
      const item = card.closest(".masonry-view__item");
      const rect = item?.getBoundingClientRect();
      const media = card.querySelector(".item-card__content");
      return { card, item, media, rect };
    })
    .filter(({ card, media, rect }) => {
      if (!rect || !media) return false;
      const hasControls = card.querySelector(".item-card__select") && card.querySelector(".item-card__action-cell--more");
      return hasControls && rect.bottom > 80 && rect.top < window.innerHeight && rect.width > 140 && rect.height > 160;
    });
  const picked = cards.find(({ media }) => media.querySelector("img")) ?? cards[0];
  if (!picked) {
    throw new Error("No visible item card target found for Safari pixel probe");
  }

  const targetRect = picked.item.getBoundingClientRect();
  const selectRect = picked.card.querySelector(".item-card__select").getBoundingClientRect();
  const moreRect = picked.card.querySelector(".item-card__action-cell--more").getBoundingClientRect();
  const cropPad = 28;
  const crop = {
    left: Math.max(0, targetRect.left - cropPad),
    top: Math.max(0, targetRect.top - cropPad),
    width: Math.min(window.innerWidth, targetRect.right + cropPad) - Math.max(0, targetRect.left - cropPad),
    height: Math.min(window.innerHeight, targetRect.bottom + cropPad) - Math.max(0, targetRect.top - cropPad),
  };

  return {
    href: location.href,
    dpr: window.devicePixelRatio,
    key: picked.item.getAttribute("data-archive-key"),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      visualScale: window.visualViewport?.scale ?? null,
    },
    targetRect: serializeRect(targetRect),
    crop,
    hoverPoint: {
      x: round(targetRect.left + targetRect.width / 2),
      y: round(targetRect.top + Math.min(120, targetRect.height / 2)),
    },
    selectCenter: {
      x: round(selectRect.left + selectRect.width / 2),
      y: round(selectRect.top + selectRect.height / 2),
    },
    moreCenter: {
      x: round(moreRect.left + moreRect.width / 2),
      y: round(moreRect.top + moreRect.height / 2),
    },
  };
}

function compareScreenshotCrop(first, second, cssCrop, viewport) {
  if (first.width !== second.width || first.height !== second.height) {
    throw new Error(`Screenshot sizes differ: ${first.width}x${first.height} vs ${second.width}x${second.height}`);
  }

  const scaleX = first.width / viewport.width;
  const scaleY = first.height / viewport.height;
  const crop = {
    left: Math.max(0, Math.floor(cssCrop.left * scaleX)),
    top: Math.max(0, Math.floor(cssCrop.top * scaleY)),
    right: Math.min(first.width, Math.ceil((cssCrop.left + cssCrop.width) * scaleX)),
    bottom: Math.min(first.height, Math.ceil((cssCrop.top + cssCrop.height) * scaleY)),
  };
  const width = Math.max(0, crop.right - crop.left);
  const height = Math.max(0, crop.bottom - crop.top);
  const threshold = 24;
  let changedPixels = 0;
  let totalDelta = 0;
  let maxDelta = 0;
  let totalPixels = 0;
  let changedBounds = null;

  for (let y = crop.top; y < crop.bottom; y += 1) {
    for (let x = crop.left; x < crop.right; x += 1) {
      const a = getRgb(first, x, y);
      const b = getRgb(second, x, y);
      const delta = Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
      totalPixels += 1;
      totalDelta += delta;
      maxDelta = Math.max(maxDelta, delta);
      if (delta > threshold) {
        changedPixels += 1;
        changedBounds = changedBounds
          ? {
              left: Math.min(changedBounds.left, x),
              top: Math.min(changedBounds.top, y),
              right: Math.max(changedBounds.right, x),
              bottom: Math.max(changedBounds.bottom, y),
            }
          : { left: x, top: y, right: x, bottom: y };
      }
    }
  }

  return {
    crop,
    cropSize: { width, height },
    totalPixels,
    changedPixels,
    changedPercent: totalPixels ? Math.round((changedPixels / totalPixels) * 100000) / 1000 : 0,
    meanDelta: totalPixels ? Math.round((totalDelta / totalPixels) * 1000) / 1000 : 0,
    maxDelta,
    changedBounds,
  };
}

function decodePng(buffer) {
  const signature = buffer.subarray(0, 8);
  if (!signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("Unsupported screenshot format: not PNG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || interlace !== 0) {
    throw new Error(`Unsupported PNG settings: bitDepth=${bitDepth}, interlace=${interlace}`);
  }

  const channels = getPngChannels(colorType);
  const rowBytes = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * channels);
  let inOffset = 0;
  let outOffset = 0;
  let previous = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inOffset++];
    const row = Buffer.from(inflated.subarray(inOffset, inOffset + rowBytes));
    inOffset += rowBytes;
    unfilterRow(row, previous, channels, filter);
    row.copy(pixels, outOffset);
    previous = row;
    outOffset += rowBytes;
  }

  return { width, height, colorType, channels, pixels };
}

function getPngChannels(colorType) {
  if (colorType === 6) return 4;
  if (colorType === 2) return 3;
  if (colorType === 0) return 1;
  if (colorType === 4) return 2;
  throw new Error(`Unsupported PNG color type ${colorType}`);
}

function unfilterRow(row, previous, bytesPerPixel, filter) {
  for (let x = 0; x < row.length; x += 1) {
    const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
    const up = previous[x] ?? 0;
    const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
    if (filter === 1) {
      row[x] = (row[x] + left) & 0xff;
    } else if (filter === 2) {
      row[x] = (row[x] + up) & 0xff;
    } else if (filter === 3) {
      row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filter === 4) {
      row[x] = (row[x] + paeth(left, up, upLeft)) & 0xff;
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG row filter ${filter}`);
    }
  }
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function getRgb(image, x, y) {
  const offset = (y * image.width + x) * image.channels;
  if (image.colorType === 0) {
    const gray = image.pixels[offset];
    return { r: gray, g: gray, b: gray };
  }
  return {
    r: image.pixels[offset],
    g: image.pixels[offset + 1],
    b: image.pixels[offset + 2],
  };
}
