import { SourceMark, StatusIndicator, TypeIndicator, UsageBadge } from "./components/atoms";

export function App() {
  return (
    <main className="app-shell" aria-label="Vita archive">
      <section className="proof-panel" aria-labelledby="proof-title">
        <p className="proof-kicker">v0.1 interface slice</p>
        <h1 id="proof-title">Signal row primitives</h1>
        <p className="proof-copy">
          The first UI slice is mounted. These are the atom components that will compose the
          item card signal row.
        </p>
        <div className="proof-signal-row" aria-label="example item signal row">
          <TypeIndicator type="image" />
          <span aria-hidden="true">·</span>
          <StatusIndicator status="active" />
          <span aria-hidden="true">·</span>
          <SourceMark source="pinterest" />
          <UsageBadge count={3} />
        </div>
      </section>
    </main>
  );
}
