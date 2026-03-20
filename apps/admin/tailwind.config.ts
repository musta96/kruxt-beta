import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        /* ── KRUXT design tokens ── */
        "kruxt-bg": "hsl(var(--kruxt-bg) / <alpha-value>)",
        "kruxt-surface": "hsl(var(--kruxt-surface) / <alpha-value>)",
        "kruxt-panel": "hsl(var(--kruxt-panel) / <alpha-value>)",
        "kruxt-accent": "hsl(var(--kruxt-accent) / <alpha-value>)",
        "kruxt-text": "hsl(var(--kruxt-text) / <alpha-value>)",
        "kruxt-text-secondary": "hsl(var(--kruxt-text-secondary) / <alpha-value>)",
        "kruxt-success": "hsl(var(--kruxt-success) / <alpha-value>)",
        "kruxt-warning": "hsl(var(--kruxt-warning) / <alpha-value>)",
        "kruxt-danger": "hsl(var(--kruxt-danger) / <alpha-value>)",
        "kruxt-steel": "hsl(var(--kruxt-steel) / <alpha-value>)",

        /* ── shadcn/ui semantic tokens ── */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        "kruxt-headline": ["Oswald", "sans-serif"],
        "kruxt-body": ["Sora", "sans-serif"],
        "kruxt-mono": ["Roboto Mono", "monospace"],
      },
      spacing: {
        "kruxt-xs": "4px",
        "kruxt-sm": "8px",
        "kruxt-md": "12px",
        "kruxt-lg": "16px",
        "kruxt-xl": "24px",
        "kruxt-2xl": "32px",
      },
      borderRadius: {
        card: "14px",
        button: "12px",
        badge: "999px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite linear",
      },
    },
  },
  plugins: [],
};

export default config;
