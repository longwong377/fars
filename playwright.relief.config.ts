import { defineConfig } from '@playwright/test';
// E2E_PORT picks the Vite port, so parallel worktrees never share (or silently reuse) another tree's server.
const PORT = process.env.E2E_PORT ?? '5184';
// Relief close-ups (D-015) on a private port (5173 is used by other sessions). Same SwiftShader setup as playwright.config.ts.
//   npx playwright test -c playwright.relief.config.ts --project=webgpu
const common = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export default defineConfig({
  testDir: 'tests/e2e', testMatch: /relief2\.spec\.ts/, timeout: 900_000, workers: 1, retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 960, height: 540 }, channel: 'chromium' },
  webServer: { command: `npx vite --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'webgpu', use: { launchOptions: { args: [...common, '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] } } },
    { name: 'webgl2', use: { launchOptions: { args: common } } },
  ],
});
