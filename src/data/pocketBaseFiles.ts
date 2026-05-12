export function resolvePocketBaseFileUrl(baseUrl: string, fileRef: string | null | undefined) {
  if (!fileRef) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(fileRef)) {
    return normalizeRemoteMediaUrl(fileRef);
  }

  const url = new URL("/api/vita/imported-file", normalizeBaseUrl(baseUrl));
  url.searchParams.set("key", fileRef);
  return url.toString();
}

export function normalizeRemoteMediaUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

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

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
