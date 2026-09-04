/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // `class` strategy: dark mode is toggled by adding/removing the `dark` class
  // on <html>. The theme provider (ThemeContext.tsx) handles persistence.
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      colors: {
        apple: {
          blue: '#0071e3',
          'blue-hover': '#0077ed',
          'blue-light': '#42a1ec',
          gray: '#86868b',
          'gray-light': '#f5f5f7',
          'gray-medium': '#d2d2d7',
          'gray-dark': '#1d1d1f',
          bg: '#f5f5f7',
          surface: '#ffffff',
          'surface-secondary': '#fbfbfd',
        },
      },
      borderRadius: {
        'apple-sm': '8px',
        'apple-md': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
        'apple-2xl': '24px',
      },
      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'apple-md': '0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'apple-lg': '0 8px 28px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'apple-xl': '0 14px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.04)',
      },
      backdropBlur: {
        'apple': '20px',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
    },
  },
  plugins: [],
}
