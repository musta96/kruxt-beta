import { kruxtTheme } from "./tokens";

// ---------------------------------------------------------------------------
// Theme mode
// ---------------------------------------------------------------------------

export type ThemeMode = "dark" | "light" | "system";

// ---------------------------------------------------------------------------
// Theme shape – mirrors kruxtTheme structure but allows per-mode overrides
// ---------------------------------------------------------------------------

export interface KruxtThemeColors {
  baseBackground: string;
  baseSurface: string;
  basePanel: string;
  textPrimary: string;
  textSecondary: string;
  accentPrimary: string;
  accentMuted: string;
  success: string;
  warning: string;
  danger: string;
  steel: string;
}

export interface KruxtTheme {
  mode: "dark" | "light";
  colors: KruxtThemeColors;
  radii: typeof kruxtTheme.radii;
  typography: typeof kruxtTheme.typography;
  spacing: typeof kruxtTheme.spacing;
}

// ---------------------------------------------------------------------------
// Dark theme (direct from tokens)
// ---------------------------------------------------------------------------

export const darkTheme: KruxtTheme = {
  mode: "dark",
  colors: { ...kruxtTheme.colors },
  radii: { ...kruxtTheme.radii },
  typography: { ...kruxtTheme.typography },
  spacing: { ...kruxtTheme.spacing },
};

// ---------------------------------------------------------------------------
// Light theme – off-white base, charcoal text, same accent
// ---------------------------------------------------------------------------

export const lightTheme: KruxtTheme = {
  mode: "light",
  colors: {
    baseBackground: "#F4F6F8",
    baseSurface: "#FFFFFF",
    basePanel: "#E8ECF1",
    textPrimary: "#171C24",
    textSecondary: "#5A6376",
    accentPrimary: "#35D0FF",
    accentMuted: "#B0EAFF",
    success: "#4BD59C",
    warning: "#FFC85A",
    danger: "#FF6B6B",
    steel: "#8D99AE",
  },
  radii: { ...kruxtTheme.radii },
  typography: { ...kruxtTheme.typography },
  spacing: { ...kruxtTheme.spacing },
};

// ---------------------------------------------------------------------------
// Resolve system preference
// ---------------------------------------------------------------------------

/**
 * Resolves the effective theme mode when the user has selected "system".
 *
 * In React Native you would typically pass the result of
 * `Appearance.getColorScheme()` as `systemScheme`. When running outside of
 * React Native (e.g. tests), `systemScheme` defaults to "dark".
 */
export function resolveThemeMode(
  mode: ThemeMode,
  systemScheme: "dark" | "light" | null | undefined = "dark",
): "dark" | "light" {
  if (mode === "system") {
    return systemScheme === "light" ? "light" : "dark";
  }
  return mode;
}

// ---------------------------------------------------------------------------
// getTheme – single entry-point for consumers
// ---------------------------------------------------------------------------

/**
 * Returns the resolved `KruxtTheme` for a given mode.
 *
 * ```ts
 * const theme = getTheme("dark");
 * const theme = getTheme("system", Appearance.getColorScheme());
 * ```
 */
export function getTheme(
  mode: ThemeMode,
  systemScheme?: "dark" | "light" | null,
): KruxtTheme {
  const resolved = resolveThemeMode(mode, systemScheme);
  return resolved === "light" ? lightTheme : darkTheme;
}
