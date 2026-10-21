import { useEffect, useState } from "react";
import GridCanvas from "./components/Grid/GridCanvas";
import TopBar from "./components/TopBar";
import { onStorageError, type StorageErrorEvent } from "./lib/storage";
import { useLayoutStore } from "./store/layoutStore";

const FIRST_RUN_SIZE = 17;

function StorageToast() {
  const [event, setEvent] = useState<StorageErrorEvent | null>(null);
  useEffect(() => onStorageError(setEvent), []);
  if (!event) return null;

  const text =
    event.kind === "quota"
      ? "Browser storage is full, so your latest changes were not saved. Export your layouts to back them up."
      : event.message;
  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 flex max-w-md -translate-x-1/2 items-start gap-3 rounded bg-stone-800 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>{text}</span>
      <button type="button" className="font-semibold underline" onClick={() => setEvent(null)}>
        Dismiss
      </button>
    </div>
  );
}

export default function App() {
  // First run (or all layouts deleted elsewhere): start with one empty layout.
  useEffect(() => {
    if (useLayoutStore.getState().activeLayoutId === null) {
      useLayoutStore.getState().createLayout("Farm 1", FIRST_RUN_SIZE, FIRST_RUN_SIZE);
    }
  }, []);

  return (
    <div className="flex h-screen flex-col bg-stone-50 text-stone-900">
      <TopBar />
      <main className="flex min-h-0 flex-1">
        <GridCanvas />
      </main>
      <StorageToast />
    </div>
  );
}
