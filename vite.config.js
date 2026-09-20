import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/oauth2callback': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
