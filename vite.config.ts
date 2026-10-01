import { defineConfig } from 'vite';
// COOP/COEP so SharedArrayBuffer is available to simulation workers (brief §6 Delivery); mirrored in public/_headers.
const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR ?? '.vite', // per tree (session 14): worktrees share node_modules by junction, and a shared optimize cache gave 504 Outdated Optimize Dep across trees
  // agents' worktrees (.claude/worktrees) are never watched: their edits reloaded the lead's pages mid-measurement (session 9);
  // NOHMR=1 (load probes, D-250): no reloads at all while a measurement runs
  server: { headers, port: 5173, watch: { ignored: ['**/.claude/**', '**/shots/**', '**/REVIEWS/**', '**/public/models/**'] }, hmr: process.env.NOHMR ? false : undefined },
  preview: { headers, port: 4173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
