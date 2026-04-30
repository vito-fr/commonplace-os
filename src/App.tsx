import { useEffect, useState } from "react";
import { MasonryGrid } from "./components/items";
import type { ItemCardProps } from "./components/items";
import { ItemDetailView } from "./components/items/ItemDetail";
import type { ItemCardReader } from "./data/itemCardReader";
import type { ItemDetail } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemDetailReader } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemCardReader } from "./data/pocketBaseItemCards";
import { createPocketBaseItemStatusWriter } from "./data/pocketBaseItemStatus";
import { seedFixtureItemCardReader } from "./data/seedItemCards";

type AppRoute = { kind: "grid" } | { kind: "item"; itemId: string };

const workspaceId = "seed:ws001";
const readerMode = import.meta.env.VITE_ITEM_CARD_READER;
const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL ?? "http://127.0.0.1:8090";
const isPocketBaseMode = readerMode === "pocketbase";
const itemCardReader: ItemCardReader =
  isPocketBaseMode
    ? createPocketBaseItemCardReader({
        baseUrl: pocketBaseUrl,
      })
    : seedFixtureItemCardReader;
const itemDetailReader = createPocketBaseItemDetailReader({ baseUrl: pocketBaseUrl });
const itemStatusWriter = createPocketBaseItemStatusWriter({ baseUrl: pocketBaseUrl });

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [items, setItems] = useState<ItemCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusWriteError, setStatusWriteError] = useState<string | null>(null);

  useEffect(() => {
    const syncRoute = () => {
      setRoute(getRouteFromLocation());
    };

    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    itemCardReader
      .listItemCards({ workspaceId })
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

  useEffect(() => {
    let isCurrent = true;

    if (route.kind !== "item") {
      setDetail(null);
      setDetailError(null);
      setIsDetailLoading(false);
      setStatusWriteError(null);
      setIsStatusUpdating(false);
      return () => {
        isCurrent = false;
      };
    }

    if (!isPocketBaseMode) {
      setDetail(null);
      setDetailError("Item detail proof requires PocketBase reader mode.");
      setIsDetailLoading(false);
      setStatusWriteError(null);
      setIsStatusUpdating(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsDetailLoading(true);
    setDetailError(null);
    setStatusWriteError(null);

    itemDetailReader
      .getItemDetail({ workspaceId, itemId: route.itemId })
      .then((nextDetail) => {
        if (isCurrent) {
          setDetail(nextDetail);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          console.error(error);
          setDetail(null);
          setDetailError("Unable to load item detail.");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [route]);

  const openItemDetail = (itemId: string) => {
    window.history.pushState(null, "", `/items/${encodeURIComponent(itemId)}`);
    setRoute({ kind: "item", itemId });
  };

  const closeItemDetail = () => {
    window.history.pushState(null, "", "/");
    setRoute({ kind: "grid" });
  };

  const changeItemStatus = async (nextStatus: ItemDetail["status"]) => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsStatusUpdating(true);
    setStatusWriteError(null);

    try {
      await itemStatusWriter.updateItemStatus({
        workspaceId,
        itemId: detail.id,
        nextStatus,
        actor: "system",
      });

      const nextDetail = await itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id });
      setDetail(nextDetail);
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === nextDetail.id ? { ...item, status: nextDetail.status } : item,
        ),
      );
    } catch (error: unknown) {
      console.error(error);
      setStatusWriteError("Unable to change item status.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  if (route.kind === "item") {
    return (
      <main className="app-shell" aria-label="Vita archive">
        <ItemDetailView
          item={detail}
          loading={isDetailLoading}
          error={detailError}
          onBack={closeItemDetail}
          onChangeStatus={changeItemStatus}
          statusActionPending={isStatusUpdating}
          statusActionError={statusWriteError}
        />
      </main>
    );
  }

  const renderedItems = isPocketBaseMode
    ? items.map((item) => ({ ...item, onNavigate: openItemDetail }))
    : items;

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
          items={renderedItems}
          density="comfortable"
          loading={isLoading}
          emptyState={<p className="proof-empty">{readError ?? "No seeded proof items."}</p>}
          ariaLabel="seeded proof items grid"
        />
      </section>
    </main>
  );
}

function getRouteFromLocation(): AppRoute {
  const match = window.location.pathname.match(/^\/items\/([^/]+)\/?$/);

  if (!match) {
    return { kind: "grid" };
  }

  return { kind: "item", itemId: decodeURIComponent(match[1]) };
}
