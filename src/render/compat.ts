// WebGPU compatibility shim: three r186 always passes `swizzle: 'rgba'` in GPUTextureViewDescriptor. Chromium builds
// before the texture-component-swizzle API landed (e.g. the sandbox's Chromium 141) reject that field. Retry without
// it; this is a no-op on browsers that accept it. Logged in DECISIONS D-007.
export function installWebGPUCompat() {
  const G = (globalThis as any).GPUTexture;
  if (!G || G.prototype.__parsaPatched) return;
  const orig = G.prototype.createView;
  G.prototype.createView = function (desc?: any) {
    if (desc && 'swizzle' in desc && desc.swizzle === 'rgba') { const { swizzle, ...rest } = desc; void swizzle; return orig.call(this, rest); }
    return orig.call(this, desc);
  };
  G.prototype.__parsaPatched = true;
}
