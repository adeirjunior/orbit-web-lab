import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: { proxy: { '/api/push': 'http://127.0.0.1:3001' } },
  preview: { proxy: { '/api/push': 'http://127.0.0.1:3001' } }
});
