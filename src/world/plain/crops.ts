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
import { YEAR } from './seasonal';

function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], lean: number[] = [];
  const blades = 6;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + 0.3 * Math.sin(b * 7.1), r = 0.05 + 0.06 * ((b * 37) % 5) / 5, lx = Math.cos(a), lz = Math.sin(a);
    const w = 0.012, x0 = lx * r, z0 = lz * r, px = -lz * w, pz = lx * w, tl = 0.18; // blade base at radius r, leaning outward by tl at the tip
    // two triangles: base left, base right, tip
    pos.push(x0 - px, 0, z0 - pz, x0 + px, 0, z0 + pz, x0 + lx * tl, 1, z0 + lz * tl);
    pos.push(x0 + px, 0, z0 + pz, x0 - px, 0, z0 - pz, x0 + lx * tl, 1, z0 + lz * tl); // back face
    for (let k = 0; k < 6; k++) lean.push(k % 3 === 2 ? 1 : 0);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('tip', new THREE.Float32BufferAttribute(lean, 1)); g.computeVertexNormals();
  return g;
}

export interface NearCrops { mesh: THREE.Mesh; update(cam: THREE.Vector3, terrain: Terrain): boolean; count(): number }
export function nearCrops(zm: ZoneMap, cropTex: THREE.DataTexture, day: any, wind: any, radius: number, spacing: number): NearCrops {
  const max_ = Math.ceil((Math.PI * radius * radius) / (spacing * spacing) * 1.05);
  const g0 = tuftGeometry(), g = new THREE.InstancedBufferGeometry(); for (const [k, a] of Object.entries(g0.attributes)) g.setAttribute(k, a); g.instanceCount = 0;
  const inst = new THREE.InstancedBufferAttribute(new Float32Array(max_ * 4), 4); // row, offset days, seed, scale
  const posA = new THREE.InstancedBufferAttribute(new Float32Array(max_ * 3), 3), sclA = new THREE.InstancedBufferAttribute(new Float32Array(max_ * 4), 4);
  g.setAttribute('crop', inst); g.setAttribute('ipos', posA); g.setAttribute('iscl', sclA);
  const ipos = attribute('ipos', 'vec3'), iscl = attribute('iscl', 'vec4');
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const a = attribute('crop', 'vec4'), tip = attribute('tip', 'float');
  const col = day.add(a.y).add(YEAR).mod(YEAR);
  const st = textureLoad(cropTex, ivec2(int(col), int(a.x)));
  const hCrop = st.x.mul(1.5), stubble = st.z.mul(step(hCrop, 0.02)).mul(0.14);
  const camD = length(ipos.xz.sub(cameraPosition.xz));
  const fade = float(1).sub(smoothstep(radius * 0.75, radius, camD));
  const h = max(hCrop, stubble).mul(a.w).mul(fade);
  const sway: any = sin(time.mul(2.1).add(a.z.mul(6.28))).mul(wind).mul(0.02).mul(tip).mul(h);
  const pg = positionGeometry;
  m.positionNode = instanceTransform(vec3(pg.x.mul(h.mul(0.6).add(0.4)), pg.y.mul(h), pg.z.mul(h.mul(0.6).add(0.4))), iscl, ipos).add(vec3(sway, 0, sway.mul(0.5)));
  m.normalNode = instanceNormal(normalGeometry, iscl);
  const green = st.y, straw = st.z;
  const gCol = mix(vec3(0.16, 0.24, 0.07), vec3(0.11, 0.17, 0.06), smoothstep(0.2, 0.8, hCrop)), sCol = mix(vec3(0.42, 0.36, 0.2), vec3(0.47, 0.37, 0.16), smoothstep(0.1, 0.4, hCrop));
  const tipCol = mix(gCol, sCol, clamp(straw.div(green.add(straw).max(0.01)), 0, 1));
  const baseCol = mix(tipCol.mul(0.55), vec3(0.08, 0.1, 0.04), green.mul(0.3));
  m.colorNode = mix(baseCol, tipCol, tip).mul(mx_noise_float(vec3(a.z.mul(40), 0, 0)).mul(0.15).add(1));
  m.roughnessNode = float(0.8);
  const mesh = new THREE.Mesh(g, m); mesh.name = 'plain-crops-near'; mesh.frustumCulled = false; mesh.receiveShadow = true;
  let last = new THREE.Vector3(1e9, 0, 1e9), n = 0;
  return { mesh, count: () => n,
    update(cam, terrain) {
      if (Math.hypot(cam.x - last.x, cam.z - last.z) < radius * 0.12) return false;
      last = cam.clone(); n = 0;
      const i0 = Math.floor((cam.x - radius) / spacing), i1 = Math.ceil((cam.x + radius) / spacing), j0 = Math.floor((cam.z - radius) / spacing), j1 = Math.ceil((cam.z + radius) / spacing);
      for (let i = i0; i <= i1 && n < max_; i++) for (let j = j0; j <= j1 && n < max_; j++) {
        const hh = hash2(cellU(i), cellU(j), 91);
        const x = (i + 0.5 + 0.8 * (unit(hh) - 0.5)) * spacing, z = (j + 0.5 + 0.8 * (unit(hash2(cellU(i), cellU(j), 92)) - 0.5)) * spacing;
        if (Math.hypot(x - cam.x, z - cam.z) > radius) continue;
        const u = landUseAt(zm, x, z);
        if (u.use === 'natural' || u.row === 'orchard_floor') continue;
        if (u.plot.edge < 0.35 || u.plot.dEdge < 1.6) continue; // bunds and district tracks stay clear
        if (u.row === 'vineyard') { // vines only in their rows (2.5 m apart), as the shader draws them
          const across = ((x - u.plot.dSeed[0]) * Math.cos(u.plot.angle) + (z - u.plot.dSeed[1]) * Math.sin(u.plot.angle));
          const fr = ((across / 2.5) % 1 + 1) % 1; if (Math.abs(fr - 0.5) > 0.12) continue; } // the shader's rows are centred where fract = 0.5
        posA.setXYZ(n, x, terrain.heightAt(x, z), z); sclA.setXYZW(n, 1, 1, 1, unit(hh) * 6.283);
        inst.setXYZW(n, u.rowIndex, u.offsetDays, unit(hash2(cellU(i), cellU(j), 93)), 0.8 + 0.4 * unit(hash2(cellU(i), cellU(j), 94)));
        n++;
      }
      g.instanceCount = n; posA.needsUpdate = sclA.needsUpdate = inst.needsUpdate = true;
      return true;
    } };
}
void uniform; void vec4;
