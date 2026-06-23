import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", sm: "2rem" },
      screens: { "2xl": "1320px" },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
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
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "#ffffff",
        },
        // Finance-professional brand palette. Keys are kept stable so existing
        // gradient classes keep working — they now resolve to navy/blue/emerald.
        brand: {
          ink: "#0b1733",     // near-black navy (headlines / dark surfaces)
          navy: "#0c2545",    // deep institutional navy
          violet: "#13315c",  // (legacy key) → deep navy-blue
          indigo: "#1e3a8a",
          purple: "#1d4ed8",  // (legacy key) → royal blue
          blue: "#2563eb",
          fuchsia: "#2563eb", // (legacy key) → blue, so violet→fuchsia = navy→blue
          pink: "#0ea5e9",    // (legacy key) → sky
          sky: "#0ea5e9",
          cyan: "#0891b2",
          teal: "#0d9488",
          emerald: "#059669",
          amber: "#d97706",
          gold: "#c08a2d",
          slate: "#475569",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(11,23,51,.06), 0 1px 2px -1px rgba(11,23,51,.05)",
        elevated: "0 18px 40px -16px rgba(11,23,51,.20), 0 6px 16px -10px rgba(11,23,51,.12)",
        glow: "0 16px 38px -14px rgba(13,49,92,.45)",
        "glow-pink": "0 16px 38px -14px rgba(37,99,235,.40)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "gradient-pan": "gradient-pan 6s ease infinite",
        shimmer: "shimmer 2.2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
