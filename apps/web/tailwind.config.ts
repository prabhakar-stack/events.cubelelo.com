import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        "accent-primary": "var(--accent-primary)",
        "accent-secondary": "var(--accent-secondary)",
        "accent-warn": "var(--accent-warn)",
        "accent-danger": "var(--accent-danger)",
        "accent-gold": "var(--accent-gold)",
        "accent-silver": "var(--accent-silver)",
        "accent-bronze": "var(--accent-bronze)",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
