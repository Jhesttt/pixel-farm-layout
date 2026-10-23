import { useLayoutStore } from "../../store/layoutStore";
import type { FarmLayout, ViewSettings } from "../../types";

const OPTIONS: { key: ViewSettings["projection"]; label: string; hint: string }[] = [
  { key: "top", label: "Top", hint: "Straight-down view" },
  { key: "iso", label: "Isometric", hint: "Isometric view, as in the game" },
];

const iconProps = {
  "aria-hidden": true,
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinejoin: "round",
} as const;

/** The layout's name and size above the board, with the switch between the top and isometric views. */
export default function BoardHeader({ layout }: { layout: FarmLayout }) {
  const projection = useLayoutStore((s) => s.view.projection);
  const setView = useLayoutStore((s) => s.setView);

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="truncate text-lg font-semibold md:text-xl">{layout.name}</h2>
        <p className="shrink-0 text-ink-soft tabular-nums max-sm:hidden">
          {layout.width} × {layout.height} tiles
        </p>
      </div>

      <div
        role="group"
        aria-label="Board view"
        className="inline-flex shrink-0 overflow-hidden rounded-control border border-control-edge bg-paper"
      >
        {OPTIONS.map((o) => {
          const active = projection === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              title={o.hint}
              className={`flex h-9 items-center gap-1.5 px-3 text-sm font-semibold transition duration-150 ease-soft focus-visible:outline-offset-[-3px] max-md:h-10 ${
                active ? "bg-primary text-on-primary" : "text-ink hover:bg-wash"
              }`}
              onClick={() => setView({ projection: o.key })}
            >
              {o.key === "top" ? (
                <svg {...iconProps}>
                  <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
                  <path d="M2.5 8h11M8 2.5v11" />
                </svg>
              ) : (
                <svg {...iconProps}>
                  <path d="M8 2 14 5.5v5L8 14 2 10.5v-5L8 2ZM2 5.5 8 9l6-3.5M8 9v5" />
                </svg>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
