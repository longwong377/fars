// The walk's feel (s17 C9, D-630): the body has weight, the head moves with the steps and settles, the stair's low risers
// set the rhythm, crouching passes a low lintel, the bots' pace stays theirs. Built on a flat collider world (no terrain).
import { describe, it, expect, beforeAll } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from '../src/player/physics';
import { Player, WALK_SPEED, RUN_SPEED, EYE_HEIGHT, type Footfall } from '../src/player/player';
import { Head, PACE, BOB_AMP, CROUCH_EYE, approach } from '../src/player/motion';

let R: typeof RAPIER;
beforeAll(async () => { await RAPIER.init(); R = RAPIER; });
const DT = 1 / 60;
function flatWorld() {
  const P = new Physics(); (P as any).world = new R.World({ x: 0, y: -9.81, z: 0 });
  P.addBox({ x: 0, y: -0.5, z: 0 }, { x: 200, y: 0.5, z: 200 }); P.step(DT); return P;
}
const go = (pl: Player, P: Physics, n: number, inp: Partial<Parameters<Player['update']>[1]> = {}) => {
  for (let i = 0; i < n; i++) { pl.update(DT, { forward: 0, right: 0, run: false, yaw: 0, pitch: 0, ...inp }); P.step(DT); } };

describe('the body has weight (inertia)', () => {
  it('approach: walking pace in under half a second, a stop in about a quarter', () => {
    const v = { x: 0, z: 0 }; let t = 0; while (Math.hypot(v.x, v.z) < WALK_SPEED - 1e-6) { approach(v, { x: 0, z: -WALK_SPEED }, DT); t += DT; }
    expect(t).toBeGreaterThan(0.3); expect(t).toBeLessThan(0.5);
    t = 0; while (Math.hypot(v.x, v.z) > 1e-6) { approach(v, { x: 0, z: 0 }, DT); t += DT; }
    expect(t).toBeGreaterThan(0.15); expect(t).toBeLessThan(0.3);
  });
  it('the player starts, cruises at walking pace, and stops within half a step', () => {
    const P = flatWorld(), pl = new Player(P, 0, 0, 0); go(pl, P, 20);
    go(pl, P, 6, { forward: 1 }); expect(pl.speed).toBeLessThan(0.7); // 0.1 s in: still getting going
    go(pl, P, 60, { forward: 1 }); expect(pl.speed).toBeCloseTo(WALK_SPEED, 1);
    const z0 = pl.position.z; let n = 0; go(pl, P, 1); while (pl.speed > 0.01 && n < 120) { go(pl, P, 1); n++; }
    expect(n * DT).toBeLessThan(0.35); expect(Math.abs(pl.position.z - z0)).toBeLessThan(0.3);
  });
  it('paces: careful, walking, brisk (no sprint)', () => {
    for (const [inp, want] of [[{ slow: true }, PACE.careful], [{}, PACE.walk], [{ run: true }, PACE.brisk]] as const) {
      const P = flatWorld(), pl = new Player(P, 0, 0, 0); go(pl, P, 10); go(pl, P, 90, { forward: 1, ...inp });
      expect(pl.speed).toBeCloseTo(want, 1);
    }
    expect(RUN_SPEED).toBeLessThan(2.1);
  });
  it('the walk bots keep their own pace and steer at once', () => {
    const P = flatWorld(), pl = new Player(P, 0, 0, 0); go(pl, P, 10); pl.botSpeed = 3.2;
    go(pl, P, 1, { forward: 1, run: true }); expect(pl.speed).toBeCloseTo(3.2, 1);
  });
  it('a wall takes the velocity into it: no burst at the corner', () => {
    const P = flatWorld(); P.addBox({ x: 0, y: 1.5, z: -3 }, { x: 1.5, y: 1.5, z: 0.2 }); P.step(DT);
    const pl = new Player(P, 1.2, 0, 0); go(pl, P, 10);
    go(pl, P, 180, { forward: 1 }); // pressed against the wall, 3 s
    const yaw = -Math.PI / 2; go(pl, P, 2, { forward: 1, yaw }); // turn right along it: the first frames start from rest
    expect(pl.speed).toBeLessThan(0.3);
  });
  it('footfalls: one a step, about 1.8 a second at walking pace', () => {
    const P = flatWorld(), pl = new Player(P, 0, 0, 0), f: Footfall[] = []; pl.onStep = s => f.push(s); go(pl, P, 10);
    go(pl, P, 60, { forward: 1 }); f.length = 0; go(pl, P, 600, { forward: 1 });
    expect(f.length / 10).toBeGreaterThan(1.6); expect(f.length / 10).toBeLessThan(2.0);
    expect(f.every((s, i) => i === 0 || s.foot !== f[i - 1].foot)).toBe(true);
  });
});

