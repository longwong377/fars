// The sun's cascaded shadows at high and ultra (D-309, session 12; B113). One place for the world, the labs and the tests.
//
// Before (D-093 … D-304): CSMShadowNode, 4 cascades to 600 m, 'practical' split (lambda 0.5) and 2048² maps. The first
// cascade then ran from the lens to ~75 m, so its texel was ~7.5 cm (the frustum slice's diagonal / 2048): every shadow
// the player sees at arm's and conversation length (a chin on a chest, a jar on a step, a column base on the paving) was
// drawn in 7.5 cm stairs, and three r186's PCF (5 taps, radius 1 texel; PCFSoftShadowMap is removed and falls back to it)
// did not hide them. The shadow map is the largest single "render, not photograph" tell outdoors.
//
// Now: fixed breaks chosen for the player's lens, 4096² maps on the T4 (the lead's direction: the old SwiftShader limits
// revisited). Texel ≈ slice diagonal / size: 8 m → 4.6 mm, 50 m → 2.9 cm, 160 m → 9 cm, 600 m → 35 cm (at 60° × 16:9).
// Cascade 1 still reaches past the hall air-light's 48 m march (airlight.ts reads cascades 0–1), and the people's
// shadow casters (humanGPU SHADOW_CASCADE_REACH 130 m) are drawn into cascades 0–2.
// The biases follow each cascade's own texel (CSM's default multiplies one bias by 1..4 and shares one 6 cm normal bias,
// which detached every small shadow from its caster in a 4.6 mm cascade), and the filter is a 12-tap Vogel PCF whose
// radius is the sun's own penumbra at a typical occluder distance (0.53°, ~1 cm per metre) but never under 1.25 texels.
// Ultra adds the cascade fade (no visible seam where one cascade hands over to the next).
import * as THREE from 'three/webgpu';
import { Fn, If, texture, vec2, vec4, float, add, mix, floor, fract, step, smoothstep, positionView, screenCoordinate, interleavedGradientNoise, vogelDiskSample, reference, renderGroup, uniform } from 'three/tsl';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import type { Quality } from '../core/settings';

export interface SunCascadeProfile { size: number; breaks: number[]; fade: boolean; taps: number; far?: number }
/** far bounds of the cascades (m from the lens; the last is CSM's maxFar), map size per cascade, cross-fade, PCF taps */
export const SUN_CASCADES: Partial<Record<Quality, SunCascadeProfile>> = {
  high: { size: 4096, breaks: [8, 50, 160, 600], fade: false, taps: 12, far: 2048 },
  ultra: { size: 4096, breaks: [8, 50, 160, 600], fade: true, taps: 16, far: 2048 },
};
/** D-337: frames between re-renders of each cascade (1 = every frame); a cascade is re-rendered sooner when the camera has
 *  moved CASCADE_MOVE × its far bound, turned more than CASCADE_TURN_COS allows, or the sun has moved (?csmall: every frame) */
export const CASCADE_PERIOD = [1, 1, 2, 4];
export const CASCADE_MOVE = 0.01, CASCADE_TURN_COS = Math.cos(THREE.MathUtils.degToRad(1.5)), CASCADE_SUN_COS = Math.cos(THREE.MathUtils.degToRad(0.05));
export const CASCADE_AMORTISE = { on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('csmall')) };
if (typeof globalThis !== 'undefined') (globalThis as any).__parsaCascades = CASCADE_AMORTISE; // A/B at run time (tests/e2e/dbg_perf.spec.ts)
const _cp = new THREE.Vector3(), _cd = new THREE.Vector3(), _sd = new THREE.Vector3();
/** the old profile (session 11), kept for the A/B measurement (?csm=old) */
export const SUN_CASCADES_OLD: SunCascadeProfile = { size: 2048, breaks: [], fade: false, taps: 5 };
/** the sun's angular diameter (rad): the penumbra widens by this much per metre between occluder and receiver */
export const SUN_DIAMETER = 0.0093;
/** the occluder distance (m) the filter's radius assumes (a chin over a chest ~0.2, a step 0.2, a wall head 2–6) */
export const PENUMBRA_REF_M = 1.0;
/** depth bias (m along the light) and normal bias (m) per texel of a cascade; floors in metres */
export const BIAS_TEXELS = 1.0, NORMAL_BIAS_TEXELS = 1.5, BIAS_MIN = 0.008, NORMAL_BIAS_MIN = 0.01, NORMAL_BIAS_MAX = 0.3;

