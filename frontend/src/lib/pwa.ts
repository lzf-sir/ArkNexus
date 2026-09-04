// Lightweight PWA install-prompt hook.
//
// Captures the BeforeInstallPromptEvent fired by Chrome / Edge / Samsung Internet
// so we can show our own in-app "Add to Home Screen" CTA. Exposes a no-op fallback
// on Safari/iOS (which uses the share sheet instead) and on browsers that don't
// support the prompt.

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaInstallState {
  /** True when the browser has fired BeforeInstallPromptEvent and we can install. */
  canInstall: boolean;
  /** True on iOS Safari where we can't prompt but can suggest manual install. */
  isIos: boolean;
  /** Has the user already dismissed our in-app prompt for this session. */
  dismissed: boolean;
  /** True after the user accepted the install. */
  installed: boolean;
  /** Trigger the browser's native install prompt. Resolves regardless of outcome. */
  promptInstall: () => Promise<void>;
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad/iPhone/iPod with Safari (excludes Chrome iOS which is also WebKit)
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|EdgiOS|OPiOS|FxiOS/.test(ua);
}

function getStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-expect-error - non-standard prop
  if (window.navigator.standalone === true) return true;
  // Standard: matchMedia('(display-mode: standalone)')
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

export function usePwaInstall(): PwaInstallState {
  const [canInstall, setCanInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setIsIos(isIosSafari());
    setInstalled(getStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setCanInstall(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    // Capture the deferred prompt from the event we stashed earlier.
    // We re-fetch it through the listener-installed closure is impossible across
    // renders; instead we use the most recent event by reading from a module-level
    // ref. Fall back to no-op if no event is pending.
    const evt = pendingPrompt as BeforeInstallPromptEvent | null;
    if (!evt) return;
    pendingPrompt = null;
    setCanInstall(false);
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === "dismissed") {
      setDismissed(true);
    }
  };

  return {
    canInstall,
    isIos,
    dismissed,
    installed,
    promptInstall,
  };
}

// Module-level slot to bridge the DOM event (no payload) and the React render.
// Populated by the listener, drained by promptInstall().
let pendingPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    pendingPrompt = e as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    pendingPrompt = null;
  });
}