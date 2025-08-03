/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: {
        "tiempos-headline": ["'Tiempos Headline'", "serif"],
        "space-mono": ["'Space Mono'", "monospace"],
        "untitled-sans": ["'Untitled Sans'", "sans-serif"],
      },
      colors: {
        "terrahacks-gray": "#FBF8EF",
        "terrahacks-lightgray": "#696766",
        "terrahacks-green": "#C8D183",
      },
    },
  },
  plugins: [],
};