/** CPU mirror: a cascade's texel (m) from its far bound, as CSMShadowNode sizes the map (the slice's far diagonal) */
export function cascadeTexel(far: number, size: number, fovDeg = 60, aspect = 16 / 9): number {
  const t = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  return (2 * far * t * Math.sqrt(1 + aspect * aspect)) / size;
}
/** the PCF radius (texels) for a cascade of texel `tex` (m): the sun's penumbra at PENUMBRA_REF_M, ≥ 1.25 texels, ≤ 4 */
export function pcfRadius(tex: number): number { return Math.min(4, Math.max(1.25, (SUN_DIAMETER * PENUMBRA_REF_M) / 2 / tex)); }

/** the Vogel-disk PCF with n taps (three's PCFShadowFilter has 5); each tap is a hardware 2×2 comparison */
function vogelPCF(n: number) {
  return Fn(({ depthTexture, shadowCoord, shadow, depthLayer }: any) => {
    const cmp = (uvn: any) => { let d: any = texture(depthTexture, uvn); if (depthTexture.isArrayTexture) d = d.depth(depthLayer); return d.compare(shadowCoord.z); };
    const mapSize = (reference('mapSize', 'vec2', shadow) as any).setGroup(renderGroup), radius = (reference('radius', 'float', shadow) as any).setGroup(renderGroup);
    const r = radius.mul(vec2(1).div(mapSize).x), phi = interleavedGradientNoise(screenCoordinate.xy).mul(6.28318530718);
    let s: any = float(0);
    for (let i = 0; i < n; i++) s = add(s, cmp(shadowCoord.xy.add((vogelDiskSample as any)(i, n, phi).mul(r))));
    return s.mul(1 / n);
  });
}

// ---- the far cascade (D-473 addendum, s17 V11) ---------------------------------------------------------------------------
// The four cascades end at 600 m: beyond it nothing had a sun shadow, so the Terrace seen from the plain past 600 m, the town
// from Kuh-e Rahmat and the palaces from the hills read flat-lit. A fifth, STATIC cascade fitted to a world box (the Terrace
// and the town, not the view) takes over from 540-600 m out; it is redrawn only when the sun has moved FAR_CASCADE.sunDeg,
// the player has moved FAR_CASCADE.moveM since its last draw, or FAR_CASCADE.periodS has passed (so what streamed in since
// is drawn), never with the view. Its depth texture has no compare function and nearest filtering, so the lit shaders read
// it with textureLoad: a texture binding (main.ts asks for up to 48 a stage) but NO sampler (16 a stage, and lit materials
// sit near it; one more sampler made objects vanish, s17). The filter is a 3x3 bilinear-tent PCF of 16 loads, done by hand.
// Small casters (bound radius < minR) are skipped in its pass: at its ~1.5 m texel they cast nothing visible.
/** the box (grid east/north, height above the court datum, m), the hand-over band (m from the lens) and the redraw rules */
export const FAR_CASCADE = {
  // the Terrace (TERRACE_BOX e -61..256, n -239..235), its foot and Kuh-e Rahmat's lower slope, and the town's quarters
  // (town_plots.json: lower town south e -1400..-298 n -1527..-784, Persepolis west e -1450..-201 n -520..785), with margin
  box: { e0: -1560, e1: 420, n0: -1640, n1: 900, y0: -45, y1: 70 },
  start: 540, full: 600, sunDeg: 0.25, moveM: 200, periodS: 30, minR: 1.2, reachUp: 600, bias: 1.5, normalBias: 1.0,
};
export const FAR_ON = { on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('farshadow') === '0') };
/** A/B at run time (window.__parsaFarShadow.mix.value = 0: the far cascade's blend off; its loads still run) */
export const FAR_MIX = uniform(1);
if (typeof globalThis !== 'undefined') (globalThis as any).__parsaFarShadow = { mix: FAR_MIX, cfg: FAR_CASCADE };
const FAR_SUN_COS = () => Math.cos(THREE.MathUtils.degToRad(FAR_CASCADE.sunDeg));
const _fv = new THREE.Vector3(), _fm = new THREE.Matrix4(), _fc = new THREE.Vector3();

