import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative asset paths work seamlessly on GitHub Pages
  server: {
    port: 5173,
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
