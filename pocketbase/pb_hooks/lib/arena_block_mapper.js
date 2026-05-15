const arenaBlockUrlBase = "https://www.are.na/block/";
const arenaChannelUrlBase = "https://www.are.na/";

function mapArenaConnectableToItemDraft(connectable) {
  const blockType = stringValue(connectable && connectable.type) || "Unknown";
  const sourceExternalId = sourceExternalIdFor(connectable, blockType);
  const sourceUrl = sourceUrlFor(connectable, blockType);
  const base = {
    arenaId: connectable && connectable.id != null ? String(connectable.id) : sourceExternalId,
    blockType,
    sourceExternalId,
    title: titleFor(connectable),
    description: markdownValue(connectable && connectable.description),
    sourceUrl,
    warnings: [],
  };

  if (blockType === "Image") {
    return imageDraft(connectable, base);
  }

  if (blockType === "Text") {
    return textDraft(connectable, base);
  }

  if (blockType === "Link") {
    return linkDraft(connectable, base);
  }

  if (blockType === "Embed") {
    return embedDraft(connectable, base);
  }

  if (blockType === "Attachment") {
    return attachmentDraft(connectable, base);
  }

  if (blockType === "Channel") {
    return collectionDraft(connectable, base);
  }

  return fallbackLinkDraft(connectable, base, "unknown Are.na content type");
}

function imageDraft(block, base) {
  const image = (block && block.image) || {};
  const imageUrl = stringValue(image.src) || imageVersionUrl(image, "large") || imageVersionUrl(image, "medium") || imageVersionUrl(image, "small");

  if (!imageUrl) {
    return fallbackLinkDraft(block, base, "image block has no image URL");
  }

  const mimeType = stringValue(image.content_type) || mimeTypeForUrl(imageUrl) || "image/jpeg";
  const width = positiveInteger(image.width, null);
  const height = positiveInteger(image.height, null);
  const fileName = sanitizeFileName(stringValue(image.filename) || fileNameFromUrl(imageUrl) || "arena-image");

  return withFingerprint({
    ...base,
    itemType: "image",
    item: {
      title: base.title,
      description: base.description,
      summary: null,
      type: "image",
    },
    image: {
      downloadUrl: imageUrl,
      fileName,
      mimeType,
      width,
      height,
      dominantColors: null,
      perceptualHash: null,
      ocrText: null,
    },
    note: null,
    link: null,
  });
}

function textDraft(block, base) {
  const content = (block && block.content) || {};
  const body = markdownValue(content) || base.description || base.title || "";
  if (!body) {
    return fallbackLinkDraft(block, base, "text block has no text content");
  }

  return withFingerprint({
    ...base,
    itemType: "note",
    item: {
      title: base.title,
      description: base.description,
      summary: null,
      type: "note",
    },
    image: null,
    note: {
      body,
      format: "markdown",
    },
    link: null,
  });
}

function linkDraft(block, base) {
  const url = base.sourceUrl || blockUrlFor(base.arenaId);
  const image = imagePreviewUrl(block && block.image);
  const metadata = compactObject({
    url,
    title: base.title,
    description: base.description,
    image,
    providerName: providerNameFor(block),
    arena: arenaMetadataFor(block, base),
  });

  return withFingerprint({
    ...base,
    itemType: "link",
    item: {
      title: base.title,
      description: base.description,
      summary: null,
      type: "link",
    },
    image: null,
    note: null,
    link: {
      url,
      ogMetadata: metadata,
      contentType: linkContentTypeFor(url),
    },
  });
}

function embedDraft(block, base) {
  const embed = (block && block.embed) || {};
  const url = stringValue(embed.source_url) || stringValue(embed.url) || base.sourceUrl || blockUrlFor(base.arenaId);
  const thumbnailUrl = stringValue(embed.thumbnail_url) || imagePreviewUrl(block && block.image);
  const metadata = compactObject({
    url,
    title: base.title || stringValue(embed.title),
    description: base.description,
    image: thumbnailUrl,
    providerName: stringValue(embed.type) || providerNameFor(block),
    embed: compactObject({
      url: stringValue(embed.url),
      source_url: stringValue(embed.source_url),
      type: stringValue(embed.type),
      title: stringValue(embed.title),
      author_name: stringValue(embed.author_name),
      author_url: stringValue(embed.author_url),
      width: positiveInteger(embed.width, null),
      height: positiveInteger(embed.height, null),
      thumbnail_url: thumbnailUrl,
    }),
    arena: arenaMetadataFor(block, base),
  });

  return withFingerprint({
    ...base,
    itemType: "link",
    item: {
      title: base.title || stringValue(embed.title),
      description: base.description,
      summary: null,
      type: "link",
    },
    image: null,
    note: null,
    link: {
      url,
      ogMetadata: metadata,
      contentType: "video",
    },
  });
}

