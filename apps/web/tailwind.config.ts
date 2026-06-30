import type { Config } from 'tailwindcss';

// shadcn/ui-style theme tokens driven by CSS variables (see globals.css),
// enabling dark/light themes and WCAG-friendly contrast.
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // Page tone behind cards — slightly tinted/deeper than the card surface.
        app: 'hsl(var(--app-bg))',
        // Raised surface (cards, inputs, modals) — sits above `app`.
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
      },
    },
  },
  plugins: [],
};

export default config;
