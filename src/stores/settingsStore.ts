import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "auto";

interface SettingsState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "auto",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "morph-settings" }
  )
);

/** Resolves "auto" to the OS preference. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}