function attachmentDraft(block, base) {
  const attachment = (block && block.attachment) || {};
  const url = stringValue(attachment.url) || base.sourceUrl || blockUrlFor(base.arenaId);
  const fileName = stringValue(attachment.filename) || fileNameFromUrl(url);
  const contentType = attachmentContentTypeFor(attachment, url);
  const metadata = compactObject({
    url,
    title: base.title || fileName,
    description: base.description,
    image: imagePreviewUrl(block && block.image),
    fileName,
    fileExtension: stringValue(attachment.file_extension),
    mimeType: stringValue(attachment.content_type),
    fileSize: positiveInteger(attachment.file_size, null),
    arena: arenaMetadataFor(block, base),
  });

  return withFingerprint({
    ...base,
    itemType: "link",
    item: {
      title: base.title || fileName,
      description: base.description,
      summary: null,
      type: "link",
    },
    image: null,
    note: null,
    link: {
      url,
      ogMetadata: metadata,
      contentType,
    },
  });
}

function collectionDraft(block, base) {
  const slug = stringValue(block && block.slug);
  const title = base.title || slug || "Are.na channel";
  const channelId = block && block.id != null ? String(block.id) : base.arenaId;
  const sourceUrl = base.sourceUrl || (slug ? arenaChannelUrlBase + slug : "");

  return {
    ...base,
    itemType: "collection",
    item: null,
    image: null,
    note: null,
    link: null,
    collection: {
      id: channelId,
      slug: slug || null,
      title,
      description: base.description,
      sourceUrl,
    },
    fingerprint: JSON.stringify(compactObject({
      itemType: "collection",
      title,
      description: base.description,
      collection: {
        id: channelId,
        slug,
        sourceUrl,
      },
    })),
  };
}

function fallbackLinkDraft(block, base, warning) {
  const url = base.sourceUrl || blockUrlFor(base.arenaId);
  const warnings = base.warnings.slice();
  if (warning) {
    warnings.push(warning);
  }

  return withFingerprint({
    ...base,
    warnings,
    itemType: "link",
    item: {
      title: base.title || fallbackTitleFor(block, base),
      description: base.description,
      summary: null,
      type: "link",
    },
    image: null,
    note: null,
    link: {
      url,
      ogMetadata: compactObject({
        url,
        title: base.title,
        description: base.description,
        image: imagePreviewUrl(block && block.image),
        arena: arenaMetadataFor(block, base),
        warning,
      }),
      contentType: "unknown",
    },
  });
}

function withFingerprint(draft) {
  return {
    ...draft,
    fingerprint: JSON.stringify(compactObject({
      itemType: draft.itemType,
      title: draft.item.title,
      description: draft.item.description,
      image: draft.image
        ? {
            mimeType: draft.image.mimeType,
            width: draft.image.width,
            height: draft.image.height,
            downloadUrl: draft.image.downloadUrl,
          }
        : null,
      note: draft.note,
      link: draft.link
        ? {
            url: draft.link.url,
            contentType: draft.link.contentType,
            ogMetadata: draft.link.ogMetadata,
          }
        : null,
    })),
  };
}

function sourceExternalIdFor(connectable, blockType) {
  if (connectable && connectable.id != null) {
    return blockType === "Channel" ? "channel:" + String(connectable.id) : String(connectable.id);
  }

  return "unknown:" + Math.random().toString(36).slice(2, 10);
}

function sourceUrlFor(block, blockType) {
  if (blockType === "Channel") {
    const slug = stringValue(block && block.slug);
    return slug ? arenaChannelUrlBase + slug : "";
  }

  const source = block && block.source;
  return stringValue(source && source.url);
}

