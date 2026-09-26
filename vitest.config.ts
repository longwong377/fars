import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync } from 'node:fs';
// TIER=fast (npm run test:fast, D-251): skip the gate tier listed in tests/tiers.json (measured by tools/dev/test_tiers.ts).
// Without TIER every file runs: `npm test` and the session gate are unchanged.
const gate: string[] = process.env.TIER === 'fast' && existsSync('tests/tiers.json') ? JSON.parse(readFileSync('tests/tiers.json', 'utf8')).gate : [];
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], exclude: ['**/node_modules/**', '**/.claude/**', ...gate], testTimeout: 120000 } });
