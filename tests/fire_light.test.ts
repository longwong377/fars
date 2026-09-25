// Fire light (D-216; render pass 2, R4 "the brazier's light has no falloff", R5 "the Gate at dusk glows evenly orange").
// The point light is physical inverse-square (decay 2, three's cut-off window); the eye adapts to the light the fires
// actually cast. Measured from the light model itself, in node.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { FireSystem, fireLight, fireFloorIrradiance, pointAttenuation, FIRE_FLICKER_MEAN, roomMaskAt, ROOM_MARGIN, type FireKind, type RoomBox } from '../src/world/fire';
import { skyLux, NIGHT_LUX, REN_PER_LUX_SKY } from '../src/sky/illuminance';
import { skyGain, exposureTarget, KEY } from '../src/sky/exposure';

/** a moonless night (sun −37°): the skylight on a horizontal floor in renderer units, with the eye's sky gain (D-117) */
function moonlessSkyE() {
  const skyL = skyLux(-37) + NIGHT_LUX, G = skyGain(skyL * REN_PER_LUX_SKY * 0.8, skyL, skyL);
  return G * skyL * REN_PER_LUX_SKY * 0.796; // hemi.intensity × the colour's luminance (0.796, skySystem.ts)
}
const LIMESTONE = 0.42; // the landing's floor (materials.ts limestone, N7)

describe('fire light: physical inverse-square falloff (R4)', () => {
  it('every fire is a decay-2 point light; the window leaves a torch or brazier at 8 m untouched', () => {
    for (const k of ['torch', 'brazier', 'hearth', 'oven', 'lamp', 'kiln'] as FireKind[]) {
      const L = fireLight(k); expect(L.decay).toBe(2);
      if (L.cutoff >= 30) expect(pointAttenuation(8, L.cutoff) * 64).toBeGreaterThan(0.99); // torches, hearths, braziers
    }
    expect(pointAttenuation(2, 0)).toBeCloseTo(0.25, 12); expect(pointAttenuation(30, 30)).toBe(0);
  });
  it('the floor beside a brazier at 1 m is at least 30× its luminance at 8 m on a moonless night (sky and fire)', () => {
    const sky = moonlessSkyE(), L = (r: number) => (LIMESTONE * (fireFloorIrradiance('brazier', r) + sky)) / Math.PI;
    const ratio = L(1) / L(8);
    expect(ratio).toBeGreaterThan(30);
    expect(ratio).toBeGreaterThan(80); // the geometry alone: (8² + h²)^1.5 / (1 + h²)^1.5 with the flame 1.37 m up ≈ 109
    // and it keeps falling: 2, 4, 8, 16 m each darker than the last
    const rs = [1, 2, 4, 8, 16].map(L); for (let i = 1; i < rs.length; i++) expect(rs[i]).toBeLessThan(rs[i - 1] / 1.9);
  });
});

