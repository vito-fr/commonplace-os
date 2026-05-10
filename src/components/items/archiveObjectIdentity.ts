import type { ArchiveObject } from "./ArchiveObject";

export function getArchiveObjectKey(object: ArchiveObject) {
  if (object.objectType === "item") {
    return `item:${object.item.id}`;
  }

  if (object.objectType === "collection") {
    return `collection:${object.collection.id}`;
  }

  return "collection:create";
}

export function getArchiveObjectRenderSignature(object: ArchiveObject) {
  if (object.objectType === "collection-create") {
    return ["collection:create", object.disabled ? "disabled" : "enabled"].join(":");
  }

  if (object.objectType === "collection") {
    const collection = object.collection;
    return [
      "collection",
      collection.id,
      collection.name,
      collection.description ?? "",
      collection.href ?? "",
      collection.kindSummary,
      collection.lastUpdatedAt,
      collection.pieceCount,
      collection.previewItems
        .map((item) =>
          [
            item.id,
            item.title ?? "",
            item.kind,
            item.format ?? "",
            item.thumbnailUrl ?? "",
            item.previewUrl ?? "",
            item.imageUrl ?? "",
            item.ogImageUrl ?? "",
            item.videoPosterUrl ?? "",
            item.width ?? "",
            item.height ?? "",
            item.aspectRatio ?? "",
            item.textPreview ?? "",
            item.sourceUrl ?? "",
            item.source ?? "",
          ].join("\u001f"),
        )
        .join("\u001e"),
    ].join("\u001f");
  }

  const item = object.item;
  const preview = item.mediaPreview;
  return [
    "item",
    item.id,
    item.type,
    item.status,
    item.source,
    item.usageCount,
    item.collectionCount ?? "",
    item.createdAt ?? "",
    item.title ?? "",
    item.imageUrl ?? "",
    item.captionText ?? "",
    item.noteParagraph ?? "",
    item.url ?? "",
    item.linkContentType ?? "",
    item.ogImageUrl ?? "",
    item.ogTitle ?? "",
    item.assetFileUrl ?? "",
    item.assetMimeType ?? "",
    item.previewUrl ?? "",
    item.thumbnailUrl ?? "",
    item.videoPosterUrl ?? "",
    item.imageWidth ?? "",
    item.imageHeight ?? "",
    item.aspectRatio ?? "",
    preview?.previewUrl ?? "",
    preview?.imageUrl ?? "",
    preview?.thumbnailUrl ?? "",
    preview?.ogImageUrl ?? "",
    preview?.videoPosterUrl ?? "",
    preview?.assetFileUrl ?? "",
    preview?.assetMimeType ?? "",
    preview?.width ?? "",
    preview?.height ?? "",
    preview?.aspectRatio ?? "",
    item.hasPendingAIAnnotations ? "ai" : "",
    item.rightsStatus ?? "",
    item.isSelected ? "selected" : "",
    item.isCollectionPickerOpen ? "picker" : "",
    item.detailHref ?? "",
    item.activeFilters?.status ?? "",
    item.activeFilters?.type ?? "",
    item.activeFilters?.source ?? "",
    item.activeFilters?.text ?? "",
  ].join("\u001f");
}
