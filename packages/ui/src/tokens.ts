/**
 * KRUXT Design Tokens
 * "No log, no legend."
 *
 * Guild-premium aesthetic: charcoal/graphite base, ion-blue accent,
 * steel/silver metallics. Equipment-panel surfaces.
 */
export const kruxtTheme = {
  colors: {
    // ── Base surfaces ──
    void: "#090B0E",           // deepest background
    base: "#0E1116",           // primary background
    surface: "#171C24",        // card / panel fill
    panel: "#1D2430",          // elevated panel
    overlay: "#252D3A",        // dropdown / modal overlay

    // ── Text ──
    textPrimary: "#F4F6F8",
    textSecondary: "#A7B1C2",
    textMuted: "#5C6677",
    textDisabled: "#3A4150",

    // ── Accent ──
    ionBlue: "#35D0FF",
    ionBlueMuted: "#1E5A6B",
    ionBlueGlow: "#35D0FF33",  // 20% alpha for glows

    // ── Metallic secondary ──
    steel: "#8D99AE",
    steelLight: "#B0BAC9",
    silver: "#D1D7E0",

    // ── Status ──
    success: "#4BD59C",
    successMuted: "#1A3D2E",
    warning: "#FFC85A",
    warningMuted: "#3D3219",
    danger: "#FF6B6B",
    dangerMuted: "#3D1A1A",
    info: "#35D0FF",
    infoMuted: "#1E5A6B",

    // ── Borders ──
    border: "#1F2733",
    borderSubtle: "#171C24",
    borderActive: "#35D0FF",
  },

  radii: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 14,       // card default
    xl: 16,       // panel
    pill: 999,    // badges / sigils
  },

  typography: {
    headline: "Space Grotesk, sans-serif",  // modern condensed sans
    body: "Inter, sans-serif",               // clean grotesk
    numeric: "JetBrains Mono, monospace",    // monospaced digits
  },

  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 800,
  },

  spacing: {
    "2xs": 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
    "3xl": 48,
    "4xl": 64,
  },

  shadows: {
    card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(31,39,51,0.5)",
    panel: "0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(31,39,51,0.5)",
    glow: "0 0 20px rgba(53,208,255,0.15)",
    glowStrong: "0 0 40px rgba(53,208,255,0.25)",
  },
} as const;

/** Brand copy — short declarative system rules */
export const brandCopy = {
  motto: "No log, no legend.",
  proofFeedCta: "Post the proof.",
  chainReminder: "Protect the chain.",
  rankRule: "Rank is earned weekly.",
  logRule: "Log to claim.",
  guildEntry: "Enter Guild Hall.",
  proofCounts: "Proof counts.",
  consentRule: "Rank requires consent to current policy.",
  profileRule: "Guild access starts when profile is complete.",
} as const;
