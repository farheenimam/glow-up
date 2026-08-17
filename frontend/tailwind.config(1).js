/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b1712',
        parchment: '#f5efe4',
        clay: '#c96b4a',
        moss: '#4c5d43',
        gold: '#c9a15a',
        rose: '#d98b8b',
        graphite: '#3a352e',
        sand: '#e7ddc9'
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"General Sans"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace']
      },
      backgroundImage: {
        grain: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E\")"
      },
      boxShadow: {
        editorial: '0 30px 80px -20px rgba(27, 23, 18, 0.35)'
      }
    }
  },
  plugins: []
}
