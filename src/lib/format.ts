const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago", then a date. */
export function formatUpdated(timestamp: number, now: number): string {
  const elapsed = Math.max(0, now - timestamp);
  const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 7 * DAY) return relative.format(-Math.floor(elapsed / DAY), "day");
  return new Date(timestamp).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

/** A filesystem-safe file name for an export, like "Home Farm-17x17.json". */
export function exportFileName(
  name: string,
  width: number,
  height: number,
  extension: string,
  /** Marks which view an image shows, like "isometric". Left out for the default top view. */
  variant?: string,
): string {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ") || "layout";
  return `${safe}-${width}x${height}${variant ? `-${variant}` : ""}.${extension}`;
}
