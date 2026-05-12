import type { ArchiveObject } from "../items";
import { MasonryView } from "../items";

const stripeImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='1260' viewBox='0 0 900 1260'%3E%3Crect width='900' height='1260' fill='%23f7f7ef'/%3E%3Cg stroke='%23000000' stroke-width='18' opacity='.88'%3E%3Cpath d='M-140 90H1040M-140 220H1040M-140 350H1040M-140 480H1040M-140 610H1040M-140 740H1040M-140 870H1040M-140 1000H1040M-140 1130H1040'/%3E%3C/g%3E%3Cg stroke='%2311a96b' stroke-width='36' opacity='.78'%3E%3Cpath d='M30-80 940 830M-160 110 750 1020M-350 300 560 1210'/%3E%3C/g%3E%3C/svg%3E";

const tallImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='1320' viewBox='0 0 360 1320'%3E%3Crect width='360' height='1320' fill='%23ebfff7'/%3E%3Cpath d='M180 0v1320' stroke='%23000' stroke-width='20'/%3E%3Cpath d='M0 180h360M0 430h360M0 680h360M0 930h360M0 1180h360' stroke='%2300c97b' stroke-width='22'/%3E%3C/svg%3E";

const reproObjects: ArchiveObject[] = [
  {
    objectType: "item",
    item: {
      id: "debug:safari:image-striped",
      type: "image",
      status: "active",
      source: "local",
      usageCount: 0,
      collectionCount: 1,
      createdAt: new Date().toISOString(),
      title: "Safari striped image",
      imageUrl: stripeImage,
      imageWidth: 900,
      imageHeight: 1260,
      aspectRatio: 900 / 1260,
    },
  },
  {
    objectType: "item",
    item: {
      id: "debug:safari:link-striped",
      type: "link",
      status: "active",
      source: "url",
      usageCount: 0,
      collectionCount: 0,
      createdAt: new Date().toISOString(),
      title: "Safari link preview",
      url: "https://example.com/debug",
      ogTitle: "High contrast link card",
      ogImageUrl: stripeImage,
      imageWidth: 900,
      imageHeight: 1260,
      aspectRatio: 900 / 1260,
    },
  },
  {
    objectType: "item",
    item: {
      id: "debug:safari:tall-image",
      type: "image",
      status: "active",
      source: "local",
      usageCount: 0,
      collectionCount: 0,
      createdAt: new Date().toISOString(),
      title: "Tall image repro",
      imageUrl: tallImage,
      imageWidth: 360,
      imageHeight: 1320,
      aspectRatio: 360 / 1320,
    },
  },
  {
    objectType: "item",
    item: {
      id: "debug:safari:note",
      type: "note",
      status: "active",
      source: "manual",
      usageCount: 0,
      collectionCount: 0,
      createdAt: new Date().toISOString(),
      title: "Note repro",
      noteParagraph:
        "Safari raster repro note. The card uses the same hover controls, title/date swap, rounded clipping, and masonry positioning shell as production cards.",
    },
  },
];

export function SafariCardRepro() {
  return (
    <main className="app-shell app-shell--archive safari-card-repro" aria-label="Safari card raster repro">
      <section className="safari-card-repro__header">
        <h1>Safari card raster repro</h1>
        <p>
          Use query flags such as <code>debugSafariRaster=1</code>, <code>debugNoIntroScale=1</code>,{" "}
          <code>debugNoMediaClip=1</code>, or <code>debugCardClipPath=1</code>.
        </p>
      </section>
      <section className="archive-canvas" aria-label="debug masonry objects">
        <MasonryView objects={reproObjects} columns={3} ariaLabel="debug safari masonry objects" />
      </section>
    </main>
  );
}
