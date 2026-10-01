// Standing crops near the camera (Phase 7): tufts of blades on every field plot within R_c, one instanced draw call. Each
// tuft carries its plot's crop row and phenology offset (fields.ts landUseAt, the same decision the terrain shader makes),
// and its height and colour are read in the vertex shader from the crop-state texture for today's date, so barley rises
// through the winter, turns gold in May, is cut in late May-June and stands as grazed stubble until the autumn ploughing
// (seasonal.ts, C) without rebuilding anything. Past R_c the terrain shader carries the colour of the same plots.
import * as THREE from 'three/webgpu';
import { attribute, uniform, positionGeometry, normalGeometry, cameraPosition, vec3, vec4, float, int, ivec2, mix, smoothstep, length, textureLoad, sin, time, clamp, max, step, mx_noise_float } from 'three/tsl';
import { instanceTransform, instanceNormal } from './trees';
import type { Terrain } from '../../terrain/heightfield';
import { ZoneMap, landUseAt, hash2, unit, cellU } from './fields';
import { YEAR, ROW } from './seasonal';
import { cerealClumpGeometry } from './cropForms';

// D-356: the plant drawn is the modelled cereal clump (cropForms.ts); until session 14 a clump of 10 one-triangle blades
export interface NearCrops { mesh: THREE.Mesh; update(cam: THREE.Vector3, terrain: Terrain): boolean; count(): number }
export function nearCrops(zm: ZoneMap, cropTex: THREE.DataTexture, day: any, wind: any, radius: number, spacing: number): NearCrops {
  const max_ = Math.ceil((Math.PI * radius * radius) / (spacing * spacing) * 1.05);
  const mk = (g0: THREE.BufferGeometry, cap: number) => { const g = new THREE.InstancedBufferGeometry(); for (const [k, a] of Object.entries(g0.attributes)) g.setAttribute(k, a); g.instanceCount = 0;
    const inst = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); // row, offset days, seed, scale
    const posA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), sclA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    g.setAttribute('crop', inst); g.setAttribute('ipos', posA); g.setAttribute('iscl', sclA); return { g, inst, posA, sclA, cap, n: 0 }; };
  const SN = mk(cerealClumpGeometry(), max_);
  const ipos = attribute('ipos', 'vec3'), iscl = attribute('iscl', 'vec4');
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const a = attribute('crop', 'vec4'), tip = attribute('tip', 'float'), ear = attribute('ear', 'float'), ebase = attribute('ebase', 'vec3');
  const col = day.add(a.y).add(YEAR).mod(YEAR);
  const st = textureLoad(cropTex, ivec2(int(col), int(a.x)));
  const hCrop = st.x.mul(1.5), stubble = st.z.mul(step(hCrop, 0.02)).mul(0.14);
  const camD = length(ipos.xz.sub(cameraPosition.xz));
  const fade = float(1).sub(smoothstep(radius * 0.75, radius, camD));
  const h = max(hCrop, stubble).mul(a.w).mul(fade);
  const sway: any = sin(time.mul(2.1).add(a.z.mul(6.28))).mul(wind).mul(0.02).mul(tip).mul(h);
  const pg = positionGeometry;
  // vine rows (ROW.vineyard): a leafless stock is a narrow bundle of old wood; its spread opens as the shoots leaf out (C)
  const is = (r: number) => step(r - 0.5, a.x).mul(step(a.x, r + 0.5));
  const green = st.y, straw = st.z, isVine = is(ROW.vineyard), isPulse = is(ROW.pulses).add(is(ROW.alfalfa)), isGarden = is(ROW.garden), isFlax = is(ROW.flax), vLeaf = clamp(green.div(0.6), 0, 1);
  // pulses bushy and spreading, the garden's garlic and onion leaves upright and narrow (session 9, C)
  const spread = h.mul(0.6).add(0.4).mul(mix(float(1), vLeaf.mul(0.75).add(0.25), isVine)).mul(float(1).add(isPulse.mul(0.5)).sub(isGarden.mul(0.55)).sub(isFlax.mul(0.45))); // (alfalfa bushy as the pulses; flax slender, upright)
  // D-356: the ears (cropForms.ts) are out on the cereal rows from heading (the crop near its full height) to the harvest;
  // before that, and on every other row, each ear is folded onto its culm's top
  const isCereal = is(ROW.barley).add(is(ROW.wheat)).add(is(ROW.emmer_spelt)), earOut = isCereal.mul(smoothstep(0.45, 0.65, hCrop)).mul(ear).add(float(1).sub(ear));
  const pl = mix(ebase, pg, earOut);
  m.positionNode = instanceTransform(vec3(pl.x.mul(spread), pl.y.mul(h), pl.z.mul(spread)), iscl, ipos).add(vec3(sway, 0, sway.mul(0.5)));
  m.normalNode = instanceNormal(mix(normalGeometry, vec3(0, 1, 0), 0.75).normalize(), iscl); // leaves lit like a canopy, not like flat cards
  const gCol = mix(vec3(0.12, 0.2, 0.05), vec3(0.085, 0.155, 0.045), smoothstep(0.2, 0.8, hCrop)), sCol = mix(vec3(0.4, 0.34, 0.19), vec3(0.5, 0.39, 0.16), smoothstep(0.1, 0.4, hCrop));
  const cropTip = mix(gCol, sCol, clamp(straw.div(green.add(straw).max(0.01)), 0, 1));
  const vineTip = mix(vec3(0.075, 0.05, 0.032), vec3(0.1, 0.17, 0.05), vLeaf); // dark old wood, then the leaves
  // pulses a greyer green (chickpea, vetch), garlic and onion leaves blue-green (C)
  const cropTip2 = mix(mix(cropTip, cropTip.mul(vec3(1.05, 1.0, 1.15)), isPulse), mix(cropTip, vec3(0.09, 0.16, 0.11), green), isGarden);
  const tipCol = mix(cropTip2, vineTip, isVine);
  const baseCol = tipCol.mul(0.7);
  // the ears: green, then gold to pale straw as the crop ripens (C)
  const earCol = mix(vec3(0.16, 0.22, 0.07), vec3(0.52, 0.41, 0.2), clamp(straw.div(green.add(straw).max(0.01)), 0, 1));
  m.colorNode = mix(mix(baseCol, tipCol, tip), earCol, ear).mul(mx_noise_float(vec3(a.z.mul(40), 0, 0)).mul(0.15).add(1));
  m.roughnessNode = float(0.8);
  const mesh = new THREE.Mesh(SN.g, m); mesh.name = 'plain-crops-near'; mesh.frustumCulled = false; mesh.receiveShadow = true;
  let last = new THREE.Vector3(1e9, 0, 1e9), n = 0;
  return { mesh, count: () => n,
    update(cam, terrain) {
      if (Math.hypot(cam.x - last.x, cam.z - last.z) < radius * 0.12) return false;
      last = cam.clone(); n = 0; SN.n = 0;
      const i0 = Math.floor((cam.x - radius) / spacing), i1 = Math.ceil((cam.x + radius) / spacing), j0 = Math.floor((cam.z - radius) / spacing), j1 = Math.ceil((cam.z + radius) / spacing);
      for (let i = i0; i <= i1 && n < max_; i++) for (let j = j0; j <= j1 && n < max_; j++) {
        const hh = hash2(cellU(i), cellU(j), 91);
        const x = (i + 0.5 + 0.8 * (unit(hh) - 0.5)) * spacing, z = (j + 0.5 + 0.8 * (unit(hash2(cellU(i), cellU(j), 92)) - 0.5)) * spacing;
        const dc = Math.hypot(x - cam.x, z - cam.z); if (dc > radius) continue;
        const u = landUseAt(zm, x, z);
        if (u.use === 'natural' || u.row === 'orchard_floor') continue;
        if (u.plot.edge < 0.35 || u.plot.dEdge < 1.6) continue; // bunds and district tracks stay clear
        if (u.row === 'vineyard') { // vines only in their rows (2.5 m apart), as the shader draws them
          const across = ((x - u.plot.dSeed[0]) * Math.cos(u.plot.angle) + (z - u.plot.dSeed[1]) * Math.sin(u.plot.angle));
          const fr = ((across / 2.5) % 1 + 1) % 1; if (Math.abs(fr - 0.5) > 0.12) continue; } // the shader's rows are centred where fract = 0.5
        const S = SN, k = S.n++; n++; void dc;
        S.posA.setXYZ(k, x, terrain.surfaceAt(x, z), z); S.sclA.setXYZW(k, 1, 1, 1, unit(hh) * 6.283); // (the drawn surface, D-356)
        S.inst.setXYZW(k, u.rowIndex, u.offsetDays, unit(hash2(cellU(i), cellU(j), 93)), 0.8 + 0.4 * unit(hash2(cellU(i), cellU(j), 94)));
      }
      for (const S of [SN]) { S.g.instanceCount = S.n; S.posA.needsUpdate = S.sclA.needsUpdate = S.inst.needsUpdate = true; }
      return true;
    } };
}
void uniform; void vec4;
