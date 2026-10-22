/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#b91c1c",
          darkRed: "#7f1d1d",
          lightRed: "#fef2f2",
          black: "#0f0f0f",
          surface: "#f8f9fa",
        },
      },
      borderRadius: {
        "one-ui": "1.75rem",
        "one-ui-lg": "2.25rem",
      },
      boxShadow: {
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.08)",
        "card": "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
};
