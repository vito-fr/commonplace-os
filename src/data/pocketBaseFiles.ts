export function resolvePocketBaseFileUrl(baseUrl: string, fileRef: string | null | undefined) {
  if (!fileRef) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(fileRef)) {
    return fileRef;
  }

  const url = new URL("/api/vita/imported-file", normalizeBaseUrl(baseUrl));
  url.searchParams.set("key", fileRef);
  return url.toString();
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
