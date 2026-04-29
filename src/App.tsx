import { MasonryGrid, type ItemCardProps } from "./components/items";

const proofItems: ItemCardProps[] = [
  {
    id: "seed:img004",
    type: "image",
    status: "active",
    source: "pinterest",
    usageCount: 3,
    title: "Structural redacted image",
    hasPendingAIAnnotations: true,
    rightsStatus: "approved_for_internal_use",
    onNavigate: () => undefined,
  },
  {
    id: "seed:cap001",
    type: "caption",
    status: "active",
    source: "manual",
    usageCount: 1,
    title: "Structural redacted caption",
    captionText: "[structural redacted caption placeholder]",
    rightsStatus: "approved_for_external_use",
    onNavigate: () => undefined,
  },
  {
    id: "seed:note004",
    type: "note",
    status: "active",
    source: "manual",
    usageCount: 0,
    title: "Seed canary",
    noteParagraph: "[structural redacted note placeholder]",
    rightsStatus: "unknown",
    onNavigate: () => undefined,
  },
  {
    id: "seed:link001",
    type: "link",
    status: "active",
    source: "url",
    usageCount: 0,
    title: "Structural redacted link",
    url: "[structural redacted url]",
    rightsStatus: "reference_only",
    onNavigate: () => undefined,
  },
  {
    id: "seed:camp001",
    type: "campaign",
    status: "active",
    source: "manual",
    usageCount: 0,
    title: "Structural redacted campaign",
    rightsStatus: "approved_for_internal_use",
    onNavigate: () => undefined,
  },
];

export function App() {
  return (
    <main className="app-shell" aria-label="Vita archive">
      <section className="proof-panel" aria-labelledby="proof-title">
        <p className="proof-kicker">v0.1 interface slice</p>
        <h1 id="proof-title">MasonryGrid proof</h1>
        <p className="proof-copy">
          The MasonryGrid slice is mounted with ItemCard children and no route, persistence, or
          drag layer.
        </p>
        <MasonryGrid items={proofItems} density="comfortable" ariaLabel="proof items grid" />
      </section>
    </main>
  );
}
