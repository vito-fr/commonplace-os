import { useEffect, useState, type FormEvent } from "react";
import { MasonryGrid } from "./components/items";
import type { ItemCardProps } from "./components/items";
import { ItemDetailView } from "./components/items/ItemDetail";
import type { ItemCardReader } from "./data/itemCardReader";
import { createPocketBaseItemCaptureWriter } from "./data/pocketBaseItemCapture";
import type { ItemDetail } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemDetailReader } from "./data/pocketBaseItemDetail";
import { createPocketBaseItemCardReader } from "./data/pocketBaseItemCards";
import { createPocketBaseItemRelationshipWriter } from "./data/pocketBaseItemRelationship";
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
const itemCaptureWriter = createPocketBaseItemCaptureWriter({ baseUrl: pocketBaseUrl });
const itemDetailReader = createPocketBaseItemDetailReader({ baseUrl: pocketBaseUrl });
const itemRelationshipWriter = createPocketBaseItemRelationshipWriter({ baseUrl: pocketBaseUrl });
const itemStatusWriter = createPocketBaseItemStatusWriter({ baseUrl: pocketBaseUrl });

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [items, setItems] = useState<ItemCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusWriteError, setStatusWriteError] = useState<string | null>(null);
  const [isRelationshipCreating, setIsRelationshipCreating] = useState(false);
  const [relationshipWriteError, setRelationshipWriteError] = useState<string | null>(null);

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
      setRelationshipWriteError(null);
      setIsRelationshipCreating(false);
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
      setRelationshipWriteError(null);
      setIsRelationshipCreating(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsDetailLoading(true);
    setDetailError(null);
    setStatusWriteError(null);
    setRelationshipWriteError(null);

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

  const createItemRelationship = async ({ toId, note }: { toId: string; note: string | null }) => {
    if (!detail || !isPocketBaseMode) {
      return;
    }

    setIsRelationshipCreating(true);
    setRelationshipWriteError(null);

    try {
      await itemRelationshipWriter.createRelationship({
        workspaceId,
        fromId: detail.id,
        toId,
        type: "references",
        note: note ?? undefined,
        actor: "system",
      });

      const nextDetail = await itemDetailReader.getItemDetail({ workspaceId, itemId: detail.id });
      setDetail(nextDetail);
    } catch (error: unknown) {
      console.error(error);
      setRelationshipWriteError("Unable to add relationship.");
      throw error;
    } finally {
      setIsRelationshipCreating(false);
    }
  };

  const captureNote = async (body: string) => {
    if (!isPocketBaseMode) {
      return;
    }

    setIsCapturing(true);
    setCaptureError(null);
    setCaptureNotice(null);

    try {
      await itemCaptureWriter.captureNote({
        workspaceId,
        type: "note",
        body,
        sourceExternalId: captureSourceExternalId(),
        actor: "system",
      });
      const nextItems = await itemCardReader.listItemCards({ workspaceId });
      setItems(nextItems);
      setReadError(null);
      setCaptureNotice("Captured to inbox.");
    } catch (error: unknown) {
      console.error(error);
      setCaptureError("Unable to capture note.");
      throw error;
    } finally {
      setIsCapturing(false);
    }
  };

  if (route.kind === "item") {
    const relationshipTargetOptions = items
      .filter((item) => item.id !== detail?.id)
      .map((item) => ({
        id: item.id,
        label: item.title ?? `${item.type} item`,
      }));

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
          onCreateRelationship={createItemRelationship}
          relationshipActionPending={isRelationshipCreating}
          relationshipActionError={relationshipWriteError}
          relationshipTargetOptions={relationshipTargetOptions}
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
        {isPocketBaseMode ? (
          <CaptureNoteForm
            error={captureError}
            notice={captureNotice}
            onCapture={captureNote}
            pending={isCapturing}
          />
        ) : null}
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

function CaptureNoteForm({
  error,
  notice,
  onCapture,
  pending,
}: {
  error: string | null;
  notice: string | null;
  onCapture: (body: string) => Promise<void> | void;
  pending: boolean;
}) {
  const [body, setBody] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedBody = body.trim();

    if (!normalizedBody) {
      setLocalError("Note body is required.");
      return;
    }

    setLocalError(null);

    try {
      await onCapture(normalizedBody);
      setBody("");
    } catch {
      // The parent owns the persisted write error message.
    }
  };

  return (
    <form className="capture-note" aria-label="capture note" onSubmit={submit}>
      <label>
        <span>Capture note</span>
        <textarea
          disabled={pending}
          onChange={(event) => setBody(event.target.value)}
          placeholder="note body"
          rows={3}
          value={body}
        />
      </label>
      <div className="capture-note__actions">
        <button className="status-action" disabled={pending} type="submit">
          {pending ? "Capturing" : "Capture to inbox"}
        </button>
        {notice ? <span className="capture-note__notice">{notice}</span> : null}
      </div>
      {localError || error ? <p className="detail-error">{localError ?? error}</p> : null}
    </form>
  );
}

function getRouteFromLocation(): AppRoute {
  const match = window.location.pathname.match(/^\/items\/([^/]+)\/?$/);

  if (!match) {
    return { kind: "grid" };
  }

  return { kind: "item", itemId: decodeURIComponent(match[1]) };
}

function captureSourceExternalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `manual:note:${crypto.randomUUID()}`;
  }

  return `manual:note:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}
