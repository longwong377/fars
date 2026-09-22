# Preflight — session 1, 2026-09-22
| Tool | Version | Note |
|---|---|---|
| Node | 22.22.2 | npm 10.9.7 |
| Python | 3.11.15 | rasterio 1.4.4 installed |
| Chromium | Playwright chromium-1194 at /opt/pw-browsers | headless, no GPU → SwiftShader |
| Blender | not installed as app; `bpy` 5.0.1 wheel available on PyPI | headless asset processing via pip `bpy` |
| eSpeak-NG | not installed; PyPI `espeakng` wrapper only | apt blocked? checked in Phase 3 |
| Disk | 30 GB free allowance | budget: ≤ 8 GB for data + node_modules + intermediates |
| CPU/RAM | 4 cores / 15 GB | |

Network: see NEEDS_FROM_ME.md. Copernicus GLO-30 tiles N29E052, N29E053, N30E052, N30E053 all present in
tileList.txt and downloaded to `data/dem/` (≈151 MB, gitignored). Sample at 29.9355N 52.8906E shows plain ~1612 m,
terrace ~1625–1631 m, slope rising east — consistent with a ~12–18 m terrace (to be verified in SITE_SPEC).
Fonts: `@fontsource/noto-sans-old-persian|cuneiform|imperial-aramaic` 5.3.0 on npm (OFL) — resolves need #9.

## Headless GPU paths (measured)
Playwright 1.56, `channel: 'chromium'` (new headless), page served from http://localhost (secure context):
- flags `--enable-unsafe-webgpu --use-angle=swiftshader --enable-features=Vulkan --use-webgpu-adapter=swiftshader`
  → `navigator.gpu` adapter **google/swiftshader** (WebGPU path testable) + WebGL2 on ANGLE/SwiftShader Vulkan.
- without the WebGPU flags → no adapter → WebGL2 fallback path. Both paths are therefore testable separately.
