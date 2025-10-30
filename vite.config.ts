import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: './app/renderer',
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false, // Don't auto-open browser - Electron will load it
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});