/** the far cascade's filter: a 3x3 box of bilinear compares (16 textureLoads, separable weights (1-f)/3, 1/3, 1/3, f/3) */
const farPCF = Fn(({ depthTexture, shadowCoord, shadow }: any, builder: any) => {
  const reversed = !!builder.renderer.reversedDepthBuffer;
  const mapSize = (reference('mapSize', 'vec2', shadow) as any).setGroup(renderGroup);
  const p = shadowCoord.xy.mul(mapSize).sub(0.5), i0 = floor(p), f: any = fract(p), z = shadowCoord.z;
  const wx = [f.x.oneMinus().div(3), float(1 / 3), float(1 / 3), f.x.div(3)], wy = [f.y.oneMinus().div(3), float(1 / 3), float(1 / 3), f.y.div(3)];
  let s: any = float(0);
  for (let y = 0; y < 4; y++) {
    let row: any = float(0);
    for (let x = 0; x < 4; x++) {
      const d = (texture(depthTexture, i0.add(vec2(x - 0.5, y - 0.5)).div(mapSize)) as any).x;
      row = add(row, (reversed ? step(d, z) : step(z, d)).mul(wx[x]));
    }
    s = add(s, row.mul(wy[y]));
  }
  return s;
});

/** a ShadowNode whose depth map is read without a sampler, and whose pass skips small casters */
class FarShadowNode extends ((THREE as any).ShadowNode as any) {
  setupRenderTarget(shadow: any, builder: any) {
    const r = super.setupRenderTarget(shadow, builder);
    r.depthTexture.compareFunction = null; r.depthTexture.minFilter = r.depthTexture.magFilter = THREE.NearestFilter;
    r.depthTexture.name = 'FarShadowDepth';
    return r;
  }
  getShadowRenderObjectFunction(renderer: any, shadow: any) {
    const base = super.getShadowRenderObjectFunction(renderer, shadow), minR = FAR_CASCADE.minR;
    return (object: any, scene: any, cam: any, geometry: any, ...rest: any[]) => {
      if (!geometry.boundingSphere) geometry.computeBoundingSphere?.();
      const r = (geometry.boundingSphere?.radius ?? 1e9) * object.matrixWorld.getMaxScaleOnAxis();
      if (r < minR) return;
      base(object, scene, cam, geometry, ...rest);
    };
  }
}

/** fit the far cascade's orthographic camera to the world box seen from the sun (`sun`: unit vector toward the sun);
 *  returns the texel (m, the longer axis) */
export function fitFarCascade(lw: THREE.Object3D & { target: THREE.Object3D }, cam: THREE.OrthographicCamera, sun: THREE.Vector3, mapSize: number) {
  const B = FAR_CASCADE.box, D = 4000;
  _fc.set((B.e0 + B.e1) / 2, (B.y0 + B.y1) / 2, -(B.n0 + B.n1) / 2);
  lw.position.copy(_fc).addScaledVector(sun, D); lw.target.position.copy(_fc);
  lw.updateMatrixWorld(); lw.target.updateMatrixWorld();
  // the shadow camera as LightShadow.updateMatrices will place it
  cam.position.copy(lw.position); cam.lookAt(_fc); cam.updateMatrixWorld(); _fm.copy(cam.matrixWorld).invert();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const e of [B.e0, B.e1]) for (const n of [B.n0, B.n1]) for (const h of [B.y0, B.y1]) {
    _fv.set(e, h, -n).applyMatrix4(_fm);
    x0 = Math.min(x0, _fv.x); x1 = Math.max(x1, _fv.x); y0 = Math.min(y0, _fv.y); y1 = Math.max(y1, _fv.y); z0 = Math.min(z0, _fv.z); z1 = Math.max(z1, _fv.z);
  }
  // each axis keeps its own extent (the texels may be oblong; the filter works in texels)
  const m = 8; cam.left = x0 - m; cam.right = x1 + m; cam.bottom = y0 - m; cam.top = y1 + m;
  cam.near = Math.max(1, -z1 - FAR_CASCADE.reachUp); cam.far = -z0 + 20; cam.updateProjectionMatrix();
  return Math.max(cam.right - cam.left, cam.top - cam.bottom) / mapSize;
}

