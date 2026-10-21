/** Saves a blob through the browser's download flow, via a temporary link. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, mime = "application/json"): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}
