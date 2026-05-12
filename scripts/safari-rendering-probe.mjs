import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.VITA_SAFARI_PROBE_URL ?? "http://127.0.0.1:5173/?mode=items&view=masonry";
const driverUrl = process.env.SAFARI_DRIVER_URL ?? "http://127.0.0.1:4444";
const outDir = path.resolve(process.env.VITA_SAFARI_PROBE_OUT ?? "screenshots/current/safari-rendering-probe");

const cases = [
  ["baseline", ""],
  ["no-intro", "&debugDisableCardIntro=1"],
  ["no-intro-scale", "&debugNoIntroScale=1"],
  ["no-hover-transforms", "&debugDisableCardHoverTransforms=1"],
  ["no-filters", "&debugDisableCardFilters=1"],
  ["no-child-transform", "&debugNoChildTransform=1"],
  ["no-media-clip", "&debugNoMediaClip=1"],
  ["no-shadow", "&debugDisableCardShadows=1"],
  ["no-will-change", "&debugDisableCardWillChange=1"],
  ["raster-overlay", "&debugSafariRaster=1"],
  ["safari-stack", "&debugSafariCardStack=1"],
  ["clip-path", "&debugCardClipPath=1"],
];

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
    x: 20,
    y: 20,
  });

  const results = [];
  for (const [name, suffix] of cases) {
    const url = `${baseUrl}${suffix}`;
    await webdriver("POST", `/session/${sessionId}/url`, { url });
    await sleep(180);
    const early = await execute(sessionId, collectProbeState);
    await saveScreenshot(sessionId, path.join(outDir, `${name}-early.png`));
    await sleep(2600);
    const settled = await execute(sessionId, collectProbeState);
    await saveScreenshot(sessionId, path.join(outDir, `${name}-settled.png`));
    results.push({ name, url, early, settled });
  }

  await fs.writeFile(path.join(outDir, "probe-results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ outDir, summary: summarizeResults(results) }, null, 2));
} finally {
  await webdriver("DELETE", `/session/${sessionId}`).catch(() => null);
}

async function saveScreenshot(sessionId, filePath) {
  const response = await webdriver("GET", `/session/${sessionId}/screenshot`);
  const base64 = response.value ?? response;
  await fs.writeFile(filePath, Buffer.from(base64, "base64"));
}

async function execute(sessionId, fn) {
  const response = await webdriver("POST", `/session/${sessionId}/execute/sync`, {
    script: `return (${fn})();`,
    args: [],
  });
  return response;
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

function collectProbeState() {
  const round = (value) => Math.round(value * 1000) / 1000;
  const serializeRect = (rect) => ({
    bottom: round(rect.bottom),
    height: round(rect.height),
    left: round(rect.left),
    right: round(rect.right),
    top: round(rect.top),
    width: round(rect.width),
  });
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const visibleItems = Array.from(document.querySelectorAll(".masonry-view__item"))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const motion = element.querySelector(".masonry-view__motion");
      const media = element.querySelector(".item-card__content, .collection-card__cover");
      const mediaRect = media?.getBoundingClientRect();
      const animation = motion ? getComputedStyle(motion) : null;
      const mediaStyle = media ? getComputedStyle(media) : null;
      return {
        key: element.getAttribute("data-archive-key"),
        rect: serializeRect(rect),
        mediaRect: mediaRect ? serializeRect(mediaRect) : null,
        entryCard: element.getAttribute("data-entry-card"),
        introState: motion?.getAttribute("data-intro-state") ?? null,
        animationName: animation?.animationName ?? null,
        animationDelay: animation?.animationDelay ?? null,
        animationDuration: animation?.animationDuration ?? null,
        mediaClip: mediaStyle
          ? {
              borderRadius: mediaStyle.borderRadius,
              isolation: mediaStyle.isolation,
              overflow: mediaStyle.overflow,
              position: mediaStyle.position,
              zIndex: mediaStyle.zIndex,
              clipPath: mediaStyle.clipPath,
              transform: mediaStyle.transform,
            }
          : null,
      };
    })
    .filter((item) => item.rect.bottom > 0 && item.rect.top < viewportHeight && item.rect.right > 0 && item.rect.left < viewportWidth);

  const fractional = visibleItems
    .flatMap((item) => [
      { key: item.key, layer: "item", rect: item.rect },
      item.mediaRect ? { key: item.key, layer: "media", rect: item.mediaRect } : null,
    ])
    .filter(Boolean)
    .filter(({ rect }) => [rect.top, rect.left, rect.width, rect.height].some((value) => Math.abs(value - Math.round(value)) > 0.01));

  return {
    href: location.href,
    dpr: window.devicePixelRatio,
    viewportWidth,
    viewportHeight,
    visibleCount: visibleItems.length,
    introActiveCount: visibleItems.filter((item) => item.introState === "active").length,
    introSettledCount: visibleItems.filter((item) => item.introState === "settled").length,
    skippedIntroVisibleCount: visibleItems.filter((item) => !item.entryCard).length,
    firstVisible: visibleItems.slice(0, 16),
    fractionalCount: fractional.length,
    fractional: fractional.slice(0, 16),
  };
}

function summarizeResults(results) {
  return results.map((result) => ({
    name: result.name,
    url: result.url,
    earlyFractionalCount: result.early.fractionalCount,
    earlyIntroActiveCount: result.early.introActiveCount,
    settledFractionalCount: result.settled.fractionalCount,
    settledIntroActiveCount: result.settled.introActiveCount,
    skippedIntroVisibleCount: result.settled.skippedIntroVisibleCount,
    firstSettledClip: result.settled.firstVisible?.[0]?.mediaClip ?? null,
  }));
}
