import { defineConfig } from '@playwright/test';
// Headless Chromium with software rendering (SwiftShader). Two projects so each render path is tested separately and
// every test records which path it actually ran on (brief §6 Testing without my GPU).
const common = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export default defineConfig({
  testDir: 'tests/e2e', timeout: 600_000, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: 'http://localhost:5173', viewport: { width: 960, height: 540 }, channel: 'chromium' },
  webServer: { command: 'npx vite --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'webgpu', use: { launchOptions: { args: [...common, '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] } } },
    { name: 'webgl2', use: { launchOptions: { args: common } } },
  ],
});
