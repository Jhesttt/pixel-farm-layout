import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { findMisfits } from "../../lib/edit";
import {
  NAME_MAX,
  emptyForm,
  formFromDefinition,
  parseDefinitionForm,
  withCenteredOffsets,
  type DefinitionForm,
  type FormErrors,
} from "../../lib/definitionForm";
import { GRID_MAX_SIZE } from "../../lib/grid";
import { useLayoutStore } from "../../store/layoutStore";
import { useLibraryStore } from "../../store/libraryStore";
import { effectEdgeColor, labelColorFor } from "../../theme/contrast";
import type { ObjectDefinition } from "../../types";
import ColorSwatches from "../ColorSwatches";

const ICON_CHOICES = ["🌱", "🌾", "🌽", "🥕", "🍅", "🌻", "🌳", "🐔", "🐄", "🐑", "🚜", "🏠", "🪵", "💧", "🪨", "🔥"];

interface ObjectDefEditorProps {
  /** The definition to edit, or null to create a new one. */
  definition: ObjectDefinition | null;
  onClose: () => void;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="field-label">{label}</span>
      {children}
      {error && (
        <span role="alert" className="text-xs font-semibold text-negative">
          {error}
        </span>
      )}
    </label>
  );
}

const asInt = (text: string, fallback: number) => {
  const n = Number.parseInt(text, 10);
  return Number.isFinite(n) ? n : fallback;
};
const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** The footprint and its effect on a small board, so size and offset changes are visible as typed. */
function DefinitionPreview({ form }: { form: DefinitionForm }) {
  const w = clampInt(asInt(form.width, 1), 1, GRID_MAX_SIZE);
  const h = clampInt(asInt(form.height, 1), 1, GRID_MAX_SIZE);
  const ew = clampInt(asInt(form.effectWidth, 1), 1, GRID_MAX_SIZE);
  const eh = clampInt(asInt(form.effectHeight, 1), 1, GRID_MAX_SIZE);
  const ox = clampInt(asInt(form.offsetX, 0), -GRID_MAX_SIZE, GRID_MAX_SIZE);
  const oy = clampInt(asInt(form.offsetY, 0), -GRID_MAX_SIZE, GRID_MAX_SIZE);

  const x0 = form.hasEffect ? Math.min(0, ox) : 0;
  const y0 = form.hasEffect ? Math.min(0, oy) : 0;
  const x1 = form.hasEffect ? Math.max(w, ox + ew) : w;
  const y1 = form.hasEffect ? Math.max(h, oy + eh) : h;
  const cols = x1 - x0;
  const rows = y1 - y0;
  const cell = clampInt(Math.floor(200 / Math.max(cols, rows)), 4, 28);
  const edge = effectEdgeColor(form.effectColor);
  const objectColor = /^#[0-9a-f]{6}$/i.test(form.color) ? form.color : "#8fb07e";

  const lines = [];
  if (cell >= 8) {
    for (let c = 1; c < cols; c++) lines.push(`M${c * cell + 0.5} 0V${rows * cell}`);
    for (let r = 1; r < rows; r++) lines.push(`M0 ${r * cell + 0.5}H${cols * cell}`);
  }

  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        role="img"
        aria-label={`Preview: footprint ${w} by ${h}${form.hasEffect ? `, effect ${ew} by ${eh}` : ""}`}
        width={cols * cell}
        height={rows * cell}
        className="max-w-full"
      >
        <rect width={cols * cell} height={rows * cell} fill="var(--color-board)" />
        <path d={lines.join("")} stroke="var(--color-grid-line)" strokeWidth="1" fill="none" shapeRendering="crispEdges" />
        {form.hasEffect && (
          <rect
            x={(ox - x0) * cell + 1}
            y={(oy - y0) * cell + 1}
            width={ew * cell - 2}
            height={eh * cell - 2}
            fill={form.effectColor}
            fillOpacity="0.3"
            stroke={edge}
            strokeWidth="2"
            strokeDasharray="5 3"
          />
        )}
        <rect
          x={-x0 * cell + 1}
          y={-y0 * cell + 1}
          width={w * cell - 2}
          height={h * cell - 2}
          rx="3"
          fill={objectColor}
          stroke="var(--color-ink-deep)"
          strokeOpacity="0.7"
          strokeWidth="2"
        />
        {form.icon.trim() !== "" && Math.min(w, h) * cell >= 18 && (
          <text
            x={(-x0 + w / 2) * cell}
            y={(-y0 + h / 2) * cell}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={Math.min(32, Math.min(w, h) * cell * 0.55)}
            fill={labelColorFor(objectColor)}
          >
            {form.icon.trim()}
          </text>
        )}
      </svg>
      <figcaption className="text-xs text-ink-soft tabular-nums">
        {w} × {h}
        {form.hasEffect ? ` · reach ${ew} × ${eh}` : ""}
      </figcaption>
    </figure>
  );
}

