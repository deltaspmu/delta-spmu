/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Surfaces ── */
        alabaster: "#F4F1E8",      // warm cream background
        cream: "#F4F1E8",          // alias

        /* ── Deep forest-olive — headings, dark sections, dark text ── */
        charcoal: "#2F3D2A",
        "charcoal-light": "#445239",

        /* ── Olive / sage — primary brand green: top bar, primary buttons, bands ── */
        olive: "#8B8D5A",
        "olive-dark": "#73754A",
        "olive-light": "#A6A877",

        /* ── Terracotta / copper — accent pop: highlighted words, key CTAs, links ── */
        terracotta: "#C0703C",
        "terracotta-dark": "#A5592C",

        /* ── Champagne tan — soft icon circles & dividers ── */
        tan: "#D8C7A1",

        /* ── Legacy aliases (back-compat for existing components):
              the old gold "nude" tokens now resolve to the terracotta accent ── */
        nude: "#C0703C",
        "nude-dark": "#A5592C",
      },
      fontFamily: {
        heading: ["Wensley", "serif"],
        body: ["Visia Pro", "sans-serif"],
      },
      letterSpacing: {
        editorial: "0.08em",
        wide: "0.2em",
      },
    },
  },
  plugins: [],
};
