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

export interface ZoomControls {
  canZoomOut: boolean;
  canZoomIn: boolean;
  /** False when the board is already fitted to the window. */
  canFit: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
}

const zoomButton =
  "btn btn-secondary h-10 px-0 text-base md:h-9 w-10 md:w-9 focus-visible:outline-offset-2";

/**
 * The line above the board: the layout's name and size, the switch between the top and isometric
 * views, and (isometric only) the zoom buttons. It sits outside the scrolling area, so it stays put
 * while the board is panned and zoomed. On phones the switch shows icons only, to share the line.
 */
export default function BoardHeader({ layout, zoom }: { layout: FarmLayout; zoom?: ZoomControls }) {
  const projection = useLayoutStore((s) => s.view.projection);
  const setView = useLayoutStore((s) => s.setView);

  return (
    <div className="flex items-center justify-between gap-2 md:gap-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="truncate text-lg font-semibold md:text-xl">{layout.name}</h2>
        <p className="shrink-0 text-ink-soft tabular-nums max-md:hidden">
          {layout.width} × {layout.height} tiles
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          role="group"
          aria-label="Board view"
          className="inline-flex overflow-hidden rounded-control border border-control-edge bg-paper"
        >
          {OPTIONS.map((o) => {
            const active = projection === o.key;
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={active}
                title={o.hint}
                className={`flex h-10 items-center justify-center gap-1.5 px-2.5 text-sm font-semibold transition duration-150 ease-soft focus-visible:outline-offset-[-3px] md:h-9 md:px-3 ${
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
                <span className="max-sm:sr-only">{o.label}</span>
              </button>
            );
          })}
        </div>

        {zoom && (
          <div role="group" aria-label="Zoom" className="flex items-center gap-1">
            <button type="button" aria-label="Zoom out" disabled={!zoom.canZoomOut} className={zoomButton} onClick={zoom.onZoomOut}>
              −
            </button>
            <button type="button" aria-label="Zoom in" disabled={!zoom.canZoomIn} className={zoomButton} onClick={zoom.onZoomIn}>
              +
            </button>
            <button
              type="button"
              aria-label="Fit to window"
              disabled={!zoom.canFit}
              className="btn btn-secondary h-10 px-3 text-xs md:h-9"
              onClick={zoom.onFit}
            >
              Fit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
