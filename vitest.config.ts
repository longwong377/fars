import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync } from 'node:fs';
// Tiers (D-251, D-360): `npm run test:fast` (vitest --mode fast) skips the gate tier listed in tests/tiers.json (measured by
// tools/dev/test_tiers.ts); `npm run test:slow` (--mode slow, through tools/dev/cpu_slot.mjs) runs only that tier. Without a
// mode every file runs: `npm test` and the session gate are unchanged. (TIER=fast in the environment still works.)
const ALL = ['tests/**/*.test.ts'];
export default defineConfig(({ mode }) => {
  const tier = mode === 'fast' || mode === 'slow' ? mode : process.env.TIER;
  const gate: string[] = (tier === 'fast' || tier === 'slow') && existsSync('tests/tiers.json') ? JSON.parse(readFileSync('tests/tiers.json', 'utf8')).gate : [];
  return { test: { include: tier === 'slow' ? gate : ALL, exclude: ['**/node_modules/**', '**/.claude/**', ...(tier === 'fast' ? gate : [])], testTimeout: 120000, fsModuleCache: true } }; // fsModuleCache: transforms kept on disk between runs (D-251)
});
