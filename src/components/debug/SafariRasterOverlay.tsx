import { useEffect, useState } from "react";

type DebugRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type DebugCard = {
  key: string;
  mediaLayers: string[];
  interactiveLayers: string[];
  rect: DebugRect;
};

const debugCardSelector = ".masonry-view__item, .masonry-grid__item";
const debugMediaLayerSelector = [
  ".masonry-view__motion",
  ".item-card",
  ".item-card__content",
  ".item-card__image",
  ".item-card__pdf-preview",
  ".item-card__pdf-frame",
  ".collection-card",
  ".collection-card__cover",
  ".collection-card__cover img",
].join(",");
const debugInteractiveLayerSelector = [
  ".item-card__actions",
  ".item-card__more-control",
  ".item-card__action-cell",
  ".item-card__select",
  ".item-card__select span",
  ".item-card__dots-icon",
  ".item-card__plus-icon",
  ".item-card__more-menu",
  ".item-card__menu-action",
  ".item-card__menu-icon",
  ".item-card__menu-label",
  ".item-card__frame-tags",
  ".item-card__frame-tag",
  ".card-glyph",
  ".collection-card__actions",
  ".collection-card__more-control",
  ".collection-card__action-cell",
  ".collection-card__more-menu",
  "svg",
].join(",");

export function SafariRasterOverlay() {
  const [cards, setCards] = useState<DebugCard[]>([]);

  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-debug-safari-raster")) {
      return undefined;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const nextCards = collectFractionalCards();
      setCards(nextCards);

      if (nextCards.length > 0) {
        console.table(
          nextCards.slice(0, 20).map((card) => ({
            key: card.key,
            media: card.mediaLayers.join(", "),
            interactive: card.interactiveLayers.join(", "),
            left: card.rect.left,
            top: card.rect.top,
            width: card.rect.width,
            height: card.rect.height,
            dpr: window.devicePixelRatio,
            visualScale: window.visualViewport?.scale ?? 1,
          })),
        );
      }
    };
    const schedule = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(update);
    };
    const interval = window.setInterval(schedule, 650);

    schedule();
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.clearInterval(interval);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, []);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="safari-raster-overlay" aria-hidden="true">
      {cards.map((card) => (
        <div
          className={`safari-raster-overlay__box${card.interactiveLayers.length ? " safari-raster-overlay__box--interactive" : ""}`}
          key={card.key}
          style={{
            height: card.rect.height,
            left: card.rect.left,
            top: card.rect.top,
            width: card.rect.width,
          }}
        >
          <span>{formatOverlayLabel(card)}</span>
        </div>
      ))}
    </div>
  );
}

function collectFractionalCards() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return Array.from(document.querySelectorAll<HTMLElement>(debugCardSelector))
    .map((card, index) => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= viewportHeight || rect.left >= viewportWidth) {
        return null;
      }

      const mediaLayers = collectFractionalLayerNames(card, debugMediaLayerSelector);
      const interactiveLayers = collectFractionalLayerNames(card, debugInteractiveLayerSelector);

      if (mediaLayers.length === 0 && interactiveLayers.length === 0) {
        return null;
      }

      return {
        key: card.getAttribute("data-archive-key") ?? `debug-card-${index}`,
        mediaLayers,
        interactiveLayers,
        rect: serializeRect(rect),
      };
    })
    .filter((card): card is DebugCard => Boolean(card));
}

function collectFractionalLayerNames(card: HTMLElement, selector: string) {
  const layers = Array.from(card.querySelectorAll<HTMLElement>(selector))
    .map((element) => ({
      name: getDebugLayerName(element),
      rect: element.getBoundingClientRect(),
    }))
    .filter(({ rect }) => hasFractionalRect(rect))
    .map(({ name }) => name);

  return Array.from(new Set(layers));
}

function formatOverlayLabel(card: DebugCard) {
  return [
    card.mediaLayers.length ? `media: ${card.mediaLayers.join("+")}` : "",
    card.interactiveLayers.length ? `ui: ${card.interactiveLayers.join("+")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function getDebugLayerName(element: HTMLElement) {
  const className = Array.from(element.classList).find((name) =>
    /(?:masonry|item-card|collection-card)/.test(name),
  );

  return className ?? element.tagName.toLowerCase();
}

function hasFractionalRect(rect: DOMRect) {
  return [rect.top, rect.left, rect.width, rect.height].some((value) => Math.abs(value - Math.round(value)) > 0.01);
}

function serializeRect(rect: DOMRect): DebugRect {
  return {
    height: Math.round(rect.height * 100) / 100,
    left: Math.round(rect.left * 100) / 100,
    top: Math.round(rect.top * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
  };
}
