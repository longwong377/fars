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
import { Fn, If, texture, textureLoad, vec2, ivec2, float, add, floor, fract, clamp, step, mix, smoothstep, positionView, screenCoordinate, interleavedGradientNoise, vogelDiskSample, reference, renderGroup } from 'three/tsl';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import type { Quality } from '../core/settings';

export interface SunCascadeProfile { size: number; breaks: number[]; fade: boolean; taps: number }
/** far bounds of the cascades (m from the lens; the last is CSM's maxFar), map size per cascade, cross-fade, PCF taps */
export const SUN_CASCADES: Partial<Record<Quality, SunCascadeProfile>> = {
  high: { size: 4096, breaks: [8, 50, 160, 600], fade: false, taps: 12 },
  ultra: { size: 4096, breaks: [8, 50, 160, 600], fade: true, taps: 16 },
};
/** D-337: frames between re-renders of each cascade (1 = every frame); a cascade is re-rendered sooner when the camera has
 *  moved CASCADE_MOVE × its far bound, turned more than CASCADE_TURN_COS allows, or the sun has moved (?csmall: every frame) */
export const CASCADE_PERIOD = [1, 1, 2, 4];
export const CASCADE_MOVE = 0.01, CASCADE_TURN_COS = Math.cos(THREE.MathUtils.degToRad(1.5)), CASCADE_SUN_COS = Math.cos(THREE.MathUtils.degToRad(0.05));
export const CASCADE_AMORTISE = { on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('csmall')) };
if (typeof globalThis !== 'undefined') (globalThis as any).__parsaCascades = CASCADE_AMORTISE; // A/B at run time (tests/e2e/dbg_perf.spec.ts)
/** D-680: the far cascade on (?farcsm=0 for the A/B) */
export const FAR_ON = { on: !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('farcsm') === '0') };
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

// D-680 (s18, C4): the far cascade. Past the last cascade (600 m) nothing had a sun shadow, so the Terrace and the town seen
// from the plain read flat-lit (no wall shading its lane, no portico its hall, no house its neighbour). One more map, fitted
// once to the box holding the Terrace and the town (not to the view), drawn only when the sun has moved FAR_SUN_DEG or the
// sun comes up: a static map costs nothing per frame. Read with textureLoad and a hand-made 2×2 bilinear comparison, so it
// adds no sampler to any material (the T4's 16 per fragment stage, D-300: the page is at its limit; a comparison sampler
// per map is what the cascades cost). It shades fragments past FAR_START − FAR_FADE m from the lens, faded in to FAR_START.
/** the far cascade's box (world m: x = east, z = −north): the Terrace (TERRACE_BOX), the town's quarters, compounds and
 *  orchards round it (settlement plan: east −1450…300, north −1560…820), the ground −20…85 m and its buildings */
export const FAR_BOX = { x0: -1480, x1: 330, z0: -840, z1: 1580, y0: -25, y1: 110 } as const;
export const FAR_CASCADE = { size: 4096, start: 600, fade: 40, sunDeg: 0.4, margin: 400 } as const;
const FAR_SUN_COS = Math.cos(THREE.MathUtils.degToRad(FAR_CASCADE.sunDeg));
export interface FarFit { pos: THREE.Vector3; target: THREE.Vector3; left: number; right: number; top: number; bottom: number; near: number; far: number; texel: number }
const _fc = new THREE.OrthographicCamera(), _v = new THREE.Vector3();
/** CPU: the far cascade's light camera for a sun direction (unit, towards the sun): every corner of FAR_BOX inside its
 *  frustum, casters up to FAR_CASCADE.margin m sunward of the box inside its near plane */
