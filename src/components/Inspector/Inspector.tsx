import { useEffect, useMemo, useRef, useState } from "react";
import { MARKING_COLORS } from "../../data/markingColors";
import { selectActiveLayout, useLayoutStore } from "../../store/layoutStore";
import { useLibraryStore } from "../../store/libraryStore";
import { labelColorFor } from "../../theme/contrast";
import type { ObjectDefinition, PlacedObject } from "../../types";
import CommitInput from "../CommitInput";

const iconProps = {
  "aria-hidden": true,
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-[4px] border border-line bg-sunken px-1.5 text-[11px] font-semibold text-ink-soft">
      {children}
    </kbd>
  );
}

/** Colour input that edits locally and commits when the picker closes (not on every drag). */
function ColorField({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="color"
      aria-label="Custom colour"
      className="h-8 w-10 cursor-pointer rounded-control border border-control-edge bg-paper p-0.5"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
    />
  );
}

function EffectToggle({ objects, defsById }: { objects: PlacedObject[]; defsById: Map<string, ObjectDefinition> }) {
  const updateObjects = useLayoutStore((s) => s.updateObjects);
  const ref = useRef<HTMLInputElement>(null);
  const withEffect = objects.filter((o) => defsById.get(o.defId)?.effect);
  const onCount = withEffect.filter((o) => o.showEffect).length;
  const all = withEffect.length > 0 && onCount === withEffect.length;
  const mixed = onCount > 0 && onCount < withEffect.length;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);

  if (withEffect.length === 0) return null;
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={all}
        onChange={(e) =>
          updateObjects(
            withEffect.map((o) => o.id),
            { showEffect: e.target.checked },
          )
        }
      />
      Show area of effect
    </label>
  );
}

function SelectionPanel({ objects, defsById }: { objects: PlacedObject[]; defsById: Map<string, ObjectDefinition> }) {
  const definitions = useLibraryStore((s) => s.definitions);
  const updateObjects = useLayoutStore((s) => s.updateObjects);
  const rotateObjects = useLayoutStore((s) => s.rotateObjects);
  const removeObjects = useLayoutStore((s) => s.removeObjects);
  const duplicateObjects = useLayoutStore((s) => s.duplicateObjects);
  const ids = objects.map((o) => o.id);

  const single = objects.length === 1 ? (objects[0] as PlacedObject) : null;
  const singleDef = single ? defsById.get(single.defId) : undefined;

  const overrides = new Set(objects.map((o) => o.colorOverride ?? ""));
  const sharedOverride = overrides.size === 1 ? ([...overrides][0] as string) : null;
  const pickerValue = sharedOverride || singleDef?.color || "#8fb07e";

  return (
    <>
      <header>
        <h2 className="text-xl font-semibold">{single ? (singleDef?.name ?? "Object") : `${objects.length} objects`}</h2>
        <p className="text-ink-soft tabular-nums">
          {single && singleDef
            ? `Column ${single.x}, row ${single.y} · ${singleDef.width} × ${singleDef.height}${single.rotation ? ` · turned ${single.rotation}°` : ""}`
            : "Selected together"}
        </p>
      </header>

      {single && (
        <label className="flex flex-col gap-1">
          <span className="field-label">Label</span>
          <CommitInput
            aria-label="Object label"
            className="field"
            placeholder="Add a label"
            maxLength={40}
            value={single.label ?? ""}
            onCommit={(label) => updateObjects(ids, { label })}
          />
        </label>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-1">Colour</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={sharedOverride === ""}
            className={`btn btn-secondary h-8 px-3 text-xs ${sharedOverride === "" ? "outline-2 outline-offset-2 outline-primary" : ""}`}
            onClick={() => updateObjects(ids, { colorOverride: undefined })}
          >
            Default
          </button>
          {MARKING_COLORS.map((c) => {
            const pressed = sharedOverride === c.hex;
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
                onClick={() => updateObjects(ids, { colorOverride: c.hex })}
              >
                {pressed && (
                  <svg {...iconProps}>
                    <path d="m3.5 8.5 3 3 6-7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <ColorField value={pickerValue} onCommit={(hex) => updateObjects(ids, { colorOverride: hex })} />
          Pick any colour
        </div>
      </fieldset>

      <EffectToggle objects={objects} defsById={defsById} />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => rotateObjects(ids, definitions)}>
          <svg {...iconProps}>
            <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5v3h-3" />
          </svg>
          Rotate <Kbd>R</Kbd>
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => duplicateObjects(ids, definitions)}>
          <svg {...iconProps}>
            <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5" />
            <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
          </svg>
          Duplicate <Kbd>Ctrl D</Kbd>
        </button>
        <button type="button" className="btn btn-danger" onClick={() => removeObjects(ids)}>
          <svg {...iconProps}>
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8" />
          </svg>
          Delete <Kbd>Del</Kbd>
        </button>
      </div>
      <p className="text-xs text-ink-soft">Arrow keys nudge the selection one cell.</p>
    </>
  );
}

function LayoutPanel({ defsById }: { defsById: Map<string, ObjectDefinition> }) {
  const layout = useLayoutStore(selectActiveLayout);
  const view = useLayoutStore((s) => s.view);
  const setView = useLayoutStore((s) => s.setView);

  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    for (const o of layout?.objects ?? []) tally.set(o.defId, (tally.get(o.defId) ?? 0) + 1);
    return [...tally.entries()].map(([defId, n]) => ({ name: defsById.get(defId)?.name ?? "Unknown", n }));
  }, [layout?.objects, defsById]);

  const toggles: { key: keyof typeof view; label: string }[] = [
    { key: "showGrid", label: "Show grid lines" },
    { key: "showLabels", label: "Show labels" },
    { key: "showEffects", label: "Show areas of effect" },
  ];

  return (
    <>
      <header>
        <h2 className="text-xl font-semibold">Layout</h2>
        <p className="text-ink-soft">Select an object to edit it. Click and drag to move it.</p>
      </header>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-1">Display</legend>
        {toggles.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={view[t.key]}
              onChange={(e) => setView({ [t.key]: e.target.checked })}
            />
            {t.label}
          </label>
        ))}
      </fieldset>

      <section>
        <h3 className="field-label mb-1">On this layout</h3>
        {counts.length === 0 ? (
          <p className="text-ink-soft">Nothing placed yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5 tabular-nums">
            {counts.map((c) => (
              <li key={c.name} className="flex justify-between">
                <span>{c.name}</span>
                <span className="text-ink-soft">{c.n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Edits the selection; with nothing selected, shows layout display settings and a tally. */
export default function Inspector() {
  const layout = useLayoutStore(selectActiveLayout);
  const selection = useLayoutStore((s) => s.selection);
  const definitions = useLibraryStore((s) => s.definitions);
  const defsById = useMemo(() => new Map(definitions.map((d) => [d.id, d])), [definitions]);

  const selected = useMemo(
    () => (layout ? layout.objects.filter((o) => selection.includes(o.id)) : []),
    [layout, selection],
  );

  return (
    <aside
      aria-label="Inspector"
      className="flex max-h-[28rem] shrink-0 flex-col gap-5 overflow-y-auto border-t border-line bg-paper p-4 md:max-h-none md:w-72 md:border-t-0 md:border-l"
    >
      {selected.length > 0 ? (
        <SelectionPanel objects={selected} defsById={defsById} />
      ) : (
        <LayoutPanel defsById={defsById} />
      )}
    </aside>
  );
}
