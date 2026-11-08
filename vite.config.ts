import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          parser: ['node-sql-parser/build/sqlite'],
          editor: ['@uiw/react-codemirror', '@codemirror/lang-sql'],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
} as never);
