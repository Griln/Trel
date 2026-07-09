import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // Increased because manualChunks splits vendor libs; individual chunks can exceed default 500KB
    rollupOptions: {
      output: {
        // Разносим тяжёлые сторонние библиотеки в отдельные chunk'и,
        // чтобы three (~600 КБ) грузилось только когда пользователь
        // открыл вкладку «Скин», и кешировалось отдельно от прикладного кода.
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
