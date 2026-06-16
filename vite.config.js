import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Le plugin biométrique n'est disponible que dans le runtime Capacitor natif.
      // On l'externalise pour que Vite ne tente pas de le bundler — il sera
      // résolu par Capacitor au moment de l'exécution sur Android.
      external: ['@capgo/capacitor-native-biometric'],
    },
  },
});
