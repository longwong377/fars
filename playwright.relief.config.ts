import { defineConfig } from '@playwright/test';
// Relief close-ups (D-015) on a private port (5173 is used by other sessions). Same SwiftShader setup as playwright.config.ts.
//   npx playwright test -c playwright.relief.config.ts --project=webgpu
const common = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export default defineConfig({
  testDir: 'tests/e2e', testMatch: /relief2\.spec\.ts/, timeout: 900_000, workers: 1, retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5184', viewport: { width: 960, height: 540 }, channel: 'chromium' },
  webServer: { command: 'npx vite --port 5184 --strictPort', url: 'http://localhost:5184', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'webgpu', use: { launchOptions: { args: [...common, '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] } } },
    { name: 'webgl2', use: { launchOptions: { args: common } } },
  ],
});
