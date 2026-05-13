/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: '#2563eb',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '68ch',
            lineHeight: '1.7',
            fontSize: '1.125rem',
          },
        },
      },
    },
  },
  plugins: [],
};
