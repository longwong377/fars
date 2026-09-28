// D-329: the monuments' materials stay within the page's fragment samplers (D-300's rule: a surface's node-built fragment
// declares at most 6 samplers, the page adds ~9 of its own, WebGPU allows 16), with every scan loaded and the models drawn.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadInscriptionFonts } from '../src/arch/decor';
import * as THREE from 'three/webgpu';
import { setScanTexturesForTest } from '../src/render/scans';
import { installProbeLight } from '../src/render/probes/runtime';
import { loadMonumentsNode } from './lib/monuments_node';
import { clearMonuments } from '../src/render/monuments';
import { buildAjori } from '../src/world/settlement/ajori';
import { buildTownPlan } from '../src/world/settlement/plan';
import { buildNaqsh } from '../src/world/plain/naqsh';
import { loadTerrain, loadRiversFile } from './plainLib';
const NODE_MAX = 6;
beforeAll(async () => { await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }); });
describe('D-329 monument materials: fragment samplers (node)', () => {
  it('every monument mesh material declares <= 6 samplers', () => {
    setScanTexturesForTest(); clearMonuments(); loadMonumentsNode();
    try {
      const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
      const r: any = new (THREE as any).WebGPURenderer({ canvas }); installProbeLight(r); r.hasFeature = () => true;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(new THREE.HemisphereLight(), sun);
      const count = (mesh: THREE.Mesh) => { const b = new (THREE as any).WGSLNodeBuilder(mesh, r); b.scene = scene; b.camera = cam; b.material = mesh.material; b.lightsNode = r.lighting.getNode(scene, cam); b.build(); return ((b.fragmentShader as string).match(/: sampler[;\s]|sampler_comparison/g) ?? []).length; };
      const rows: string[] = [], over: string[] = [];
      const check = (g: THREE.Object3D) => g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || !(m.material as any).name?.startsWith?.('monument') && !/nr_|nr-|tol_ajori/.test(m.name)) return;
        if ((m.material as THREE.Material).visible === false) return; const n = count(m); rows.push(`${m.name} ${n}`); if (n > NODE_MAX) over.push(`${m.name}: ${n}`); });
      const { gate } = buildTownPlan(); check(buildAjori(gate, () => 1600).group);
      const T = loadTerrain(), R = loadRiversFile(); check(buildNaqsh(T, R.nrAncientFootAsl).group);
      console.log(rows.join('\n')); expect(over, rows.join(', ')).toEqual([]);
    } finally { setScanTexturesForTest(false); }
  }, 600_000);
});
