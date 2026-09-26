// dev (D-250): time how long Chromium's SwiftShader takes to compile and first-draw one WGSL render pipeline (vertex +
// fragment files written by tools/dev/wgsl_dump.ts), for A/B tests of shader-shape changes without a full page load.
// Usage: node tools/dev/ss_compile.mjs <port> <a.vert.wgsl> <a.wgsl> [<b.vert.wgsl> <b.wgsl> …]  (any vite server on <port>)
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const [port, ...files] = process.argv.slice(2);
const pairs = []; for (let i = 0; i < files.length; i += 2) pairs.push({ name: files[i + 1], vs: readFileSync(files[i], 'utf8'), fs: readFileSync(files[i + 1], 'utf8') });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const b = await chromium.launch({ headless: true, args });
const page = await b.newPage(); page.on('console', m => console.log(m.text()));
await page.goto(`http://localhost:${port}/package.json`);
await page.evaluate(async (pairs) => {
  const ad = await navigator.gpu.requestAdapter(); const dev = await ad.requestDevice({ requiredFeatures: ad.features.has('float32-filterable') ? ['float32-filterable'] : [] });
  dev.addEventListener('uncapturederror', e => console.log('GPU error:', e.error.message.slice(0, 400)));
  const binds = (src) => { const out = []; const re = /@binding\(\s*(\d+)\s*\)\s*@group\(\s*(\d+)\s*\)\s*var(<[^>]*>)?\s+(\w+)\s*:\s*([\w<>, ]+);/g; let m; while ((m = re.exec(src))) out.push({ b: +m[1], g: +m[2], kind: m[3] ?? '', name: m[4], type: m[5].trim() }); return out; };
  for (const p of pairs) {
    const t0 = performance.now();
    const vm = dev.createShaderModule({ code: p.vs }), fm = dev.createShaderModule({ code: p.fs });
    const attrs = [...p.vs.matchAll(/@location\(\s*(\d+)\s*\)\s*(\w+)\s*:\s*vec(\d)<f32>/g)].filter(m => p.vs.indexOf(m[0]) > p.vs.indexOf('fn main'));
    const buffers = attrs.map(m => ({ arrayStride: 4 * +m[3], attributes: [{ shaderLocation: +m[1], offset: 0, format: `float32x${m[3]}` }] }));
    const pipe = dev.createRenderPipeline({ layout: 'auto', vertex: { module: vm, entryPoint: 'main', buffers }, fragment: { module: fm, entryPoint: 'main', targets: [{ format: 'rgba16float' }] }, primitive: { topology: 'triangle-list' } });
    const all = [...binds(p.vs), ...binds(p.fs)], groups = new Map();
    for (const x of all) { if (!groups.has(x.g)) groups.set(x.g, new Map()); groups.get(x.g).set(x.b, x); }
    const res = (x) => { if (x.kind.includes('uniform')) { const buf = dev.createBuffer({ size: 65536, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(buf, 0, new Float32Array(16384).fill(0.1)); return { buffer: buf }; }
      if (x.kind.includes('storage')) return { buffer: dev.createBuffer({ size: 1 << 20, usage: GPUBufferUsage.STORAGE }) };
      if (x.type.startsWith('sampler_comparison')) return dev.createSampler({ compare: 'less' });
      if (x.type.startsWith('sampler')) return dev.createSampler({ magFilter: 'linear', minFilter: 'linear' });
      if (x.type.startsWith('texture_depth')) return dev.createTexture({ size: [4, 4], format: 'depth32float', usage: GPUTextureUsage.TEXTURE_BINDING }).createView();
      if (x.type.startsWith('texture_cube')) return dev.createTexture({ size: [4, 4, 6], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING }).createView({ dimension: 'cube' });
      if (x.type.startsWith('texture_3d')) return dev.createTexture({ size: [4, 4, 4], dimension: '3d', format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING }).createView();
      if (x.type.startsWith('texture_2d_array')) return dev.createTexture({ size: [4, 4, 2], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING }).createView({ dimension: '2d-array' });
      return dev.createTexture({ size: [4, 4], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING }).createView(); };
    const bgs = [...groups].map(([g, m]) => [g, dev.createBindGroup({ layout: pipe.getBindGroupLayout(g), entries: [...m.values()].map(x => ({ binding: x.b, resource: res(x) })) })]);
    const tgt = dev.createTexture({ size: [256, 256], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    const vb = dev.createBuffer({ size: 1024, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true }); new Float32Array(vb.getMappedRange()).set([-1, -1, 0, 3, -1, 0, -1, 3, 0, 0, 0, 1]); vb.unmap();
    const e = dev.createCommandEncoder(); const rp = e.beginRenderPass({ colorAttachments: [{ view: tgt.createView(), loadOp: 'clear', storeOp: 'store' }] });
    rp.setPipeline(pipe); for (const [g, bg] of bgs) rp.setBindGroup(g, bg); buffers.forEach((_, i) => rp.setVertexBuffer(i, vb)); rp.draw(3); rp.end(); dev.queue.submit([e.finish()]);
    await dev.queue.onSubmittedWorkDone();
    console.log(`${p.name}: ${((performance.now() - t0) / 1000).toFixed(2)} s (fragment ${p.fs.length} chars)`);
  }
}, pairs);
await b.close();
