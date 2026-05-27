import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        shell: '0 18px 50px rgba(15, 23, 42, 0.04)',
        soft: '0 10px 28px rgba(15, 23, 42, 0.04)',
        panel: '0 2px 12px rgba(15, 23, 42, 0.03)',
      },
      colors: {
        // Dashboard (dark theme) — driven by :root CSS variables
        up: 'rgb(var(--db-up) / <alpha-value>)',
        down: 'rgb(var(--db-down) / <alpha-value>)',
        'bg-primary': 'rgb(var(--db-bg) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--db-bg-secondary) / <alpha-value>)',
        'bg-card': 'rgb(var(--db-bg-card) / <alpha-value>)',
        'border-color': 'rgb(var(--db-border) / <alpha-value>)',
        'text-primary': 'rgb(var(--db-text) / <alpha-value>)',
        'text-secondary': 'rgb(var(--db-text-secondary) / <alpha-value>)',
        'accent-blue': 'rgb(var(--db-accent) / <alpha-value>)',
        // Chart colors
        'chart-up': 'rgb(var(--db-up) / <alpha-value>)',
        'chart-down': 'rgb(var(--db-down) / <alpha-value>)',
        // Chat (uses scoped .chat-panel variables)
        ink: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        panel: 'rgb(var(--surface) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
      },
      animation: {
        'fade-in': 'fadeIn 300ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
        'surface-in': 'surfaceIn 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-up': 'fadeUp 360ms ease-out both',
        blink: 'blink 1s steps(1, end) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        surfaceIn: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '50.01%, 100%': { opacity: '0.25' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