export function farCascadeFit(sunDir: THREE.Vector3, box = FAR_BOX): FarFit {
  const B = box, c = new THREE.Vector3((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2);
  const R = Math.hypot(B.x1 - B.x0, B.y1 - B.y0, B.z1 - B.z0) / 2, d = R + FAR_CASCADE.margin;
  const pos = c.clone().addScaledVector(sunDir, d);
  _fc.position.copy(pos); _fc.up.set(0, 1, 0); _fc.lookAt(c); _fc.updateMatrixWorld(true);
  let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity, zn = Infinity, zf = -Infinity;
  for (const x of [B.x0, B.x1]) for (const y of [B.y0, B.y1]) for (const z of [B.z0, B.z1]) {
    _v.set(x, y, z).applyMatrix4(_fc.matrixWorldInverse);
    l = Math.min(l, _v.x); r = Math.max(r, _v.x); b = Math.min(b, _v.y); t = Math.max(t, _v.y); zn = Math.min(zn, -_v.z); zf = Math.max(zf, -_v.z);
  }
  // square texels: the map is square, so the shorter side takes the longer's extent
  const w = Math.max(r - l, t - b), cx = (l + r) / 2, cy = (b + t) / 2;
  return { pos, target: c, left: cx - w / 2, right: cx + w / 2, bottom: cy - w / 2, top: cy + w / 2, near: Math.max(1, zn - FAR_CASCADE.margin), far: zf + 10, texel: w / FAR_CASCADE.size };
}

/** the far map's filter: 4 texels read without a sampler, compared by hand, weighted bilinearly (a 2×2 PCF) */
function loadPCF(size: number, reversed: boolean) {
  return Fn(({ depthTexture, shadowCoord }: any) => {
    const p: any = shadowCoord.xy.mul(size).sub(0.5), i0: any = floor(p), f: any = fract(p), z = shadowCoord.z;
    const tap = (dx: number, dy: number) => {
      const d = (textureLoad(depthTexture, (ivec2 as any)(clamp(i0.add(vec2(dx, dy)), 0, size - 1))) as any).x;
      return reversed ? step(d, z) : step(z, d);
    };
    // read only where it is used (past the fade's start): the town round a player inside it pays nothing
    const r = float(1).toVar('farLit');
    If(positionView.z.negate().greaterThan(FAR_CASCADE.start - FAR_CASCADE.fade), () => {
      r.assign(mix(mix(tap(0, 0), tap(1, 0), f.x), mix(tap(0, 1), tap(1, 1), f.x), f.y));
    });
    return r;
  });
}
/** a ShadowNode whose depth map has no comparison and no filtering: textureLoad needs no sampler binding */
class FarShadowNode extends (THREE as any).ShadowNode {
  setupRenderTarget(shadow: any, builder: any) {
    const o = super.setupRenderTarget(shadow, builder); o.depthTexture.compareFunction = null; o.depthTexture.name = 'FarShadowDepth'; return o;
  }
  setupShadow(builder: any) {
    const n = super.setupShadow(builder), dt = this.shadowMap.depthTexture;
    dt.minFilter = dt.magFilter = THREE.NearestFilter; dt.generateMipmaps = false;
    return n;
  }
}

/** CSMShadowNode with fixed breaks, per-cascade biases from each cascade's texel, and the wider PCF */
class SunCSM extends (CSMShadowNode as any) {
  constructor(light: THREE.DirectionalLight, private prof: SunCascadeProfile) {
    super(light, { cascades: prof.breaks.length || 4, maxFar: 600, mode: prof.breaks.length ? 'custom' : 'practical', lightMargin: 200 });
    if (prof.breaks.length) (this as any).customSplitsCallback = (_n: number, _near: number, far: number, target: number[]) => { for (const b of prof.breaks) target.push(Math.min(b, far) / far); };
    (this as any).fade = prof.fade;
  }
  /** D-680: the far cascade (its light, its shadow, its node), made in _init */
  far: { light: THREE.Object3D & { target: THREE.Object3D }; shadow: any; node: any; sun: THREE.Vector3; drawn: boolean } | null = null;
  setup(builder: any) {
    const base = super.setup(builder);
    if (!this.far) return base;
    const near = FAR_CASCADE.start - FAR_CASCADE.fade, viewD = positionView.z.negate();
    // past FAR_START − FAR_FADE the cascades are fading out (their last ends at 600 m: lit beyond); the far map takes over
    return Fn(() => {
      const r = (base as any).toVar('sunShadowWithFar');
      (r as any).assign(r.mul(mix(float(1), this.far!.node, smoothstep(near, FAR_CASCADE.start, viewD))));
      return r;
    })();
  }
  _init(builder: any) {
    super._init(builder);
    if (!this.prof.breaks.length) return;
    const filt = vogelPCF(this.prof.taps);
    for (const L of (this as any).lights) L.shadow.filterNode = filt;
    this.biasFromTexels();
    if (FAR_ON.on) {
      const light = Object.assign(new THREE.Object3D(), { target: new THREE.Object3D() });
      const shadow = ((this as any).light as THREE.DirectionalLight).shadow.clone(); shadow.mapSize.set(FAR_CASCADE.size, FAR_CASCADE.size); shadow.autoUpdate = false;
      (shadow as any).filterNode = loadPCF(FAR_CASCADE.size, !!builder.renderer?.reversedDepthBuffer);
      const node = new (FarShadowNode as any)(light, shadow);
      this.far = { light, shadow, node, sun: new THREE.Vector3(0, -1, 0), drawn: false };
    }
  }
  /** D-680: refit and redraw the far map when the sun has moved FAR_CASCADE.sunDeg (or never drawn); never while the sun is
   *  down after the first draw (as the cascades, D-473) */
  private updateFar(sun: THREE.Vector3, up: boolean) {
    const F = this.far; if (!F) return;
    if (F.drawn && (!up || F.sun.dot(sun) >= FAR_SUN_COS)) { F.shadow.needsUpdate = false; return; }
    const fit = farCascadeFit(sun), cam = F.shadow.camera;
    F.light.position.copy(fit.pos); F.light.target.position.copy(fit.target); F.light.updateMatrixWorld(true); F.light.target.updateMatrixWorld(true);
    cam.left = fit.left; cam.right = fit.right; cam.top = fit.top; cam.bottom = fit.bottom; cam.near = fit.near; cam.far = fit.far; cam.updateProjectionMatrix();
    const range = Math.max(1, fit.far - fit.near);
    F.shadow.bias = -Math.max(0.3, 1.0 * fit.texel) / range; F.shadow.normalBias = 1.0 * fit.texel; F.shadow.needsUpdate = true;
    F.sun.copy(sun); F.drawn = true;
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
    { const L = (this as any).light as THREE.DirectionalLight; this.updateFar(_sd.subVectors(L.position, L.target.position).normalize(), L.intensity > 0); }
    if (!((this as any).light as THREE.DirectionalLight).intensity && this.drawn) { for (const lw of (this as any).lights) { lw.shadow.autoUpdate = false; lw.shadow.needsUpdate = false; } return; }
    this.drawn = true;
    if (!CASCADE_AMORTISE.on) { for (const lw of (this as any).lights) lw.shadow.autoUpdate = true; return; }
    const f = frame?.frameId ?? 0, pos = cam.getWorldPosition(_cp), dir = cam.getWorldDirection(_cd), L = (this as any).light as THREE.DirectionalLight;
    const sun = _sd.subVectors(L.position, L.target.position).normalize();
    ((this as any).lights as any[]).forEach((lw, i) => {
      const p = P[i] ?? 1, S = lw.shadow; if (p <= 1) { S.autoUpdate = true; return; }
      S.autoUpdate = false; const l = this.last[i], far = this.prof.breaks[i] ?? 600;
      const due = !l || f - l.frame >= p || (f % p) === (i % p) && f !== l.frame
        || l.pos.distanceTo(pos) > CASCADE_MOVE * far || l.dir.dot(dir) < CASCADE_TURN_COS || l.sun.dot(sun) < CASCADE_SUN_COS;
      if (due) { S.needsUpdate = true; if (l) { l.pos.copy(pos); l.dir.copy(dir); l.sun.copy(sun); l.frame = f; } else this.last[i] = { pos: pos.clone(), dir: dir.clone(), sun: sun.clone(), frame: f }; }
    });
  }
  /** biases from each cascade's own extent: depth bias in the shadow camera's normalised depth (its near–far range) */
  private biasFromTexels() {
    for (const L of (this as any).lights ?? []) {
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
