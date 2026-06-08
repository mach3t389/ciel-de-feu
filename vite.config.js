import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2022',
  },
});