/** CSMShadowNode with fixed breaks, per-cascade biases from each cascade's texel, and the wider PCF */
class SunCSM extends (CSMShadowNode as any) {
  constructor(light: THREE.DirectionalLight, private prof: SunCascadeProfile) {
    super(light, { cascades: prof.breaks.length || 4, maxFar: 600, mode: prof.breaks.length ? 'custom' : 'practical', lightMargin: 200 });
    if (prof.breaks.length) (this as any).customSplitsCallback = (_n: number, _near: number, far: number, target: number[]) => { for (const b of prof.breaks) target.push(Math.min(b, far) / far); };
    (this as any).fade = prof.fade;
  }
  _init(builder: any) {
    super._init(builder);
    if (!this.prof.breaks.length) return;
    const filt = vogelPCF(this.prof.taps);
    for (const L of (this as any).lights) L.shadow.filterNode = filt;
    this.biasFromTexels();
    if (this.prof.far && FAR_ON.on) this.initFar(this.prof.far);
  }
  /** the far cascade: one more light-weight light (index = cascades, so humanGPU/trees' cascade-start tests read its start
   *  as 600 m and draw no people or trees into it) with its own sampler-free shadow node */
  farNode: any = null; private farLast: { sun: THREE.Vector3; pos: THREE.Vector3; t: number } | null = null; farTexel = 0;
  private initFar(size: number) {
    const lw: any = new THREE.Object3D(); lw.target = new THREE.Object3D(); lw.castShadow = true; lw.name = 'sun-far-cascade';
    const sh = ((this as any).light as THREE.DirectionalLight).shadow.clone() as any;
    sh.mapSize.set(size, size); sh.filterNode = farPCF; sh.autoUpdate = false; sh.needsUpdate = false; sh.radius = 1;
    lw.shadow = sh; (this as any).lights.push(lw);
    this.farNode = new (FarShadowNode as any)(lw, sh);
  }
  /** the near cascades' result, and past FAR_CASCADE.start the far cascade's, blended in by FAR_CASCADE.full */
  setup(builder: any) {
    const near = super.setup(builder);
    if (!this.farNode) return near;
    const far = this.farNode, d = positionView.z.negate();
    return Fn(() => {
      const r = vec4(near).toVar('sunShadowFar');
      If(d.greaterThan(FAR_CASCADE.start), () => { r.assign(mix(r, vec4(far), smoothstep(FAR_CASCADE.start, FAR_CASCADE.full, d).mul(FAR_MIX))); });
      return r;
    })();
  }
  /** redraw the far cascade when the sun has moved FAR_CASCADE.sunDeg, the player FAR_CASCADE.moveM, or every periodS */
  private updateFar(pos: THREE.Vector3, sun: THREE.Vector3) {
    const lw = (this as any).lights[(this as any).cascades]; if (!lw) return;
    const S = lw.shadow, l = this.farLast, t = performance.now() / 1000;
    S.autoUpdate = false;
    if (l && l.sun.dot(sun) >= FAR_SUN_COS() && l.pos.distanceTo(pos) <= FAR_CASCADE.moveM && t - l.t < FAR_CASCADE.periodS) return;
    this.farTexel = fitFarCascade(lw, S.camera, sun, S.mapSize.width);
    const cam = S.camera as THREE.OrthographicCamera, range = Math.max(1, cam.far - cam.near);
    S.bias = -(FAR_CASCADE.bias * this.farTexel) / range; S.normalBias = FAR_CASCADE.normalBias * this.farTexel;
    S.needsUpdate = true;
    if (l) { l.sun.copy(sun); l.pos.copy(pos); l.t = t; } else this.farLast = { sun: sun.clone(), pos: pos.clone(), t };
  }
  updateFrustums() { super.updateFrustums(); if (this.prof.breaks.length) this.biasFromTexels(); }
  private drawn = false;
  private last: { pos: THREE.Vector3; dir: THREE.Vector3; sun: THREE.Vector3; frame: number }[] = [];
  /** D-337: the far cascades re-rendered every CASCADE_PERIOD[i] frames (staggered), unless the camera has moved or turned,
   *  or the sun has moved, enough since that cascade was drawn: its map and its matrix stay the pair drawn together, so a
   *  skipped frame shows the shadow of one to three frames before (the people 50-600 m off move ~2-7 cm meanwhile, under a
   *  9-35 cm texel), never a misplaced one */
  updateBefore(frame: any) {
    super.updateBefore(frame);
    const P = CASCADE_PERIOD, cam = (this as any).camera as THREE.Camera | null; if (!cam) return;
    // D-473: the sun below the horizon stays in the scene at intensity 0 (skySystem): its cascades are not redrawn; at sunrise
    // the sun's move (CASCADE_SUN_COS) or the period redraws them. Drawn once even so (a page loaded at night compiles the shadow
    // pipelines behind the loading screen, not at the first sunrise: 199 pipelines, measured)
    if (!((this as any).light as THREE.DirectionalLight).intensity && this.drawn) { for (const lw of (this as any).lights) { lw.shadow.autoUpdate = false; lw.shadow.needsUpdate = false; } return; }
    this.drawn = true;
    const f = frame?.frameId ?? 0, pos = cam.getWorldPosition(_cp), dir = cam.getWorldDirection(_cd), L = (this as any).light as THREE.DirectionalLight;
    const sun = _sd.subVectors(L.position, L.target.position).normalize(), nC = (this as any).cascades as number;
    if (this.farNode) this.updateFar(pos, sun);
    if (!CASCADE_AMORTISE.on) { ((this as any).lights as any[]).forEach((lw, i) => { if (i < nC) lw.shadow.autoUpdate = true; }); return; }
    ((this as any).lights as any[]).forEach((lw, i) => { if (i >= nC) return;
      const p = P[i] ?? 1, S = lw.shadow; if (p <= 1) { S.autoUpdate = true; return; }
      S.autoUpdate = false; const l = this.last[i], far = this.prof.breaks[i] ?? 600;
      const due = !l || f - l.frame >= p || (f % p) === (i % p) && f !== l.frame
        || l.pos.distanceTo(pos) > CASCADE_MOVE * far || l.dir.dot(dir) < CASCADE_TURN_COS || l.sun.dot(sun) < CASCADE_SUN_COS;
      if (due) { S.needsUpdate = true; if (l) { l.pos.copy(pos); l.dir.copy(dir); l.sun.copy(sun); l.frame = f; } else this.last[i] = { pos: pos.clone(), dir: dir.clone(), sun: sun.clone(), frame: f }; }
    });
  }
  /** biases from each cascade's own extent: depth bias in the shadow camera's normalised depth (its near–far range) */
  private biasFromTexels() {
    for (const L of ((this as any).lights ?? []).slice(0, (this as any).cascades)) {
      const S = L.shadow, cam = S.camera as THREE.OrthographicCamera, tex = (cam.right - cam.left) / S.mapSize.width;
      if (!(tex > 0)) continue;
      const range = Math.max(1, cam.far - cam.near);
      S.bias = -Math.max(BIAS_MIN, BIAS_TEXELS * tex) / range;
      S.normalBias = Math.min(NORMAL_BIAS_MAX, Math.max(NORMAL_BIAS_MIN, NORMAL_BIAS_TEXELS * tex));
      S.radius = pcfRadius(tex);
    }
  }
}

/** install the sun's cascades at high/ultra (null at lower qualities: the single follow-the-player map stays).
 *  ?csm=old: the session-11 cascades (for A/B measurements) */
export function installSunCascades(sun: THREE.DirectionalLight, quality: Quality): any {
  const prof = SUN_CASCADES[quality];
  if (!prof) return null;
  const old = typeof location !== 'undefined' && new URLSearchParams(location.search).get('csm') === 'old';
  const p = old ? SUN_CASCADES_OLD : prof;
  const csm = new SunCSM(sun, p);
  (sun.shadow as any).shadowNode = csm; sun.shadow.mapSize.set(p.size, p.size);
  return csm;
}
