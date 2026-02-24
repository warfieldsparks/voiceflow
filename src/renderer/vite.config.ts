import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  base: './',
  build: {
    outDir: resolve(__dirname, '../../dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
});
