import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.VITA_SAFARI_PROBE_URL ?? "http://127.0.0.1:5173/?mode=items&view=masonry";
const collectionUrl = process.env.VITA_SAFARI_COLLECTION_PROBE_URL ?? getCollectionProbeUrl(baseUrl);
const detailUrl = process.env.VITA_SAFARI_DETAIL_PROBE_URL ?? new URL("/items/seed%3Aimg004?debugSafariRaster=1", baseUrl).toString();
const settingsUrl = process.env.VITA_SAFARI_SETTINGS_PROBE_URL ?? new URL("/?mode=items&view=masonry&debugSafariRaster=1", baseUrl).toString();
const driverUrl = process.env.SAFARI_DRIVER_URL ?? "http://127.0.0.1:4444";
const outDir = path.resolve(process.env.VITA_SAFARI_INTERACTION_OUT ?? "screenshots/current/safari-card-interaction-probe");

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
    x: 30,
    y: 30,
  });

  await webdriver("POST", `/session/${sessionId}/url`, { url: baseUrl });
  await sleep(1900);

  const idle = await execute(sessionId, collectInteractionState, ["item"]);
  await saveScreenshot(sessionId, path.join(outDir, "idle.png"));

  await pointerMove(sessionId, idle.target.center.x, idle.target.center.y);
  await execute(sessionId, focusControl, ["item", ".item-card__action-cell--more"]);
  await sleep(700);
  const hover = await execute(sessionId, collectInteractionState, ["item"]);
  await saveScreenshot(sessionId, path.join(outDir, "hover.png"));

  const selectCenter = await execute(sessionId, getControlCenter, ["item", ".item-card__select"]);
  await pointerMove(sessionId, selectCenter.x, selectCenter.y);
  await execute(sessionId, clickControl, ["item", ".item-card__select"]);
  await sleep(700);
  const selected = await execute(sessionId, collectInteractionState, ["item"]);
  await saveScreenshot(sessionId, path.join(outDir, "selected.png"));

  await pointerMove(sessionId, selected.target.center.x, selected.target.center.y);
  await sleep(700);
  const selectedHover = await execute(sessionId, collectInteractionState, ["item"]);
  await saveScreenshot(sessionId, path.join(outDir, "selected-hover.png"));

  const moreCenter = await execute(sessionId, getControlCenter, ["item", ".item-card__action-cell--more"]);
  await pointerMove(sessionId, moreCenter.x, moreCenter.y);
  await click(sessionId);
  await sleep(700);
  const menu = await execute(sessionId, collectInteractionState, ["item"]);
  await saveScreenshot(sessionId, path.join(outDir, "menu-open.png"));

  await webdriver("POST", `/session/${sessionId}/url`, { url: collectionUrl });
  await sleep(1900);

  const collectionIdle = await execute(sessionId, collectInteractionState, ["collection"]);
  await saveScreenshot(sessionId, path.join(outDir, "collection-idle.png"));

  await pointerMove(sessionId, collectionIdle.target.center.x, collectionIdle.target.center.y);
  await execute(sessionId, focusControl, ["collection", ".collection-card__action-cell--more"]);
  await sleep(700);
  const collectionHover = await execute(sessionId, collectInteractionState, ["collection"]);
  await saveScreenshot(sessionId, path.join(outDir, "collection-hover.png"));

  await webdriver("POST", `/session/${sessionId}/url`, { url: detailUrl });
  await sleep(1600);
  const detailOpen = await execute(sessionId, collectPageControlState, ["detail-open"]);
  await saveScreenshot(sessionId, path.join(outDir, "item-detail-open.png"));
  await execute(sessionId, clickFirstPageControl, [".item-detail__panel-toggle"]);
  await sleep(320);
  const detailClosed = await execute(sessionId, collectPageControlState, ["detail-closed"]);
  await saveScreenshot(sessionId, path.join(outDir, "item-detail-closed.png"));

  await webdriver("POST", `/session/${sessionId}/url`, { url: settingsUrl });
  await sleep(1200);
  await execute(sessionId, clickButtonByText, ["Settings"]);
  await sleep(420);
  await execute(sessionId, clickButtonByText, ["Shortcuts"]);
  await sleep(180);
  const settingsOpen = await execute(sessionId, collectPageControlState, ["settings-open"]);
  await saveScreenshot(sessionId, path.join(outDir, "settings-shortcuts.png"));

  const result = {
    outDir,
    idle,
    hover,
    selected,
    selectedHover,
    menu,
    collectionIdle,
    collectionHover,
    detailOpen,
    detailClosed,
    settingsOpen,
    deltas: {
      hover: rectDelta(idle.target.rect, hover.target.rect),
      selected: rectDelta(hover.target.rect, selected.target.rect),
      selectedHover: rectDelta(selected.target.rect, selectedHover.target.rect),
      menu: rectDelta(idle.target.rect, menu.target.rect),
      collectionHover: rectDelta(collectionIdle.target.rect, collectionHover.target.rect),
    },
    interactiveDeltas: {
      hover: compareInteractiveRects(idle.interactive, hover.interactive),
      selected: compareInteractiveRects(hover.interactive, selected.interactive),
      selectedHover: compareInteractiveRects(selected.interactive, selectedHover.interactive),
      menu: compareInteractiveRects(hover.interactive, menu.interactive),
      collectionHover: compareInteractiveRects(collectionIdle.interactive, collectionHover.interactive),
      detailPanel: compareInteractiveRects(detailOpen.interactive, detailClosed.interactive),
    },
  };
  await fs.writeFile(path.join(outDir, "probe-results.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await webdriver("DELETE", `/session/${sessionId}`).catch(() => null);
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

async function saveScreenshot(sessionId, filePath) {
  const response = await webdriver("GET", `/session/${sessionId}/screenshot`);
  await fs.writeFile(filePath, Buffer.from(response, "base64"));
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

function getCollectionProbeUrl(url) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("mode", "collections");
  nextUrl.searchParams.set("view", "masonry");
  return nextUrl.toString();
}

function collectInteractionState(kind = "item") {
  const round = (value) => Math.round(value * 1000) / 1000;
  const serializeRect = (rect) => ({
    bottom: round(rect.bottom),
    height: round(rect.height),
    left: round(rect.left),
    right: round(rect.right),
    top: round(rect.top),
    width: round(rect.width),
  });
  const hasFractionalRect = (rect) =>
    [rect.top, rect.left, rect.width, rect.height].some((value) => Math.abs(value - Math.round(value)) > 0.01);
  const collectPseudoStyle = (element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return {
      background: style.backgroundColor,
      border: style.border,
      height: style.height,
      opacity: style.opacity,
      transform: style.transform,
      width: style.width,
    };
  };
  const collectInteractiveElements = (card) => {
    const selectors = [
      [".item-card__actions", "actions"],
      [".item-card__more-control", "more-wrapper"],
      [".item-card__action-cell", "action-button"],
      [".item-card__select", "select-button"],
      [".item-card__select span", "select-indicator"],
      [".item-card__dots-icon", "more-svg"],
      [".item-card__plus-icon", "plus-svg"],
      [".item-card__more-menu", "more-menu"],
      [".item-card__menu-action", "menu-action"],
      [".item-card__menu-icon", "menu-icon"],
      [".item-card__frame-tags", "frame-tags"],
      [".item-card__frame-tag", "frame-tag"],
      [".collection-card__frame-tags", "collection-frame-tags"],
      [".collection-card__frame-tag", "collection-frame-tag"],
      [".collection-card__title-text", "collection-title-text"],
      [".collection-card__title-time", "collection-title-time"],
      [".card-glyph", "card-glyph"],
      [".collection-card__actions", "collection-actions"],
      [".collection-card__action-cell", "collection-action-button"],
      [".collection-card__more-control", "collection-more-wrapper"],
      ["svg", "svg"],
      ["kbd", "shortcut"],
    ];

    return selectors.flatMap(([selector, label]) =>
      Array.from(card.querySelectorAll(selector)).map((element, index) => {
        const rect = serializeRect(element.getBoundingClientRect());
        const style = getComputedStyle(element);
        const svg = element instanceof SVGSVGElement ? element : element.querySelector?.("svg");
        const strokeElement = svg?.querySelector?.("[stroke-width], path, circle, polyline, line");
        const strokeWidth =
          strokeElement instanceof SVGElement
            ? getComputedStyle(strokeElement).strokeWidth || strokeElement.getAttribute("stroke-width")
            : null;

        return {
          id: `${label}:${index}`,
          selector,
          label,
          rect,
          fractional: hasFractionalRect(rect),
          transform: style.transform,
          opacity: style.opacity,
          filter: style.filter,
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter || "none",
          background: style.backgroundColor,
          willChange: style.willChange,
          borderRadius: style.borderRadius,
          overflow: style.overflow,
          contain: style.contain,
          viewBox: svg?.getAttribute?.("viewBox") ?? null,
          svgWidth: svg ? serializeRect(svg.getBoundingClientRect()).width : null,
          svgHeight: svg ? serializeRect(svg.getBoundingClientRect()).height : null,
          strokeWidth,
          pseudoBefore: selector === ".item-card__select span" ? collectPseudoStyle(element, "::before") : null,
          pseudoAfter: selector === ".item-card__select span" ? collectPseudoStyle(element, "::after") : null,
        };
      }),
    );
  };
  const cardSelector =
    kind === "collection" ? ".masonry-view__item .collection-card:not(.collection-card--create)" : ".masonry-view__item .item-card";
  const mediaSelector = kind === "collection" ? ".collection-card__cover" : ".item-card__content";
  const firstCard = Array.from(document.querySelectorAll(cardSelector))
    .map((card) => {
      const rect = card.getBoundingClientRect();
      return { card, rect };
    })
    .find(({ rect }) => rect.bottom > 80 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0);
  if (!firstCard) {
    throw new Error(`No visible ${kind} card found`);
  }

  const target = firstCard.card.closest(".masonry-view__item");
  const targetRect = target.getBoundingClientRect();
  const media = firstCard.card.querySelector(mediaSelector);
  const mediaRect = media?.getBoundingClientRect();
  const visibleItems = Array.from(document.querySelectorAll(".masonry-view__item")).map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      key: element.getAttribute("data-archive-key"),
      rect: serializeRect(rect),
    };
  });
  const fractional = visibleItems.filter(({ rect }) =>
    [rect.top, rect.left, rect.width, rect.height].some((value) => Math.abs(value - Math.round(value)) > 0.01),
  );
  const interactive = collectInteractiveElements(firstCard.card);
  const fractionalInteractive = interactive.filter((item) => item.fractional);

  return {
    href: location.href,
    kind,
    dpr: window.devicePixelRatio,
    target: {
      key: target.getAttribute("data-archive-key"),
      rect: serializeRect(targetRect),
      mediaRect: mediaRect ? serializeRect(mediaRect) : null,
      center: {
        x: round(targetRect.left + targetRect.width / 2),
        y: round(targetRect.top + Math.min(targetRect.height / 2, 120)),
      },
    },
    menuOpen: Boolean(firstCard.card.querySelector(".item-card__more-control[data-open='true']")),
    fractionalCount: fractional.length,
    fractional: fractional.slice(0, 12),
    fractionalInteractiveCount: fractionalInteractive.length,
    fractionalInteractive,
    interactive,
  };
}

