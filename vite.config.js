import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Traiter les fichiers .js comme du JSX (store.js, utils.js)
      include: ['**/*.jsx', '**/*.js'],
    }),
  ],
  base: './',
  build: {
    outDir: 'dist',
  },
});
