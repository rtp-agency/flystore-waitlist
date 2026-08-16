import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Чистая статика: страница это один html, а единственный запрос к серверу
// делает форма. Адаптер под фреймворк не нужен, и это же значит, что сайт
// одинаково встаёт на Cloudflare Pages, Vercel, Netlify и на любой nginx.
export default defineConfig({
  site: 'https://flystore.app',
  vite: {
    plugins: [tailwindcss()],
  },
});
