import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the build from /<repo>/, a dev server from /.
  base: mode === 'pages' ? '/countryball-war/' : '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5178,
    host: true,
  },
}));
