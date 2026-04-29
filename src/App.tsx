import { MasonryGrid } from "./components/items";
import { seedProofItems } from "./data/seedItemCards";

export function App() {
  return (
    <main className="app-shell" aria-label="Vita archive">
      <section className="proof-panel" aria-labelledby="proof-title">
        <p className="proof-kicker">v0.1 interface slice</p>
        <h1 id="proof-title">MasonryGrid proof</h1>
        <p className="proof-copy">
          The MasonryGrid slice is mounted with representative rows from seed fixtures and no
          route, persistence, or drag layer.
        </p>
        <MasonryGrid items={seedProofItems} density="comfortable" ariaLabel="seeded proof items grid" />
      </section>
    </main>
  );
}
