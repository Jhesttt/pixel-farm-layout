import { useEffect, useState } from "react";
import { MARKING_COLORS } from "../data/markingColors";
import { labelColorFor } from "../theme/contrast";

interface ColorSwatchesProps {
  /** The current colour; "" means the default (no override); null means a mixed selection. */
  value: string | null;
  /** Called with the chosen colour, or undefined when "Default" is chosen. */
  onChange: (hex: string | undefined) => void;
  /** Offer a "Default" choice that clears the colour (for overrides). */
  allowDefault?: boolean;
  /** The colour shown in the custom picker when `value` is empty or mixed. */
  fallback?: string;
  /** Commit the custom picker on every change rather than when it closes. */
  live?: boolean;
}

/** Colour input that edits locally and commits when the picker closes, or live when asked. */
function ColorField({
  value,
  onCommit,
  live,
}: {
  value: string;
  onCommit: (hex: string) => void;
  live: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="color"
      aria-label="Custom colour"
      className="h-8 w-10 cursor-pointer rounded-control border border-control-edge bg-paper p-0.5"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (live) onCommit(e.target.value);
      }}
      onBlur={() => !live && draft !== value && onCommit(draft)}
    />
  );
}

/** Theme-matched quick picks plus a custom picker. The chosen swatch shows a check, not just a ring. */
export default function ColorSwatches({
  value,
  onChange,
  allowDefault = false,
  fallback = "#8fb07e",
  live = false,
}: ColorSwatchesProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {allowDefault && (
          <button
            type="button"
            aria-pressed={value === ""}
            className={`btn btn-secondary h-8 px-3 text-xs ${value === "" ? "outline-[3px] outline-offset-2 outline-primary" : ""}`}
            onClick={() => onChange(undefined)}
          >
            Default
          </button>
        )}
        {MARKING_COLORS.map((c) => {
          const pressed = value === c.hex;
          return (
            <button
              key={c.hex}
              type="button"
              aria-label={c.name}
              aria-pressed={pressed}
              title={c.name}
              className={`flex h-8 w-8 items-center justify-center rounded-control ring-2 ring-inset ring-ink-deep/70 transition duration-150 ease-soft hover:scale-105 ${
                pressed ? "outline-[3px] outline-offset-2 outline-primary" : ""
              }`}
              style={{ backgroundColor: c.hex, color: labelColorFor(c.hex) }}
              onClick={() => onChange(c.hex)}
            >
              {pressed && (
                <svg
                  aria-hidden
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <ColorField value={value || fallback} onCommit={onChange} live={live} />
        Pick any colour
      </div>
    </div>
  );
}
