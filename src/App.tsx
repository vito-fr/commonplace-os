import { ItemCard } from "./components/items";

export function App() {
  return (
    <main className="app-shell" aria-label="Vita archive">
      <section className="proof-panel" aria-labelledby="proof-title">
        <p className="proof-kicker">v0.1 interface slice</p>
        <h1 id="proof-title">Signal row primitives</h1>
        <p className="proof-copy">
          The ItemCard slice is mounted with the first signal-row primitives and no grid layer.
        </p>
        <div className="proof-card-frame">
          <ItemCard
            id="seed:img004"
            type="image"
            status="active"
            source="pinterest"
            usageCount={3}
            title="Structural redacted image"
            hasPendingAIAnnotations
            rightsStatus="approved_for_internal_use"
            onNavigate={() => undefined}
          />
        </div>
      </section>
    </main>
  );
}
