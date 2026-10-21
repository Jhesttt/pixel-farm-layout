import { useSyncExternalStore } from "react";

/** Whether the CSS media query currently matches; updates when the window changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below Tailwind's `md` breakpoint: the phone layout. */
export const PHONE_QUERY = "(max-width: 767px)";
