// dev (D-285): the fragment shader cost of the surface materials D-285 touches, built to WGSL in node (no GPU): the WGSL
// size, the arithmetic operators and the noise calls per material, for the current src/render/materials.ts and for another
// copy of it (e.g. the one before D-285, written next to it by `git show <rev>:src/render/materials.ts > src/render/materials_before.ts`).
// tools/dev/shader_sizes.mjs measures the whole page's pipelines on SwiftShader under Linux (/proc); this is its per-material
// counterpart that runs anywhere.
// Run: npx tsx tools/dev/shader_cost_d285.ts [../../src/render/materials_before]
import * as THREE from 'three/webgpu';
const g = globalThis as any;
g.navigator ??= { gpu: undefined, userAgent: 'node' }; g.self ??= g; g.window ??= g; g.document ??= { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {} }) };
const KEYS: [string, boolean][] = [['limestone', false], ['limestone', true], ['terrace', false], ['mudbrick', true], ['mudbrick_painted', true], ['plaster', true], ['court_fill', false]];
/** the operators executed once through the fragment entry point: its own, plus each function it calls times that function's
 *  own count (recursively; loops counted once): a static proxy for the shader's ALU cost that weights a noise call by its body */
function alu(fs: string) {
  const fns = new Map<string, string>(); const re = /fn\s+(\w+)\s*\(/g; let m: RegExpExecArray | null;
  while ((m = re.exec(fs))) { let i = fs.indexOf('{', m.index), d = 0, j = i; for (; j < fs.length; j++) { if (fs[j] === '{') d++; else if (fs[j] === '}' && --d === 0) break; } fns.set(m[1], fs.slice(i, j + 1)); }
  const memo = new Map<string, number>();
  const cost = (name: string, seen: Set<string>): number => {
    if (memo.has(name)) return memo.get(name)!; const body = fns.get(name) ?? ''; if (seen.has(name)) return 0; seen.add(name);
    let c = (body.match(/[-+*/](?![=>])/g) ?? []).length;
    for (const [f] of fns) if (f !== name) { const n = (body.match(new RegExp('\\b' + f + '\\s*\\(', 'g')) ?? []).length; if (n) c += n * cost(f, seen); }
    seen.delete(name); memo.set(name, c); return c;
  };
  return cost('main', new Set());
}
async function measure(mod: string) {
  const { surfaceMaterial } = await import(mod);
  const { installProbeLight } = await import('../../src/render/probes/runtime');
  const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(r); r.hasFeature = () => true;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 1e5);
  const out: Record<string, { chars: number; ops: number; noise: number; lines: number; alu: number }> = {};
  const oe = console.error, ow = console.warn; console.error = () => {}; console.warn = () => {};
  try {
    for (const [k, arch] of KEYS) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      if (arch) for (const a of ['y0', 'ytop', 'roofed']) geo.setAttribute(a, new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count), 1));
      const mesh = new THREE.Mesh(geo, surfaceMaterial(k, { arch }));
      const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = camera; b.material = mesh.material; b.lightsNode = r.lighting.getNode(scene, camera); b.build();
      const fs: string = b.fragmentShader;
      out[`${k}${arch ? ' (arch)' : ''}`] = { chars: fs.length, lines: fs.split('\n').length, ops: (fs.match(/[-+*/](?![=>])/g) ?? []).length, noise: (fs.match(/mx_(perlin|noise)\w*\s*\(/g) ?? []).length, alu: alu(fs) };
    }
  } finally { console.error = oe; console.warn = ow; }
  return out;
}
const now = await measure('../../src/render/materials');
const alt = process.argv[2] ? await measure(process.argv[2]) : null;
console.log('| material | WGSL chars | operators | noise calls | ALU (inlined) |' + (alt ? ' before: chars / operators / noise / ALU | change: chars, ALU |' : ''));
for (const [k, v] of Object.entries(now)) {
  const a = alt?.[k];
  console.log(`| ${k} | ${v.chars} | ${v.ops} | ${v.noise} | ${v.alu} |` + (a ? ` ${a.chars} / ${a.ops} / ${a.noise} / ${a.alu} | ${((v.chars / a.chars - 1) * 100).toFixed(1)} %, ${((v.alu / a.alu - 1) * 100).toFixed(1)} % |` : ''));
}
