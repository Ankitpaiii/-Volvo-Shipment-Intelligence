/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        volvo: {
          blue: "#003057",
          light: "#1c6bba",
          accent: "#00a0e3",
        },
      },
    },
  },
  plugins: [],
};
