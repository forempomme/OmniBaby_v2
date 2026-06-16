import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    // Ne pas externaliser @capgo/capacitor-native-biometric —
    // on accède au plugin via window.Capacitor.Plugins.NativeBiometric
    // (bridge natif), donc Vite n'a pas besoin de le bundler du tout.
    // On le met en external pour éviter l'erreur de résolution.
    rollupOptions: {
      external: ['@capgo/capacitor-native-biometric'],
    },
  },
});
