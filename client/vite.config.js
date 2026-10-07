import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': shared } },
  server: {
    port: 5173,
    fs: { allow: ['..'] }, // the app imports ../shared
    // In development /api is forwarded to the Express API (npm run dev:api on port 4000).
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: { outDir: 'dist', emptyOutDir: true }, // client/dist: the folder Vercel serves
});