/** Modal for creating or editing an object definition. Built-ins are editable too. */
export default function ObjectDefEditor({ definition, onClose }: ObjectDefEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<DefinitionForm>(() =>
    definition ? formFromDefinition(definition) : emptyForm(),
  );
  const [showErrors, setShowErrors] = useState(false);

  const addDefinition = useLibraryStore((s) => s.addDefinition);
  const updateDefinition = useLibraryStore((s) => s.updateDefinition);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const parsed = useMemo(() => parseDefinitionForm(form), [form]);
  const errors: FormErrors = showErrors && !parsed.ok ? parsed.errors : {};

  const edit = (patch: Partial<DefinitionForm>) => setForm((f) => withCenteredOffsets({ ...f, ...patch }));

  const save = () => {
    if (!parsed.ok) {
      setShowErrors(true);
      return;
    }
    const value = parsed.value;
    if (definition === null) {
      addDefinition(value);
      onClose();
      return;
    }

    const library = useLibraryStore.getState().definitions;
    const updated = library.map((d) => (d.id === definition.id ? { ...d, ...value } : d));
    const sizeChanged = value.width !== definition.width || value.height !== definition.height;
    if (sizeChanged) {
      const layouts = Object.values(useLayoutStore.getState().layouts);
      const doomed = layouts.reduce((n, l) => n + findMisfits(l, updated).length, 0);
      if (doomed > 0) {
        const what = doomed === 1 ? "1 placed object no longer fits" : `${doomed} placed objects no longer fit`;
        const ok = window.confirm(
          `Resizing "${definition.name}" means ${what} (off the grid or overlapping) and will be removed from your layouts. Continue?`,
        );
        if (!ok) return;
      }
    }
    updateDefinition(definition.id, {
      name: value.name,
      width: value.width,
      height: value.height,
      color: value.color,
      icon: value.icon,
      effect: value.effect,
    });
    if (sizeChanged) {
      useLayoutStore.getState().removeMisfitObjects(useLibraryStore.getState().definitions);
      // Older undo snapshots were laid out for the old size.
      useLayoutStore.getState().clearHistory();
    }
    onClose();
  };

  const title = definition ? `Edit ${definition.name}` : "New object";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="object-editor-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(46rem,calc(100vw-2rem))] overflow-y-auto rounded-card bg-paper p-0 text-ink shadow-float backdrop:bg-ink/40"
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
        className="flex flex-col gap-5 p-6"
      >
        <header>
          <h2 id="object-editor-title" className="text-2xl font-semibold">
            {title}
          </h2>
          {definition?.builtIn && (
            <p className="text-ink-soft">A built-in object. “Reset built-ins” in the palette restores the original.</p>
          )}
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr_14rem]">
          <div className="flex flex-col gap-5">
            <Field label="Name" error={errors.name}>
              <input
                className="field"
                value={form.name}
                maxLength={NAME_MAX + 10}
                autoFocus
                onChange={(e) => edit({ name: e.target.value })}
              />
            </Field>

            <fieldset className="flex flex-col gap-2">
              <legend className="field-label mb-1">Footprint (tiles)</legend>
              <div className="flex items-end gap-2">
                <Field label="Width" error={errors.width}>
                  <input className="field w-20 text-center" type="number" inputMode="numeric" min={1} max={GRID_MAX_SIZE} value={form.width} onChange={(e) => edit({ width: e.target.value })} />
                </Field>
                <span aria-hidden className="pb-2 text-ink-soft">×</span>
                <Field label="Height" error={errors.height}>
                  <input className="field w-20 text-center" type="number" inputMode="numeric" min={1} max={GRID_MAX_SIZE} value={form.height} onChange={(e) => edit({ height: e.target.value })} />
                </Field>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="field-label mb-1">Colour</legend>
              <ColorSwatches value={form.color} onChange={(hex) => hex && edit({ color: hex })} live />
              {errors.color && <span role="alert" className="text-xs font-semibold text-negative">{errors.color}</span>}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="field-label mb-1">Icon (optional)</legend>
              <div className="flex flex-wrap gap-1">
                {ICON_CHOICES.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-label={`Use ${icon}`}
                    aria-pressed={form.icon === icon}
                    className={`flex h-9 w-9 items-center justify-center rounded-control text-lg transition duration-150 ease-soft hover:bg-wash ${
                      form.icon === icon ? "outline-[3px] outline-offset-1 outline-primary" : ""
                    }`}
                    onClick={() => edit({ icon: form.icon === icon ? "" : icon })}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <Field label="Or type your own" error={errors.icon}>
                <input className="field w-28" value={form.icon} aria-label="Icon" onChange={(e) => edit({ icon: e.target.value })} />
              </Field>
            </fieldset>
          </div>

          <div className="flex flex-col gap-4">
            <DefinitionPreview form={form} />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3 rounded-control border border-line p-4">
          <legend className="px-1 font-semibold">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.hasEffect}
                onChange={(e) => edit({ hasEffect: e.target.checked })}
              />
              Has an area of effect
            </label>
          </legend>

          {form.hasEffect && (
            <>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <Field label="Reach width" error={errors.effectWidth}>
                  <input className="field w-20 text-center" type="number" inputMode="numeric" min={1} max={GRID_MAX_SIZE} value={form.effectWidth} onChange={(e) => edit({ effectWidth: e.target.value })} />
                </Field>
                <Field label="Reach height" error={errors.effectHeight}>
                  <input className="field w-20 text-center" type="number" inputMode="numeric" min={1} max={GRID_MAX_SIZE} value={form.effectHeight} onChange={(e) => edit({ effectHeight: e.target.value })} />
                </Field>
                <Field label="Shape">
                  <select className="field" value="rect" disabled aria-label="Effect shape">
                    <option value="rect">Rectangle</option>
                    <option value="circle">Circle (coming later)</option>
                    <option value="custom">Custom (coming later)</option>
                  </select>
                </Field>
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={form.centered}
                  onChange={(e) => edit({ centered: e.target.checked })}
                />
                Keep centred on the object
              </label>

              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <Field label="Offset across" error={errors.offsetX}>
                  <input className="field w-20 text-center" type="number" inputMode="numeric" disabled={form.centered} value={form.offsetX} onChange={(e) => edit({ offsetX: e.target.value })} />
                </Field>
                <Field label="Offset down" error={errors.offsetY}>
                  <input className="field w-20 text-center" type="number" inputMode="numeric" disabled={form.centered} value={form.offsetY} onChange={(e) => edit({ offsetY: e.target.value })} />
                </Field>
                <p className="max-w-56 text-xs text-ink-soft">
                  Offsets are measured from the object’s top-left tile. Negative reaches up or left, so a
                  sprinkler that only waters downward uses offset down 1.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="field-label">Effect colour</span>
                <ColorSwatches value={form.effectColor} onChange={(hex) => hex && edit({ effectColor: hex })} live />
                {errors.effectColor && <span role="alert" className="text-xs font-semibold text-negative">{errors.effectColor}</span>}
              </div>
            </>
          )}
        </fieldset>

        <footer className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {definition ? "Save changes" : "Create object"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
