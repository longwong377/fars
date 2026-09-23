import { defineConfig } from '@playwright/test';
// E2E_PORT picks the Vite port, so parallel worktrees never share (or silently reuse) another tree's server.
const PORT = process.env.E2E_PORT ?? '5183';
// Close-up render check of the sculpted orders and colossi (D-014): same as playwright.config.ts but on port 5183 so it
// can run beside a dev server on 5173. Run: npx playwright test -c playwright.sculpt.config.ts --project=webgpu
const common = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export default defineConfig({
  testDir: 'tests/e2e', testMatch: 'sculpt.spec.ts', timeout: 900_000, workers: 1, retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 960, height: 540 }, channel: 'chromium' },
  webServer: { command: `npx vite --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'webgpu', use: { launchOptions: { args: [...common, '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] } } },
    { name: 'webgl2', use: { launchOptions: { args: common } } },
  ],
});
