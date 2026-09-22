import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0a0a0a',
        chrome: '#141414',
        ink: '#f5f5f7',
        muted: '#a1a1a6',
      },
    },
  },
  plugins: [],
};
export default config;
