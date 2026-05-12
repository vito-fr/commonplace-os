export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/vita-sw.js").catch(() => {
      // Service worker registration is an optimization, not a rendering dependency.
    });
  }, { once: true });
}
