// The Pulvar and the Kur (Phase 7, D-037): a corridor mesh (channel bed, banks, and an apron that meets the terrain) over
// the channel that tools/build_terrain.py carves into the heightfield, and a water surface whose width and level follow
// the monthly flow table (plain.json flow_by_month, C) through uniforms, so the river rises and falls with the date
// without rebuilding geometry. Courses are the modern OSM lines (C for 467, Q-055); the cross-section is the trapezoid
// fitted to the flow table (plain.json channel, C).
//
// Distance lift: beyond ~1.5 km the terrain draws its chunks at coarser steps that can bridge the carved channel, so the
// corridor and the water are raised in the vertex shader by up to 3 m with distance (0.07 deg at 2.5 km, sub-pixel);
// near the viewer they sit exactly where the colliders are.
import * as THREE from 'three/webgpu';
import { attribute, uniform, positionLocal, positionWorld, cameraPosition, cameraViewMatrix, vec2, vec3, vec4, float, mix, smoothstep, clamp, length, sin, cos, dot, normalize, max, pow, mx_noise_float, time, color, step, abs } from 'three/tsl';
import { rippleNormal, waterBody, skyReflection, waterRoughness, WATER_SKY } from './waterShade';
import type { Terrain } from '../../terrain/heightfield';
import { curvatureDrop } from '../../terrain/heightfield';
import { surfaceMaterial, type Layer } from '../../render/materials';
import type { RiverProfile } from './data';
import type { Canal } from './canals';
import { feature, tag } from './data';

export const LIFT = { start: 1200, full: 2500, max: 3 } as const;
/** vertex-shader lift (m) as a function of camera distance: keeps far ribbons above coarse terrain LODs */
export function liftNode(p: any) { const d = length(p.xz.sub(cameraPosition.xz)); return smoothstep(LIFT.start, LIFT.full, d).mul(LIFT.max); }

interface Section { x: number; y: number; tx: number; ty: number; bank: number; s: number; ring: 'mid' | 'far' }
/** centreline sections: 10 m spacing within 12 km of the Apadana, 30 m beyond; tangents smoothed over +-60 m */
function sections(r: RiverProfile): Section[] {
  const out: Section[] = []; const n = r.x.length; let s = 0, acc = 0;
  for (let i = 0; i < n - 1; i++) {
    const near = Math.hypot(r.x[i], r.y[i]) < 12000, step = near ? 10 : 30;
    const seg = Math.hypot(r.x[i + 1] - r.x[i], r.y[i + 1] - r.y[i]);
    for (; acc < seg; acc += step) {
      const t = acc / seg, x = r.x[i] + (r.x[i + 1] - r.x[i]) * t, y = r.y[i] + (r.y[i + 1] - r.y[i]) * t;
      const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 4);
      let tx = r.x[b] - r.x[a], ty = r.y[b] - r.y[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const ring = Math.abs(x) < 10240 - 200 && Math.abs(y) < 10240 - 200 ? 'mid' : 'far';
      out.push({ x, y, tx, ty, bank: r.bank[i] + (r.bank[i + 1] - r.bank[i]) * t, s: s + acc, ring });
    }
    acc -= seg; s += seg;
  }
  return out;
}

/** one cross-section of the corridor mesh as drawn: centre (grid), left normal and tangent (grid), distance along the river,
 *  and its 13 vertices (0 centre, 1-6 right side outward, 7-12 left side outward): signed lateral offset (m), height
 *  (world y, before the distance lift), height above the bed (m) and apron fraction t (0 inside the channel) */
export interface CorridorSection { ri: number; x: number; y: number; nx: number; ny: number; tx: number; ty: number; s: number; off: Float32Array; hy: Float32Array; hrel: Float32Array; t: Float32Array }
export interface RiverBuild { group: THREE.Group; banks: THREE.Mesh; water: THREE.Mesh; profiles: CorridorSection[][]; update(dayState: { pulvar: { width: number; depth: number; turbid: number; flowRel: number }; kur: { width: number; depth: number; turbid: number; flowRel: number }; margins?: { grassGreen: number } }, sky: { sky: THREE.Color; horizon: THREE.Color }): void;
  segments: { cx: number; cy: number; pos: Float32Array; idx: Uint32Array }[]; stats(): { tris: number; sections: number } }

