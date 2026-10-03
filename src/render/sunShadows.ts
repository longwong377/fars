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
import { Fn, texture, vec2, float, add, screenCoordinate, interleavedGradientNoise, vogelDiskSample, reference, renderGroup } from 'three/tsl';
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
  }
  updateFrustums() { super.updateFrustums(); if (this.prof.breaks.length) this.biasFromTexels(); }
  private last: { pos: THREE.Vector3; dir: THREE.Vector3; sun: THREE.Vector3; frame: number }[] = [];
  /** D-337: the far cascades re-rendered every CASCADE_PERIOD[i] frames (staggered), unless the camera has moved or turned,
   *  or the sun has moved, enough since that cascade was drawn: its map and its matrix stay the pair drawn together, so a
   *  skipped frame shows the shadow of one to three frames before (the people 50-600 m off move ~2-7 cm meanwhile, under a
   *  9-35 cm texel), never a misplaced one */
  updateBefore(frame: any) {
    super.updateBefore(frame);
    const P = CASCADE_PERIOD, cam = (this as any).camera as THREE.Camera | null; if (!cam) return;
    // D-473: the sun below the horizon stays in the scene at intensity 0 (skySystem): its cascades are not redrawn; at sunrise
    // the sun's move (CASCADE_SUN_COS) or the period redraws them
    if (!((this as any).light as THREE.DirectionalLight).intensity) { for (const lw of (this as any).lights) { lw.shadow.autoUpdate = false; lw.shadow.needsUpdate = false; } return; }
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
