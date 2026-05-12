import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MotionShell } from "./motion/MotionShell";
import { installArchivePerformanceObservers } from "./performance/archivePerformance";
import { registerServiceWorker } from "./registerServiceWorker";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

installRenderingDebugFlags();
installArchivePerformanceObservers();
registerServiceWorker();

createRoot(rootElement).render(
  <StrictMode>
    <MotionShell>
      <App />
    </MotionShell>
  </StrictMode>,
);

function installRenderingDebugFlags() {
  if (typeof window === "undefined") {
    return;
  }

  const flags: Array<[string, string]> = [
    ["debugDisableCardIntro", "data-debug-disable-card-intro"],
    ["debugDisableCardHoverTransforms", "data-debug-disable-card-hover-transforms"],
    ["debugDisableCardFilters", "data-debug-disable-card-filters"],
    ["debugDisableCardRadius", "data-debug-disable-card-radius"],
    ["debugDisableCardOverflow", "data-debug-disable-card-overflow"],
    ["debugDisableCardShadows", "data-debug-disable-card-shadows"],
    ["debugDisableCardWillChange", "data-debug-disable-card-will-change"],
    ["debugIntegerSnap", "data-debug-integer-snap"],
    ["debugNoChildTransform", "data-debug-no-child-transform"],
    ["debugNoHoverMotion", "data-debug-no-hover-motion"],
    ["debugNoIntroMotion", "data-debug-no-intro-motion"],
    ["debugNoIntroScale", "data-debug-no-intro-scale"],
    ["debugNoMediaClip", "data-debug-no-media-clip"],
    ["debugNoTranslate3d", "data-debug-no-translate3d"],
    ["debugSafariRaster", "data-debug-safari-raster"],
    ["debugSafariCardStack", "data-debug-safari-card-stack"],
    ["debugCardClipPath", "data-debug-card-clip-path"],
  ];
  const params = new URLSearchParams(window.location.search);
  const userAgent = window.navigator.userAgent;
  const isSafari =
    /Safari/i.test(userAgent) &&
    !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/i.test(userAgent);

  document.documentElement.toggleAttribute("data-browser-safari", isSafari);

  flags.forEach(([queryName, attributeName]) => {
    const storedValue = window.localStorage.getItem(`vita:${queryName}`);
    const enabled = params.has(queryName) || storedValue === "1";
    document.documentElement.toggleAttribute(attributeName, enabled);
  });
}
