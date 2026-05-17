import { chromium } from "@playwright/test";

const targetUrl = process.env.VITA_ARCHIVE_PROBE_URL ?? "http://127.0.0.1:5173/?mode=all&view=gallery";
const maxInitialImages = Number.parseInt(process.env.VITA_ARCHIVE_PROBE_MAX_IMAGES ?? "40", 10);
const maxHighPriorityImages = Number.parseInt(process.env.VITA_ARCHIVE_PROBE_MAX_HIGH_PRIORITY ?? "2", 10);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

try {
  const startedAt = Date.now();
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".pill-nav", { timeout: 8000 });
  const navReadyMs = Date.now() - startedAt;
  await page.waitForSelector(".archive-canvas", { timeout: 8000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const initial = await getArchiveProbeSnapshot(page);
  const failures = [];

  if (initial.imageCount > maxInitialImages) {
    failures.push(`initial image nodes ${initial.imageCount} exceeded ${maxInitialImages}`);
  }
  if (initial.preloadLinkCount > 0) {
    failures.push(`found ${initial.preloadLinkCount} archive preload links`);
  }
  if (initial.preloadVeilCount > 0) {
    failures.push("found archive preload veil");
  }
  if (initial.archiveGridIframeCount > 0) {
    failures.push(`found ${initial.archiveGridIframeCount} archive-grid iframes`);
  }
  if (initial.highPriorityImageCount > maxHighPriorityImages) {
    failures.push(`high priority images ${initial.highPriorityImageCount} exceeded ${maxHighPriorityImages}`);
  }

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(320);
  const afterScroll = await getArchiveProbeSnapshot(page);
  if (afterScroll.gridItemCount <= initial.gridItemCount && initial.gridItemCount < afterScroll.totalArchiveObjectCount) {
    failures.push("scroll did not materialize additional archive cards");
  }

  const summary = {
    afterScroll,
    failures,
    initial,
    navReadyMs,
    targetUrl,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function getArchiveProbeSnapshot(page) {
  return page.evaluate(() => {
    const images = Array.from(document.querySelectorAll("img.card-media__image"));
    return {
      archiveGridIframeCount: document.querySelectorAll(".app-shell--archive .item-card iframe").length,
      gridItemCount: document.querySelectorAll(".masonry-grid__item, .masonry-view__item").length,
      highPriorityImageCount: images.filter((image) => image.getAttribute("fetchpriority") === "high").length,
      imageCount: images.length,
      lazyImageCount: images.filter((image) => image.getAttribute("loading") === "lazy").length,
      preloadLinkCount: document.querySelectorAll('link[data-vita-archive-preload]').length,
      preloadVeilCount: document.querySelectorAll(".archive-preload-veil").length,
      totalArchiveObjectCount:
        Number(document.querySelector(".archive-canvas")?.getAttribute("data-total-objects") ?? "0") ||
        document.querySelectorAll(".masonry-grid__item, .masonry-view__item").length,
    };
  });
}
