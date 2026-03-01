/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false, // Carbon CSS provides its own reset
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plex-sans)', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'IBM Plex Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // Carbon g100 design tokens
        'c-bg':           '#161616',
        'c-bg-hover':     '#2e2e2e',
        'c-layer-01':     '#262626',
        'c-layer-02':     '#393939',
        'c-layer-03':     '#525252',
        'c-border':       '#393939',
        'c-border-strong':'#6f6f6f',
        'c-text':         '#f4f4f4',
        'c-text-02':      '#c6c6c6',
        'c-text-03':      '#8d8d8d',
        'c-disabled':     '#525252',
        'c-interactive':  '#4589ff',
        'c-link':         '#78a9ff',
        'c-error':        '#fa4d56',
        'c-warning':      '#f1c21b',
        'c-success':      '#42be65',
        'c-info':         '#0043ce',
        // Keep accent for SquadCheck brand
        accent: { DEFAULT: '#4589ff', light: '#78a9ff' },
      },
      borderRadius: {
        DEFAULT: '0px',
        sm: '2px',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '32': '128px',
      },
    },
  },
  plugins: [],
};
