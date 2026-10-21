import type { DragState } from "../../hooks/useGridDrag";

const BADGE_SIZE = 22;

/**
 * Live preview while dragging. Validity is shown three ways, never by colour alone:
 * solid sage outline + check badge when it fits; dashed brick outline + hatching + cross badge
 * when it does not (including when it is off the grid).
 */
export default function DragGhost({ drag }: { drag: DragState | null }) {
  if (!drag) return null;
  const { ghost, valid, color, icon } = drag;
  const iconSize = Math.min(40, Math.min(ghost.width, ghost.height) * 0.5);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50"
      style={{ left: ghost.left, top: ghost.top, width: ghost.width, height: ghost.height }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center rounded-[3px]"
        style={{ backgroundColor: color, opacity: 0.72 }}
      >
        {icon && (
          <span className="leading-none select-none" style={{ fontSize: iconSize }}>
            {icon}
          </span>
        )}
      </div>

      {!valid && (
        <svg className="absolute inset-0 text-negative" width="100%" height="100%">
          <defs>
            <pattern id="pfl-ghost-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M-2 2 2 -2M0 8 8 0M6 10 10 6" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pfl-ghost-hatch)" />
        </svg>
      )}

      <div
        className={`absolute inset-0 rounded-[3px] border-[3px] ${
          valid ? "border-solid border-sage-deep" : "border-dashed border-negative"
        }`}
      />

      <span
        className={`absolute flex items-center justify-center rounded-full text-paper shadow-soft ${
          valid ? "bg-sage-deep" : "bg-negative"
        }`}
        style={{ width: BADGE_SIZE, height: BADGE_SIZE, top: -BADGE_SIZE / 2, right: -BADGE_SIZE / 2 }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {valid ? <path d="m2 6.5 2.7 2.7L10 3.5" /> : <path d="m2.5 2.5 7 7m0-7-7 7" />}
        </svg>
      </span>
    </div>
  );
}
