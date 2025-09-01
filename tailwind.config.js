/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cube-bg': 'linear-gradient(135deg, #0f0f1a, #1a1a2e)', // ❌ 这里写了 gradient，会报 NaN
      },
    },
  },
  plugins: [],
}