function collectPageControlState(kind = "page") {
  const round = (value) => Math.round(value * 1000) / 1000;
  const serializeRect = (rect) => ({
    bottom: round(rect.bottom),
    height: round(rect.height),
    left: round(rect.left),
    right: round(rect.right),
    top: round(rect.top),
    width: round(rect.width),
  });
  const hasFractionalRect = (rect) =>
    [rect.top, rect.left, rect.width, rect.height].some((value) => Math.abs(value - Math.round(value)) > 0.01);
  const selectors = [
    [".collection-return-button", "return-button"],
    [".collection-return-button__arrow", "return-icon"],
    [".item-detail__media-action", "detail-media-action"],
    [".item-detail__media-action svg", "detail-media-svg"],
    [".item-detail__panel-toggle", "detail-panel-toggle"],
    [".item-detail__panel-toggle svg", "detail-panel-svg"],
    [".item-detail__panel-toggle kbd", "detail-panel-kbd"],
    [".status-action", "status-action"],
    [".status-action svg", "status-action-svg"],
    [".status-action kbd", "status-action-kbd"],
    [".settings-island__tab", "settings-tab"],
    [".settings-island__shortcut", "settings-shortcut"],
    [".settings-island__shortcut span", "settings-shortcut-label"],
    [".settings-island__shortcut input", "settings-shortcut-input"],
    [".settings-island__shortcut kbd", "settings-shortcut-kbd"],
    [".settings-island__reset", "settings-reset"],
    [".nav-cell", "nav-cell"],
    [".subnav-cell", "subnav-cell"],
    ["svg.archive-icon", "archive-icon"],
    ["kbd", "kbd"],
  ];
  const interactive = selectors.flatMap(([selector, label]) =>
    Array.from(document.querySelectorAll(selector)).map((element, index) => {
      const rect = serializeRect(element.getBoundingClientRect());
      const style = getComputedStyle(element);
      const svg = element instanceof SVGSVGElement ? element : element.querySelector?.("svg");
      const strokeElement = svg?.querySelector?.("[stroke-width], path, circle, polyline, line");
      const strokeWidth =
        strokeElement instanceof SVGElement
          ? getComputedStyle(strokeElement).strokeWidth || strokeElement.getAttribute("stroke-width")
          : null;

      return {
        id: `${label}:${index}`,
        selector,
        label,
        rect,
        fractional: hasFractionalRect(rect),
        transform: style.transform,
        opacity: style.opacity,
        filter: style.filter,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter || "none",
        background: style.backgroundColor,
        willChange: style.willChange,
        borderRadius: style.borderRadius,
        overflow: style.overflow,
        contain: style.contain,
        viewBox: svg?.getAttribute?.("viewBox") ?? null,
        svgWidth: svg ? serializeRect(svg.getBoundingClientRect()).width : null,
        svgHeight: svg ? serializeRect(svg.getBoundingClientRect()).height : null,
        strokeWidth,
      };
    }),
  );

  return {
    href: location.href,
    kind,
    dpr: window.devicePixelRatio,
    fractionalInteractiveCount: interactive.filter((item) => item.fractional).length,
    fractionalInteractive: interactive.filter((item) => item.fractional),
    interactive,
  };
}

