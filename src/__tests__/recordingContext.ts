import type { DrawContext } from "../lib/renderToCanvas";

// A 2D context that records every call with the style in force at that moment, so drawing code can
// be tested without a canvas.

export interface Call {
  op: string;
  args: unknown[];
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  font: string;
}

/** A 2D context that records every call with the style in force at that moment. */
export class RecordingContext {
  calls: Call[] = [];
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  globalAlpha = 1;
  font = "10px sans-serif";
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";

  private record(op: string, args: unknown[]) {
    this.calls.push({
      op,
      args,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      font: this.font,
    });
  }
  save = () => this.record("save", []);
  restore = () => this.record("restore", []);
  beginPath = () => this.record("beginPath", []);
  closePath = () => this.record("closePath", []);
  moveTo = (...a: unknown[]) => this.record("moveTo", a);
  lineTo = (...a: unknown[]) => this.record("lineTo", a);
  arcTo = (...a: unknown[]) => this.record("arcTo", a);
  arc = (...a: unknown[]) => this.record("arc", a);
  ellipse = (...a: unknown[]) => this.record("ellipse", a);
  rect = (...a: unknown[]) => this.record("rect", a);
  clip = () => this.record("clip", []);
  fill = () => this.record("fill", []);
  stroke = () => this.record("stroke", []);
  fillRect = (...a: unknown[]) => this.record("fillRect", a);
  strokeRect = (...a: unknown[]) => this.record("strokeRect", a);
  fillText = (...a: unknown[]) => this.record("fillText", a);
  setLineDash = (...a: unknown[]) => this.record("setLineDash", a);
  measureText = (text: string) => {
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
    return { width: text.length * px * 0.6 } as TextMetrics;
  };

  of(op: string) {
    return this.calls.filter((c) => c.op === op);
  }
  texts() {
    return this.of("fillText").map((c) => String(c.args[0]));
  }
  indexOf(predicate: (c: Call) => boolean) {
    return this.calls.findIndex(predicate);
  }
}

/** The recorder as the renderer's context type. */
export const asContext = (ctx: RecordingContext) => ctx as unknown as DrawContext;