export function buildRivers(terrain: Terrain, rivers: RiverProfile[], canals: Canal[] = []): RiverBuild {
  const court = terrain.meta.court_asl;
  const wy = (asl: number, x: number, y: number) => asl - court - curvatureDrop(x, -y);
  const PER = 13; // cross-section vertices of the corridor: 0 = centre, 1-6 right side outward, 7-12 left side outward
  const ORDER = [6, 5, 4, 3, 2, 1, 0, 7, 8, 9, 10, 11, 12]; // right apron edge -> left apron edge
  /** quads between two consecutive sections (counter-clockwise seen from above) */
  const quads = (out: number[], s0: number, s1: number) => { for (let m = 0; m < ORDER.length - 1; m++) { const a0 = s0 + ORDER[m], b0 = s0 + ORDER[m + 1], a1 = s1 + ORDER[m], b1 = s1 + ORDER[m + 1]; out.push(a0, a1, b0, b0, a1, b1); } };
  const bankPos: number[] = [], bankCol: number[] = [], bankAttr: number[] = [], bankIdx: number[] = [];
  const wPos: number[] = [], wAttr: number[] = [], wAttr2: number[] = [], wIdx: number[] = [];
  const segments: RiverBuild['segments'] = [];
  const soil = new THREE.Color().setRGB(0.43, 0.36, 0.27, THREE.SRGBColorSpace);
  let nSections = 0; const profiles: CorridorSection[][] = [];
  rivers.forEach((r, ri) => {
    const secs = sections(r); nSections += secs.length; const prof: CorridorSection[] = []; profiles.push(prof);
    const { bed_width_m: b, side_slope_h_per_v: sl, bank_height_m: H } = r.channel, top = r.topWidth;
    // curvature radius at each section (for clamping the inner apron at bends)
    const radius = secs.map((q, i) => { const a = secs[Math.max(0, i - 3)], c = secs[Math.min(secs.length - 1, i + 3)];
      const dth = Math.abs(Math.atan2(a.tx * c.ty - a.ty * c.tx, a.tx * c.tx + a.ty * c.ty)); const ds = Math.max(1, c.s - a.s); return dth > 1e-4 ? ds / dth : 1e9; });
    const base0 = bankPos.length / 3;
    let segStart = 0;
    for (let i = 0; i < secs.length; i++) {
      const q = secs[i], nx = -q.ty, ny = q.tx; // left normal (grid)
      const cell = q.ring === 'mid' ? 16 : 80, carve = r.carveRadius[q.ring];
      const apron = carve + 1.5 * cell - top / 2;
      const bankY = wy(q.bank, q.x, q.y), bedY = bankY - H;
      const turn = Math.sign(radius[i] < 1e8 ? (secs[Math.max(0, i - 3)].tx * secs[Math.min(secs.length - 1, i + 3)].ty - secs[Math.max(0, i - 3)].ty * secs[Math.min(secs.length - 1, i + 3)].tx) : 0); // +1 = turning left
      const offs: number[] = [0];
      for (const side of [-1, 1]) for (const u of [b / 2, b / 2 + sl * H / 2, top / 2, top / 2 + apron / 3, top / 2 + 2 * apron / 3, top / 2 + apron]) offs.push(side * u);
      const edgeX = (side: number, u: number) => { const lim = side === turn ? Math.max(top / 2 + 4, radius[i] * 0.8) : 1e9; return Math.min(u, lim); };
      const cs: CorridorSection = { ri, x: q.x, y: q.y, nx, ny, tx: q.tx, ty: q.ty, s: q.s, off: new Float32Array(PER), hy: new Float32Array(PER), hrel: new Float32Array(PER), t: new Float32Array(PER) }; prof.push(cs);
      for (let k = 0; k < PER; k++) {
        const u0 = offs[k], side = Math.sign(u0) || 1, u = side * edgeX(side, Math.abs(u0));
        const x = q.x + nx * u, y = q.y + ny * u, au = Math.abs(u);
        let hy: number, hrel: number, t: number;
        if (au <= b / 2 + 1e-6) { hy = bedY; hrel = 0; t = 0; }
        else if (au <= top / 2 + 1e-6) { hrel = Math.min(H, (au - b / 2) / sl); hy = bedY + hrel; t = 0; }
        else {
          t = Math.min(1, (au - top / 2) / apron);
          const edge = terrain.heightAt(q.x + nx * side * (top / 2 + apron), -(q.y + ny * side * (top / 2 + apron)));
          const s = t * t * (3 - 2 * t);
          hy = Math.max(bankY + (edge - bankY) * s, t > 0.99 ? edge : terrain.heightAt(x, -y) + 0.05);
          hrel = hy - bedY;
        }
        bankPos.push(x, hy, -y);
        bankCol.push(soil.r, soil.g, soil.b);
        bankAttr.push(hrel, t, ri, 0);
        cs.off[k] = u; cs.hy[k] = hy; cs.hrel[k] = hrel; cs.t[k] = t;
      }
      if (i > 0) quads(bankIdx, base0 + (i - 1) * PER, base0 + i * PER);
      // water: three vertices across (edges and centre), placed in the vertex shader from width and depth uniforms
      for (const side of [-1, 0, 1]) { wPos.push(q.x, bedY, -q.y); wAttr.push(nx, -ny, side, ri); wAttr2.push(q.s, q.tx, -q.ty, 0); }
      if (i > 0) { const w0 = (wPos.length / 3) - 6, w1 = w0 + 3; for (let k = 0; k < 2; k++) wIdx.push(w0 + k, w1 + k, w0 + k + 1, w0 + k + 1, w1 + k, w1 + k + 1); }
      // collider segments of ~500 m (built lazily near the player)
      if (i - segStart >= (q.ring === 'mid' ? 50 : 17) || i === secs.length - 1) {
        const v0 = base0 + segStart * PER, v1 = base0 + i * PER + PER;
        const pos = new Float32Array(bankPos.slice(v0 * 3, v1 * 3)); const idx: number[] = [];
        for (let j = 1; j <= i - segStart; j++) quads(idx, (j - 1) * PER, j * PER);
        const mid = secs[Math.floor((segStart + i) / 2)];
        segments.push({ cx: mid.x, cy: mid.y, pos, idx: new Uint32Array(idx) });
        segStart = i;
      }
    }
  });
  // canal water joins the same mesh (river index 2): its surface sits 0.1 m above the ground between the spoil banks and its
  // half-width rides in flow.w (C: canals.ts)
  for (const c of canals) {
    const L = c.pts.length; let s = 0;
    for (let i = 0; i < L; i++) {
      const a = c.pts[Math.max(0, i - 1)], b = c.pts[Math.min(L - 1, i + 1)], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / tl, ty = (b[1] - a[1]) / tl;
      if (i > 0) s += Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]);
      const [x, y] = c.pts[i], wyv = terrain.heightAt(x, -y) + 0.1;
      for (const side of [-1, 0, 1]) { wPos.push(x, wyv, -y); wAttr.push(-ty, -tx, side, 2); wAttr2.push(s, tx, -ty, c.width / 2); }
      if (i > 0) { const w0 = (wPos.length / 3) - 6, w1 = w0 + 3; for (let k = 0; k < 2; k++) wIdx.push(w0 + k, w1 + k, w0 + k + 1, w0 + k + 1, w1 + k, w1 + k + 1); }
    }
  }
  const group = new THREE.Group(); group.name = 'plain-rivers';
  const pul = feature('river_pulvar');
  group.userData = tag(pul, 'Pulvar and Kur: modern courses (C for 467); channel trapezoid fitted to the monthly flow table, bed levels from the bare-earth floodplain (C); water level and width follow the date (flow_by_month, C)');
  // --- banks
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bankPos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(bankCol, 3));
  bg.setAttribute('river', new THREE.Float32BufferAttribute(bankAttr, 4)); bg.setIndex(bankIdx); bg.computeVertexNormals(); bg.computeBoundingSphere();
  const depthU = [uniform(1), uniform(1)], widthU = [uniform(10), uniform(20)], turbidU = [uniform(0), uniform(0)], flowU = [uniform(0.5), uniform(0.5)];
  const bedHalfU = rivers.slice(0, 2).map(r => uniform(r.channel.bed_width_m / 2)); while (bedHalfU.length < 2) bedHalfU.push(uniform(2));
  const pick = (u: any[], ri: any) => mix(u[0], u[1], ri);
  // bank vegetation and wetness by the date: the riparian sward's green share (seasonal.ts marginState, set in update)
  const swardGreen = uniform(1);
  const bankMat = surfaceMaterial('earth', { vertexColors: true, variant: 'riverbank', modify: (L: Layer) => {
    const a = attribute('river', 'vec4'), hrel = a.x, t = a.y, ri = a.z;
    const depth = pick(depthU, ri), above = hrel.sub(depth), flood = mix(float(1.2), float(1.8), ri); // today's water; the April (table peak) level
    // wet mud film at the waterline, a damp darker band above it
    const wet = float(1).sub(smoothstep(0.0, 0.14, above));
    const damp = float(1).sub(smoothstep(0.1, 0.5, above)).mul(float(1).sub(wet));
    // the band between today's water and the spring high water: bare silt and mud (none in April, widest in September).
    // It was 'everything below 2.4 m above the bed', which took in the whole apron: the bare-sand banks of session 4
    const band = step(0.14, above).mul(float(1).sub(smoothstep(flood.sub(0.05), flood.add(0.12), hrel)));
    const mud = color(new THREE.Color().setRGB(0.25, 0.21, 0.16, THREE.SRGBColorSpace)), siltC = color(new THREE.Color().setRGB(0.5, 0.46, 0.39, THREE.SRGBColorSpace));
    const siltTone = mx_noise_float(positionWorld.mul(0.7)).mul(0.1).add(1).mul(float(1).sub(smoothstep(0.2, 0.9, mx_noise_float(positionWorld.xz.mul(3.1)).abs()).mul(0.12))); // drying cracks
    let alb = mix(L.alb, siltC.mul(siltTone), band.mul(0.85));
    // above the flood line: a riparian sward on the upper bank, the bank top and the apron, thinning out toward the
    // terrain, greener and longer green than the steppe (the water table is near; C), in patches
    const grassG = color(new THREE.Color().setRGB(0.24, 0.33, 0.12, THREE.SRGBColorSpace)), grassS = color(new THREE.Color().setRGB(0.55, 0.49, 0.32, THREE.SRGBColorSpace));
    const patch = smoothstep(-0.35, 0.3, mx_noise_float(positionWorld.xz.mul(0.21)).add(mx_noise_float(positionWorld.xz.mul(1.3)).mul(0.35)));
    const sward = smoothstep(flood, flood.add(0.25), hrel).mul(float(1).sub(smoothstep(0.55, 1.0, t))).mul(patch.mul(0.35).add(0.6));
    alb = mix(alb, mix(grassS, grassG, swardGreen).mul(mx_noise_float(positionWorld.mul(2.3)).mul(0.14).add(1)), sward);
    alb = mix(alb, alb.mul(0.62), damp);
    alb = mix(alb, mud, wet);
    return { alb, rough: mix(mix(L.rough, float(0.55), damp), float(0.22), wet), height: L.height };
  } });
  bankMat.positionNode = positionLocal.add(vec3(0, liftNode(positionLocal), 0));
  const banks = new THREE.Mesh(bg, bankMat); banks.name = 'river-banks'; banks.receiveShadow = true; banks.frustumCulled = false; banks.userData = group.userData;
  group.add(banks);
  // --- water
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3)); wg.setAttribute('across', new THREE.Float32BufferAttribute(wAttr, 4)); wg.setAttribute('flow', new THREE.Float32BufferAttribute(wAttr2, 4));
  wg.setIndex(wIdx); wg.computeBoundingSphere(); wg.boundingSphere!.radius += 50;
  const wm = new THREE.MeshStandardNodeMaterial();
  const ac = attribute('across', 'vec4'), fl = attribute('flow', 'vec4'), riW = ac.w;
  const isCanal = step(1.5, riW), riR = riW.min(1); // 0 Pulvar, 1 Kur, 2 canal
  const width = mix(pick(widthU, riR), fl.w.mul(2), isCanal), depth = mix(pick(depthU, riR), float(0), isCanal);
  const lateral = ac.z.mul(width.mul(0.5).add(mix(float(0.35), float(0.05), isCanal)));
  const basePos = positionLocal.add(vec3(ac.x.mul(lateral), depth, ac.y.mul(lateral)));
  wm.positionNode = basePos.add(vec3(0, liftNode(basePos).add(0.0), 0));
  // ripples (waterShade.ts): band-limited noise advected downstream at a speed that follows the flow (0.3-1.2 m/s in the
  // rivers, 0.25 m/s in the canals, C), faded out by the pixel footprint so distant water never stripes
  const flowRel = pick(flowU, riR), speed = mix(flowRel.mul(0.9).add(0.3), float(0.25), isCanal);
  const sAlong = fl.x, across = ac.z.mul(width.mul(0.5));
  const T = vec3(fl.y, 0, fl.z), B = vec3(ac.x, 0, ac.y);
  const rip = rippleNormal(sAlong, across, T, B, speed, mix(flowRel.mul(0.6).add(0.55), float(0.35), isCanal));
  const nW = rip.n;
  wm.normalNode = normalize(cameraViewMatrix.mul(vec4(nW, 0)).xyz);
  // the local water depth across the trapezoid (bed half-width, then the side slopes to the edge; C): deep and dark in
  // mid-channel, the bed showing through in the shallows; canals 0.45 m at the middle (C)
  const halfW = width.mul(0.5), bedHalf = pick(bedHalfU, riR);
  const dRiver = depth.mul(clamp(halfW.sub(abs(across)).div(max(halfW.sub(bedHalf), 0.5)), 0, 1));
  const dLocal = mix(dRiver, float(1).sub(ac.z.mul(ac.z)).mul(0.45), isCanal);
  // body colour: turbid spring flood (silt brown) or clear low water (dark green over the bed)
  const turbid = mix(pick(turbidU, riR), turbidU[0], isCanal); // canals carry Pulvar/Kur water: the Pulvar's state stands for both (C)
  const nz = mx_noise_float(vec3(sAlong.sub(time.mul(speed)).mul(0.35), across.mul(0.6), time.mul(0.15)));
  const riffle = smoothstep(0.62, 0.85, nz.add(0.5)).mul(float(1).sub(smoothstep(0.3, 0.6, depth))).mul(float(1).sub(isCanal)); // broken water over riffles at low flow
  wm.colorNode = mix(waterBody(dLocal, turbid), vec3(0.5, 0.52, 0.5), riffle.mul(0.45));
  // sky reflection (no environment map): Fresnel x the calibrated horizon-to-sky radiance, and where the reflected ray
  // meets the far bank (its reeds and grass ~1.5 m over the bank top; riparian trees ~12 m tall over about half its
  // length, 15 m back; C) the bank instead of the sky (waterShade.ts)
  const Vw = normalize(cameraPosition.sub(positionWorld)), Rr = Vw.negate().reflect(nW), Rh = Rr.xz.div(max(length(Rr.xz), 1e-4));
  const rl = dot(Rh, vec2(ac.x, ac.y)), toEdge = mix(halfW.sub(across), halfW.add(across), step(rl, 0)).div(max(abs(rl), 0.05));
  const bankUp = mix(mix(float(1.6), float(2.2), riR).sub(depth).max(0.1).add(1.5), float(0.75), isCanal); // the far bank top over the water (channel bank 1.6 / 2.2 m), plus its low growth
  const dh = max(toEdge, 0.3), sinB = bankUp.div(length(vec2(dh, bankUp))), sinT = float(12).div(length(vec2(dh.add(15), 12)));
  // the trees along the far bank where the reflected ray meets it: in clumps over about half its length (canals less),
  // by a noise of the position along the bank (they are not the line trees themselves: C)
  const sHit = sAlong.add(dot(Rh, vec2(fl.y, fl.z)).mul(toEdge)), side = step(rl, 0);
  const trees = smoothstep(-0.2, 0.4, mx_noise_float(vec3(sHit.div(16), side.mul(5.3).add(riW.mul(11.7)), 0.5))).mul(mix(float(0.85), float(0.5), isCanal));
  wm.emissiveNode = skyReflection(nW, riffle, { sin: sinB, trees, treeSin: sinT, blur: rip.lost.mul(1.1) }); // blur: ~2x the RMS of the slope lost below the pixel (lost adds amplitudes linearly)
  wm.roughnessNode = waterRoughness(rip.lost, riffle); wm.metalnessNode = float(0);
  const water = new THREE.Mesh(wg, wm); water.name = 'river-water'; water.frustumCulled = false; water.receiveShadow = true;
  water.userData = tag(pul, 'river water: level and width from flow_by_month for the date (C); turbid Mar-May, clear in summer (C)');
  group.add(water);
  void sin; void vec2; void cos; void pow; void dot; void positionWorld; void cameraPosition; void color;
  return {
    group, banks, water, segments, profiles,
    update(st, sky) {
      depthU[0].value = st.pulvar.depth; depthU[1].value = st.kur.depth; widthU[0].value = st.pulvar.width; widthU[1].value = st.kur.width;
      turbidU[0].value = st.pulvar.turbid; turbidU[1].value = st.kur.turbid; flowU[0].value = st.pulvar.flowRel; flowU[1].value = st.kur.flowRel;
      WATER_SKY.sky.value.copy(sky.sky); WATER_SKY.horizon.value.copy(sky.horizon);
      if (st.margins) swardGreen.value = st.margins.grassGreen;
    },
    stats: () => ({ tris: bankIdx.length / 3 + wIdx.length / 3, sections: nSections }),
  };
}
