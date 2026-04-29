import { useEffect, useState } from "react";
import { MasonryGrid } from "./components/items";
import type { ItemCardProps } from "./components/items";
import type { ItemCardReader } from "./data/itemCardReader";
import { createPocketBaseItemCardReader } from "./data/pocketBaseItemCards";
import { seedFixtureItemCardReader } from "./data/seedItemCards";

const itemCardReader: ItemCardReader =
  import.meta.env.VITE_ITEM_CARD_READER === "pocketbase"
    ? createPocketBaseItemCardReader({
        baseUrl: import.meta.env.VITE_POCKETBASE_URL ?? "http://127.0.0.1:8090",
      })
    : seedFixtureItemCardReader;

export function App() {
  const [items, setItems] = useState<ItemCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    itemCardReader
      .listItemCards({ workspaceId: "seed:ws001" })
      .then((nextItems) => {
        if (isCurrent) {
          setItems(nextItems);
          setReadError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          console.error(error);
          setItems([]);
          setReadError("Unable to load item cards.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <main className="app-shell" aria-label="Vita archive">
      <section className="proof-panel" aria-labelledby="proof-title">
        <p className="proof-kicker">v0.1 interface slice</p>
        <h1 id="proof-title">MasonryGrid proof</h1>
        <p className="proof-copy">
          The MasonryGrid slice is mounted with representative rows from seed fixtures and no
          route, persistence, or drag layer.
        </p>
        <MasonryGrid
          items={items}
          density="comfortable"
          loading={isLoading}
          emptyState={<p className="proof-empty">{readError ?? "No seeded proof items."}</p>}
          ariaLabel="seeded proof items grid"
        />
      </section>
    </main>
  );
}
