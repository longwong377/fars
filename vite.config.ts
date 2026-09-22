import { defineConfig } from 'vite';
// COOP/COEP so SharedArrayBuffer is available to simulation workers (brief §6 Delivery); mirrored in public/_headers.
const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
export default defineConfig({
  server: { headers, port: 5173 },
  preview: { headers, port: 4173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
