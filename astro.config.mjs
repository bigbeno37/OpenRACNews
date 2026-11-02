// @ts-check
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// The deploy workflow passes these from GitHub Pages' own settings, so the site works under any
// repository name or a custom domain without a change here.
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.BASE_PATH || undefined,
  trailingSlash: 'always',
  vite: { plugins: [tailwindcss()] },
});