describe('fire light: the eye adapts to the light the fires cast (R4, R5)', () => {
  const setup = (sunAlt: number) => {
    const F = new FireSystem(12); F.add('brazier', new THREE.Vector3(3, 0, -4), { tier: 'C', src: 'T', note: '' });
    F.add('brazier', new THREE.Vector3(3, 0, -11), { tier: 'C', src: 'T', note: '' }); F.add('torch', new THREE.Vector3(-20, 2.4, -30), { tier: 'C', src: 'T', note: '' });
    F.build(); const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 1000); cam.position.set(0, 1.6, 0);
    F.update(0.016, cam, sunAlt, 0, 0, 0, 12.3); return { F, cam };
  };
  it('localIlluminance is the sum of the point lights as cast (candela, mean flicker, decay, window, position)', () => {
    const { F, cam } = setup(-37), lights = (F as any).lights as THREE.PointLight[];
    let sum = 0, n = 0;
    for (const l of lights) { if (!l.visible) continue; n++;
      const f = F.fires.find(q => Math.hypot(q.pos.x - l.position.x, q.pos.z - l.position.z) < 1e-6)!, L = fireLight(f.kind);
      expect(l.decay).toBe(2); expect(l.distance).toBe(L.cutoff);
      const flick = l.intensity / L.candela; expect(flick).toBeGreaterThanOrEqual(0.6 - 1e-9); expect(flick).toBeLessThanOrEqual(1 + 1e-9);
      sum += L.candela * FIRE_FLICKER_MEAN * pointAttenuation(l.position.distanceTo(cam.position), l.distance, l.decay); }
    expect(n).toBe(3);
    expect(F.localIlluminance(cam.position)).toBeCloseTo(sum, 9);
  });
  it('beside a brazier on a moonless night the camera exposes the fire-lit floor below clipping, not ~8× over', () => {
    const { F, cam } = setup(-37), sky = moonlessSkyE();
    const fireE = F.localIlluminance(cam.position);
    // the eye 5 m from one brazier and 11 m from the other: ~3.7 renderer lux (the old estimate, power·4/(d²+1): ~0.44)
    expect(fireE).toBeGreaterThan(3); expect(fireE).toBeLessThan(4.5);
    const X = exposureTarget(0, sky, 1, 0, fireE, 1);
    expect(X * fireE).toBeCloseTo(KEY, 1); // an 18 % grey facing the fires shows at the key, as the sky-lit world does
    // the floor 2 m from the brazier (where render pass 2 clipped): below 1.5× display white before the tone curve
    expect((X * LIMESTONE * fireFloorIrradiance('brazier', 2)) / Math.PI).toBeLessThan(1.5);
  });
});

describe('fire light stays on its side of a hall wall (rubric fix 4: the hidden floodlight)', () => {
  // the Apadana hall interior (manifest room: centre (1.9, −4.9), 60.5 m square, floor 3 m, 19.5 m high; walls 5.32 m thick)
  const apadana: RoomBox = { x0: 1.9 - 30.25, x1: 1.9 + 30.25, z0: 4.9 - 30.25, z1: 4.9 + 30.25, y0: 3, y1: 22.5 };
  const F = new FireSystem(4); F.setRooms([apadana]);
  const torch = { kind: 'torch', pos: new THREE.Vector3(1.9, 5.95, -(25.35 - 0.4)) } as any; // on the N wall, inside (world.ts)
  const brazier = { kind: 'brazier', pos: new THREE.Vector3(4.9, 4.02, -53.55) } as any; // on the N stair's landing
  it('a torch inside the hall lights the hall and its wall faces, not the portico beyond the 5.3 m wall', () => {
    const R = F.roomOf(torch); expect(R.mode).toBe(1);
    expect(roomMaskAt(R.room!, R.mode, 1.9, 3.1, -20)).toBe(1); // the hall floor
    expect(roomMaskAt(R.room!, R.mode, 1.9, 8, -25.35)).toBe(1); // the wall's inner face
    expect(roomMaskAt(R.room!, R.mode, 1.9, 8, -30.67)).toBe(0); // its outer face, into the portico
    expect(roomMaskAt(R.room!, R.mode, 10.6, 8, -38)).toBe(0); // a portico column
    expect(ROOM_MARGIN).toBeLessThan(5.32 / 2);
  });
  it('a brazier outside lights the portico, not the hall floor behind the wall', () => {
    const R = F.roomOf(brazier); expect(R.mode).toBe(-1);
    expect(roomMaskAt(R.room!, R.mode, 10.6, 8, -38)).toBe(1);
    expect(roomMaskAt(R.room!, R.mode, 1.9, 3.1, -20)).toBe(0);
  });
  it('a fire far from every hall is unconfined', () => {
    expect(F.roomOf({ kind: 'lamp', pos: new THREE.Vector3(500, 0, 500) } as any).mode).toBe(0);
  });
});