function titleFor(block) {
  return stringValue(block && block.title) || stringValue(block && block.generated_title) || null;
}

function fallbackTitleFor(block, base) {
  if (base.blockType === "Channel" && stringValue(block && block.title)) {
    return stringValue(block.title);
  }

  return base.blockType + " " + base.arenaId;
}

function markdownValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  return stringValue(value.markdown) || stringValue(value.plain) || null;
}

function imageVersionUrl(image, key) {
  const version = image && image[key];
  return stringValue(version && version.src) || stringValue(version && version.src_2x);
}

function imagePreviewUrl(image) {
  if (!image) {
    return null;
  }

  return (
    stringValue(image.src) ||
    imageVersionUrl(image, "large") ||
    imageVersionUrl(image, "medium") ||
    imageVersionUrl(image, "small") ||
    imageVersionUrl(image, "square") ||
    null
  );
}

function arenaMetadataFor(block, base) {
  const connection = block && block.connection ? block.connection : null;
  return compactObject({
    block_id: base.arenaId,
    block_type: base.blockType,
    source_external_id: base.sourceExternalId,
    source_url: base.sourceUrl,
    connection_id: connection && connection.id != null ? String(connection.id) : null,
    position: connection && connection.position != null ? connection.position : null,
    connected_at: connection && connection.connected_at ? connection.connected_at : null,
  });
}

function providerNameFor(block) {
  const provider = block && block.source && block.source.provider;
  return stringValue(provider && provider.name) || null;
}

function linkContentTypeFor(url) {
  const lower = String(url || "").toLowerCase().replace(/[?#].*$/, "");
  if (lower.endsWith(".pdf")) {
    return "pdf";
  }
  if (isVideoUrl(lower)) {
    return "video";
  }
  if (isAudioUrl(lower)) {
    return "audio";
  }
  if (/^https?:\/\//i.test(url || "")) {
    return "article";
  }
  return "unknown";
}

function attachmentContentTypeFor(attachment, url) {
  const mimeType = stringValue(attachment && attachment.content_type).toLowerCase();
  const extension = stringValue(attachment && attachment.file_extension).toLowerCase();
  const lowerUrl = String(url || "").toLowerCase().replace(/[?#].*$/, "");

  if (mimeType === "application/pdf" || extension === "pdf" || lowerUrl.endsWith(".pdf")) {
    return "pdf";
  }
  if (mimeType.startsWith("video/") || isVideoUrl(lowerUrl)) {
    return "video";
  }
  if (mimeType.startsWith("audio/") || isAudioUrl(lowerUrl)) {
    return "audio";
  }
  return "unknown";
}

function isVideoUrl(value) {
  return (
    value.includes("youtube.com/") ||
    value.includes("youtu.be/") ||
    value.includes("vimeo.com/") ||
    value.endsWith(".mp4") ||
    value.endsWith(".m4v") ||
    value.endsWith(".mov") ||
    value.endsWith(".webm")
  );
}

function isAudioUrl(value) {
  return (
    value.includes("soundcloud.com/") ||
    value.includes("spotify.com/") ||
    value.endsWith(".mp3") ||
    value.endsWith(".m4a") ||
    value.endsWith(".ogg") ||
    value.endsWith(".wav")
  );
}

function mimeTypeForUrl(url) {
  const lower = String(url || "").toLowerCase().replace(/[?#].*$/, "");
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".avif")) {
    return "image/avif";
  }
  return "";
}

function blockUrlFor(id) {
  return arenaBlockUrlBase + encodeURIComponent(String(id || "unknown"));
}

function fileNameFromUrl(url) {
  const clean = String(url || "").replace(/[?#].*$/, "");
  const segment = clean.split("/").filter(Boolean).pop() || "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function sanitizeFileName(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return cleaned || "arena-file";
}

function compactObject(value) {
  const result = {};
  Object.keys(value || {}).forEach((key) => {
    const entry = value[key];
    if (entry !== null && entry !== undefined && entry !== "") {
      result[key] = entry;
    }
  });
  return result;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

module.exports = {
  mapArenaConnectableToItemDraft,
};
