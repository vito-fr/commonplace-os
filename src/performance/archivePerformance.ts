type VitaPerformanceState = {
  cls: number;
  lcp: number | null;
  longAnimationFrames: number[];
};

declare global {
  interface Window {
    __vitaPerformance?: VitaPerformanceState;
  }
}

export function installArchivePerformanceObservers() {
  if (typeof window === "undefined" || window.__vitaPerformance) {
    return;
  }

  const state: VitaPerformanceState = {
    cls: 0,
    lcp: null,
    longAnimationFrames: [],
  };
  const debugPerformance = new URLSearchParams(window.location.search).get("debugPerformance") === "1";
  window.__vitaPerformance = state;

  observePerformanceEntry("layout-shift", (entry) => {
    const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
    if (!layoutShift.hadRecentInput && typeof layoutShift.value === "number") {
      state.cls += layoutShift.value;
      if (debugPerformance && layoutShift.value > 0.01) {
        console.info("[vita-performance] layout shift", {
          cls: state.cls,
          value: layoutShift.value,
        });
      }
    }
  });

  observePerformanceEntry("largest-contentful-paint", (entry) => {
    state.lcp = entry.startTime;
    if (debugPerformance) {
      console.info("[vita-performance] lcp", { startTime: entry.startTime });
    }
  });

  observePerformanceEntry("long-animation-frame", (entry) => {
    state.longAnimationFrames.push(entry.duration);
    if (debugPerformance) {
      console.info("[vita-performance] long animation frame", { duration: entry.duration });
    }
  });
}

function observePerformanceEntry(type: string, callback: (entry: PerformanceEntry) => void) {
  if (
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes?.includes(type)
  ) {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(callback);
    });
    observer.observe({ buffered: true, type });
  } catch {
    // Unsupported browsers should keep running normally without perf observers.
  }
}
