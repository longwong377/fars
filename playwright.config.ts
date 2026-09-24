import { defineConfig } from '@playwright/test';
// E2E_PORT picks the Vite port, so parallel worktrees never share (or silently reuse) another tree's server.
const PORT = process.env.E2E_PORT ?? '5173';
// Headless Chromium with software rendering (SwiftShader). Two projects so each render path is tested separately and
// every test records which path it actually ran on (brief §6 Testing without my GPU).
const common = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export default defineConfig({
  testDir: 'tests/e2e', testIgnore: process.env.DBG ? [] : ['**/dbg_*.spec.ts'], // debug specs run only on request (DBG=1)
  timeout: +(process.env.PW_TIMEOUT ?? 600) * 1000, workers: 1, retries: 0, // PW_TIMEOUT (s): per test, for loaded boxes
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 960, height: 540 }, channel: 'chromium' },
  webServer: { command: `npx vite --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'webgpu', use: { launchOptions: { args: [...common, '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] } } },
    { name: 'webgl2', use: { launchOptions: { args: common } } },
  ],
});
