import { useLayoutStore } from "../store/layoutStore";

const FIRST_LAYOUT_SIZE = 17;

/** Shown when there is no layout to edit: first run after deleting everything. */
export default function NoLayoutsState() {
  const createLayout = useLayoutStore((s) => s.createLayout);

  return (
    <div className="order-1 flex min-h-0 flex-1 items-center justify-center p-6 md:order-2">
      <section className="panel flex max-w-md flex-col items-center gap-4 px-8 py-10 text-center">
        <svg
          aria-hidden
          width="96"
          height="96"
          viewBox="0 0 96 96"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="8" y="40" width="80" height="48" rx="4" className="fill-board stroke-board-edge" />
          <path
            d="M8 56h80M8 72h80M28 40v48M48 40v48M68 40v48"
            className="stroke-grid-line"
            strokeWidth="1.5"
          />
          <path d="M48 40V22" className="stroke-sage-deep" />
          <path d="M48 28c0-8-5-13-14-13 0 8 5 13 14 13Z" className="fill-sage stroke-sage-deep" />
          <path d="M48 24c0-7 4.5-11 12-11 0 7-4.5 11-12 11Z" className="fill-sage stroke-sage-deep" />
        </svg>
        <h2 className="text-2xl font-semibold">No farm plans yet</h2>
        <p className="text-ink-soft">
          Start with an empty plot. You can resize it, name it and save as many layouts as you like.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => createLayout("Farm 1", FIRST_LAYOUT_SIZE, FIRST_LAYOUT_SIZE)}
        >
          Plan your first farm
        </button>
      </section>
    </div>
  );
}
