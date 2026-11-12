// PWA plumbing: service-worker registration + the Android/Chrome install prompt.

import { useCallback, useEffect, useState } from "react";

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaInstallState {
  canInstall: boolean;
  promptInstall: () => void;
}

/** Chrome/Android fire `beforeinstallprompt`; iOS Safari has no equivalent (Share → Add). */
export function usePwaInstall(): PwaInstallState {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = useCallback(() => {
    if (!promptEvent) return;
    void promptEvent.prompt().catch(() => undefined);
    setPromptEvent(null);
  }, [promptEvent]);

  return { canInstall: promptEvent !== null, promptInstall };
}
