import { useCallback, useEffect, useState } from "react";

/** SSR-safe: this template is client-rendered, so the initial read is synchronous. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", handler);
    return () => list.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Enter sends on a real keyboard; on touch it inserts a newline instead. */
export function useIsDesktopInput(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}

export const useIsWideLayout = () => useMediaQuery("(min-width: 768px)");

export function useClipboardCopied(resetMs = 1600) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const flag = useCallback(
    (key: string) => {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), resetMs);
    },
    [resetMs],
  );

  return { copiedKey, flag };
}
