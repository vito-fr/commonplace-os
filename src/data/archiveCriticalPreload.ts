import type { ItemCardProps } from "../components/items";

const archivePreloadAttribute = "data-vita-archive-preload";
const defaultCriticalImageCount = 8;

export function preloadCriticalArchiveImages(items: ItemCardProps[], count = defaultCriticalImageCount) {
  if (typeof document === "undefined" || items.length === 0) {
    return;
  }

  const urls = getCriticalArchiveImageUrls(items, count);
  if (urls.length === 0) {
    return;
  }

  const existingLinks = new Set(
    Array.from(document.querySelectorAll<HTMLLinkElement>(`link[${archivePreloadAttribute}="true"]`)).map(
      (link) => link.href,
    ),
  );

  for (const url of urls) {
    const href = toAbsoluteHref(url);
    if (!href || existingLinks.has(href)) {
      continue;
    }

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = href;
    link.setAttribute(archivePreloadAttribute, "true");
    link.fetchPriority = "high";
    document.head.append(link);
    existingLinks.add(href);
  }
}

function getCriticalArchiveImageUrls(items: ItemCardProps[], count: number) {
  const urls: string[] = [];
  const seenUrls = new Set<string>();

  for (const item of items) {
    const url =
      item.mediaPreview?.previewUrl ??
      item.mediaPreview?.thumbnailUrl ??
      item.mediaPreview?.imageUrl ??
      item.thumbnailUrl ??
      item.previewUrl ??
      item.imageUrl ??
      item.videoPosterUrl ??
      item.ogImageUrl ??
      null;

    if (!url || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    urls.push(url);

    if (urls.length >= count) {
      break;
    }
  }

  return urls;
}

function toAbsoluteHref(url: string) {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return null;
  }
}
