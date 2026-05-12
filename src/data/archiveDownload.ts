export type ArchiveDownloadTarget = {
  filename: string;
  url: string;
};

export async function downloadArchiveFile({ filename, url }: ArchiveDownloadTarget) {
  if (typeof document === "undefined") {
    return false;
  }

  if (/^(blob:|data:)/i.test(url)) {
    return clickDownloadLink(url, filename);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      return false;
    }

    const objectUrl = URL.createObjectURL(blob);
    clickDownloadLink(objectUrl, filename);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return true;
  } catch {
    return false;
  }
}

function clickDownloadLink(url: string, filename: string) {
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  }
}
