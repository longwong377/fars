import { defineConfig } from 'vite';
import worldCache from './tools/bake_world/vite_plugin.mjs'; // D-354: the baked world's hashes and its self-bake
// COOP/COEP so SharedArrayBuffer is available to simulation workers (brief §6 Delivery); mirrored in public/_headers.
const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
export default defineConfig({
  plugins: [worldCache()],
  // agents' worktrees (.claude/worktrees) are never watched: their edits reloaded the lead's pages mid-measurement (session 9);
  // NOHMR=1 (load probes, D-250): no reloads at all while a measurement runs
  server: { headers, port: 5173, watch: { ignored: ['**/.claude/**', '**/shots/**', '**/REVIEWS/**', '**/public/models/**', '**/public/world-cache/**'] }, hmr: process.env.NOHMR ? false : undefined },
  preview: { headers, port: 4173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