function clickFirstPageControl(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`No page control found for ${selector}`);
  }
  element.click();
  return true;
}

function clickButtonByText(text) {
  const normalizedText = String(text).trim().toLowerCase();
  const button = Array.from(document.querySelectorAll("button"))
    .find((element) => element.textContent?.trim().toLowerCase() === normalizedText);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`No button found with text ${text}`);
  }
  button.click();
  return true;
}

function getControlCenter(kind, selector) {
  const cardSelector =
    kind === "collection" ? ".masonry-view__item .collection-card:not(.collection-card--create)" : ".masonry-view__item .item-card";
  const card = Array.from(document.querySelectorAll(cardSelector))
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .find(({ rect }) => rect.bottom > 80 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0)?.element;
  const button = card?.querySelector(selector);
  if (!button) {
    throw new Error(`No ${kind} control found for ${selector}`);
  }
  const rect = button.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function clickControl(kind, selector) {
  const cardSelector =
    kind === "collection" ? ".masonry-view__item .collection-card:not(.collection-card--create)" : ".masonry-view__item .item-card";
  const card = Array.from(document.querySelectorAll(cardSelector))
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .find(({ rect }) => rect.bottom > 80 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0)?.element;
  const button = card?.querySelector(selector);
  if (!(button instanceof HTMLElement)) {
    throw new Error(`No ${kind} clickable control found for ${selector}`);
  }
  button.click();
  return {
    ariaPressed: button.getAttribute("aria-pressed"),
    disabled: button.hasAttribute("disabled"),
  };
}

function focusControl(kind, selector) {
  const cardSelector =
    kind === "collection" ? ".masonry-view__item .collection-card:not(.collection-card--create)" : ".masonry-view__item .item-card";
  const card = Array.from(document.querySelectorAll(cardSelector))
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .find(({ rect }) => rect.bottom > 80 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0)?.element;
  const button = card?.querySelector(selector);
  if (!(button instanceof HTMLElement)) {
    throw new Error(`No ${kind} focusable control found for ${selector}`);
  }
  button.focus({ preventScroll: true });
  return document.activeElement === button;
}

function rectDelta(a, b) {
  const delta = {};
  for (const key of ["top", "left", "right", "bottom", "width", "height"]) {
    delta[key] = Math.round((b[key] - a[key]) * 1000) / 1000;
  }
  return delta;
}

function compareInteractiveRects(before, after) {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  return after
    .map((item) => {
      const previous = beforeById.get(item.id);
      if (!previous) {
        return null;
      }

      const delta = rectDelta(previous.rect, item.rect);
      const moved = Object.values(delta).some((value) => Math.abs(value) > 0.01);
      return moved || item.fractional || previous.fractional
        ? {
            id: item.id,
            selector: item.selector,
            before: previous.rect,
            after: item.rect,
            delta,
            beforeFractional: previous.fractional,
            afterFractional: item.fractional,
          }
        : null;
    })
    .filter(Boolean);
}
