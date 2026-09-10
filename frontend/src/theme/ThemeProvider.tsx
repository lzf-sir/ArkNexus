import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { ThemeMode } from "./tokens";

/** User-selectable mode: explicit light/dark or follow the OS. */
export type Mode = ThemeMode | "system";

/** Resolved (effective) mode after applying `system`. */
export type ResolvedMode = ThemeMode;

interface ThemeCtx {
  mode: Mode;
  resolved: ResolvedMode;
  setMode: (m: Mode) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "arknexus-theme-mode";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedMode = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<ThemeCtx>(() => ({ mode, resolved, setMode }), [mode, resolved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used within ThemeProvider");
  return v;
}