describe('the head', () => {
  it('bobs within ±2 cm walking, lowest at the footfall, and settles when the body stops (T-K3, D-238)', () => {
    const P = flatWorld(), pl = new Player(P, 0, 0, 0), H = new Head(); go(pl, P, 10);
    let lo = 0, hi = 0, atStep: number[] = []; pl.onStep = () => atStep.push(H.out.y);
    for (let i = 0; i < 600; i++) { go(pl, P, 1, { forward: 1 }); const h = H.update(DT, { phase: pl.bobPhase, speed: pl.speed, grounded: pl.grounded, landed: pl.landed, bob: true }, 0); if (i > 60) { lo = Math.min(lo, h.y); hi = Math.max(hi, h.y); } }
    expect(hi - lo).toBeGreaterThan(0.03); expect(Math.max(-lo, hi)).toBeLessThanOrEqual(0.02);
    expect(atStep.slice(5).reduce((a, b) => a + b, 0) / (atStep.length - 5)).toBeLessThan(-0.012); // the head is low as the foot lands
    for (let i = 0; i < 60; i++) { go(pl, P, 1); H.update(DT, { phase: pl.bobPhase, speed: pl.speed, grounded: pl.grounded, landed: 0, bob: true }, 0); }
    expect(Math.abs(H.out.y)).toBeLessThan(0.004); expect(Math.hypot(H.out.x, H.out.z)).toBeLessThan(0.002); // a breath, no frozen bob
  });
  it('dips on landing and recovers; with head-bob off the eye stays level', () => {
    const H = new Head(); let lo = 0;
    for (let i = 0; i < 60; i++) { const h = H.update(DT, { phase: 0, speed: 0, grounded: true, landed: i === 0 ? 1.2 : 0, bob: true }, 0); lo = Math.min(lo, h.y); }
    expect(lo).toBeLessThan(-0.04); expect(Math.abs(H.out.y)).toBeLessThan(0.006);
    const Q = new Head(); for (let i = 0; i < 60; i++) Q.update(DT, { phase: i * 0.1, speed: 1.35, grounded: true, landed: i === 0 ? 1.2 : 0, bob: false }, 0);
    expect(Q.out.y).toBe(0); expect(Q.out.x).toBe(0);
  });
});

describe('people in the way', () => {
  for (const off of [0, 0.12, -0.12]) it(`a person standing in a 2 m doorway (${off} m off its middle) is eased past, on the freer side`, () => {
    const P = flatWorld();
    P.addBox({ x: -1.5, y: 1.5, z: -4 }, { x: 0.5, y: 1.5, z: 0.4 }); P.addBox({ x: 1.5, y: 1.5, z: -4 }, { x: 0.5, y: 1.5, z: 0.4 }); // jambs: a 2 m opening
    const who = P.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(off, 0, -4)); P.world.createCollider(R.ColliderDesc.capsule(0.55, 0.25).setTranslation(0, 0.8, 0), who);
    P.step(DT); const pl = new Player(P, 0, 0, 0); go(pl, P, 10);
    let side = 0; for (let i = 0; i < 60 * 8 && pl.position.z > -6; i++) { go(pl, P, 1, { forward: 1 }); if (Math.abs(pl.position.z + 4) < 0.2) side = pl.position.x - off; }
    expect(pl.position.z).toBeLessThan(-6);
    if (off) expect(Math.sign(side)).toBe(-Math.sign(off));
  });
});

describe('stairs and crouching', () => {
  it('the Grand Stair\'s low risers (0.108 / 0.31): climbed smoothly, a step a tread or so, slower than on the level', () => {
    const P = flatWorld(); for (let k = 0; k < 30; k++) P.addBox({ x: 0, y: (k + 1) * 0.108 / 2, z: -2 - k * 0.31 - 50 }, { x: 2, y: (k + 1) * 0.108 / 2, z: 50 });
    P.step(DT);
    const pl = new Player(P, 0, 0, 0), f: Footfall[] = []; pl.onStep = s => f.push(s); go(pl, P, 10);
    const ys: number[] = []; const z0 = pl.position.z; let t = 0;
    while (pl.feetY < 30 * 0.108 - 0.02 && t < 30) { go(pl, P, 1, { forward: 1 }); ys.push(pl.eye.y); t += DT; }
    expect(pl.feetY).toBeGreaterThan(3.2); // up the 30 risers
    const run = Math.abs(pl.position.z - z0) - 2, onStair = f.filter(s => s.stair).length;
    expect(onStair).toBeGreaterThan(30 * 0.31 / 0.75 * 1.3); // more footfalls than level strides would give: shorter steps
    expect(run / t).toBeLessThan(WALK_SPEED); // the climb is slower
    let jerk = 0; for (let i = 2; i < ys.length; i++) jerk = Math.max(jerk, Math.abs(ys[i] - 2 * ys[i - 1] + ys[i - 2]));
    expect(jerk).toBeLessThan(0.02); // no pops of the eye (m per frame², at 60 Hz)
  });
  it('crouching passes under a 1.4 m lintel; standing does not, and the body stays down under it', () => {
    const lintel = (P: Physics) => { P.addBox({ x: 0, y: 1.4 + 0.25, z: -3 }, { x: 2, y: 0.25, z: 0.5 }); P.step(DT); };
    const P1 = flatWorld(); lintel(P1); const a = new Player(P1, 0, 0, 0); go(a, P1, 10); go(a, P1, 300, { forward: 1 });
    expect(a.position.z).toBeGreaterThan(-3); // stopped by the lintel
    const P2 = flatWorld(); lintel(P2); const b = new Player(P2, 0, 0, 0); go(b, P2, 10);
    go(b, P2, 30, { crouch: true }); expect(b.crouched).toBe(true); expect(b.eye.y - b.feetY).toBeCloseTo(CROUCH_EYE, 1);
    while (b.position.z > -3) go(b, P2, 1, { forward: 1, crouch: true });
    go(b, P2, 5, { crouch: false }); expect(b.crouched).toBe(true); // no room to stand
    go(b, P2, 200, { forward: 1, crouch: true }); go(b, P2, 30, { crouch: false });
    expect(b.position.z).toBeLessThan(-4); expect(b.crouched).toBe(false); expect(b.eye.y - b.feetY).toBeCloseTo(EYE_HEIGHT, 1);
  });
});
void BOB_AMP;
