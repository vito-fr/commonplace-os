import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const widths = [1440, 1024, 390];
const appUrl = process.env.VITA_VISUAL_QA_URL ?? "http://localhost:5173/items/seed%3Aimg004";
const shouldCaptureRefs = process.argv.includes("--refs");
const currentDir = path.resolve("screenshots/current");
const referenceDir = path.resolve("screenshots/reference");

const referenceTargets = [
  { name: "austen", url: "https://austen.fun/" },
  { name: "tinloof-arc-prize", url: "https://tinloof.com/work/arc-prize" },
];

await mkdir(currentDir, { recursive: true });
if (shouldCaptureRefs) {
  await mkdir(referenceDir, { recursive: true });
}

const browser = await chromium.launch();

try {
  await captureTarget({
    browser,
    dir: currentDir,
    name: "item-detail",
    url: appUrl,
    widths,
    waitFor: ".item-detail",
  });

  if (shouldCaptureRefs) {
    for (const target of referenceTargets) {
      await captureTarget({
        browser,
        dir: referenceDir,
        name: target.name,
        url: target.url,
        widths,
      });
    }
  }
} finally {
  await browser.close();
}

async function captureTarget({ browser, dir, name, url, widths: targetWidths, waitFor }) {
  for (const width of targetWidths) {
    const page = await browser.newPage({
      viewport: { width, height: width <= 480 ? 920 : 900 },
      deviceScaleFactor: 1,
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 15_000 });
      }
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(900);

      const filePath = path.join(dir, `${name}-${width}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`${filePath}`);

      if (name === "item-detail" && width === 1440) {
        await page.keyboard.press("r");
        await page.waitForTimeout(120);
        const closingEarlyPath = path.join(dir, `${name}-${width}-panel-closing-120ms.png`);
        await page.screenshot({ path: closingEarlyPath, fullPage: false });
        console.log(`${closingEarlyPath}`);

        await page.waitForTimeout(180);
        const closingMidPath = path.join(dir, `${name}-${width}-panel-closing-300ms.png`);
        await page.screenshot({ path: closingMidPath, fullPage: false });
        console.log(`${closingMidPath}`);

        await page.waitForTimeout(350);
        const closedPath = path.join(dir, `${name}-${width}-panel-closed.png`);
        await page.screenshot({ path: closedPath, fullPage: false });
        console.log(`${closedPath}`);

        await page.hover(".item-detail__panel-toggle");
        await page.waitForTimeout(260);
        const hoverPath = path.join(dir, `${name}-${width}-panel-closed-hover.png`);
        await page.screenshot({ path: hoverPath, fullPage: false });
        console.log(`${hoverPath}`);

        await page.keyboard.press("r");
        await page.waitForTimeout(120);
        const openingEarlyPath = path.join(dir, `${name}-${width}-panel-opening-120ms.png`);
        await page.screenshot({ path: openingEarlyPath, fullPage: false });
        console.log(`${openingEarlyPath}`);

        await page.waitForTimeout(180);
        const openingMidPath = path.join(dir, `${name}-${width}-panel-opening-300ms.png`);
        await page.screenshot({ path: openingMidPath, fullPage: false });
        console.log(`${openingMidPath}`);

        await page.waitForTimeout(350);
        const reopenedPath = path.join(dir, `${name}-${width}-panel-open-restored.png`);
        await page.screenshot({ path: reopenedPath, fullPage: false });
        console.log(`${reopenedPath}`);
      }
    } finally {
      await page.close();
    }
  }
}
