import { useEffect, useState, type RefObject } from "react";

/**
 * The content width of the referenced element in px, kept current as it resizes; 0 until measured.
 *
 * The element may mount after the component first renders (a board only exists once a layout
 * does), so the ref is re-read after every render and observed as soon as an element appears.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  // Cheap: only sets state when the element actually changed (mounted, unmounted or replaced).
  useEffect(() => {
    if (ref.current !== element) setElement(ref.current);
  });

  useEffect(() => {
    if (!element) {
      setWidth(0);
      return;
    }
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return width;
}
