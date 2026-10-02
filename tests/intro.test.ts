// s17 C5 (D-590): the opening's camera paths (src/shell/intro.ts) against the committed terrain and the Terrace: every
// shot keeps the lens above the ground and out of the platform and its buildings, its length is in the brief's range
// (60-90 s), each cut moves the world's time forward, and the last shot lands exactly on the player's eye.
import { describe, it, expect } from 'vitest';
import { loadTerrain } from './plainLib';
import { SHOTS, INTRO_SECONDS, shotPose, shotToPlayer, type IntroShot } from '../src/shell/intro';
import { FOOTPRINTS } from '../src/arch/spec';

const T = loadTerrain();
const hAt = (e: number, n: number) => T.heightAt(e, -n);
const inPoly = (p: [number, number][], e: number, n: number) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > n) !== (yj > n) && e < ((xj - xi) * (n - yi)) / (yj - yi) + xi) c = !c; } return c; };
const distToPoly = (p: [number, number][], e: number, n: number) => { let d = Infinity; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [ax, ay] = p[j], [bx, by] = p[i], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((e - ax) * dx + (n - ay) * dy) / L)); d = Math.min(d, Math.hypot(e - ax - t * dx, n - ay - t * dy)); } return d; };
const TERRACE = FOOTPRINTS.terrace.polygon;
// the spawn (main.ts SPAWN) with the eye 1.6 m over the ground, facing grid east
const PLAYER = { e: -175, n: 122.45, eyeH: 1.6, az: 90, pitch: 0, fov: 60 };
const all: IntroShot[] = [...SHOTS, shotToPlayer(PLAYER)];

describe('the opening (D-590)', () => {
  it('lasts 60-90 s in 5-7 shots', () => {
    expect(INTRO_SECONDS).toBeGreaterThanOrEqual(60); expect(INTRO_SECONDS).toBeLessThanOrEqual(90);
    expect(all.length).toBeGreaterThanOrEqual(5); expect(all.length).toBeLessThanOrEqual(7);
  });
  it('moves the world forward in time, shot by shot', () => {
    for (let i = 1; i < all.length; i++) expect(all[i].atRise, all[i].id).toBeGreaterThan(all[i - 1].atRise);
  });
  it('keeps the lens above the terrain and clear of the Terrace (sampled every 0.05 s)', () => {
    for (const s of all) for (let t = 0; t <= s.dur; t += 0.05) {
      const P = shotPose(s, t / s.dur, hAt, 0); // no clamp: the path itself must clear
      const g = hAt(P.e, P.n), lift = P.y - g;
      expect(lift, `${s.id} at ${t.toFixed(2)} s: ${lift.toFixed(2)} m over the ground at (${P.e.toFixed(0)}, ${P.n.toFixed(0)})`).toBeGreaterThan(s.id === 'walk' && t > s.dur - 2.5 ? 1.2 : 1.8);
      // the platform stands ~12 m over the plain and its buildings up to ~24 m over the platform: keep 8 m off it, or fly over everything
      if (inPoly(TERRACE, P.e, P.n) || distToPoly(TERRACE, P.e, P.n) < 8) expect(P.y, `${s.id} at ${t.toFixed(2)} s over the Terrace`).toBeGreaterThan(30);
      expect(Math.abs(P.pitch)).toBeLessThan(40); expect(P.fov).toBeGreaterThan(20); expect(P.fov).toBeLessThan(80);
    }
  });
  it('lands exactly on the eye where the walk begins, facing the way the player faces', () => {
    const s = all[all.length - 1], P = shotPose(s, 1, hAt);
    expect(P.e).toBeCloseTo(PLAYER.e, 6); expect(P.n).toBeCloseTo(PLAYER.n, 6);
    expect(P.y).toBeCloseTo(hAt(PLAYER.e, PLAYER.n) + PLAYER.eyeH, 6);
    expect(P.az).toBeCloseTo(PLAYER.az, 6); expect(P.pitch).toBeCloseTo(PLAYER.pitch, 6); expect(P.fov).toBeCloseTo(PLAYER.fov, 6);
    // and it comes in smoothly: the last 0.1 s moves under 0.1 m
    const Q = shotPose(s, 1 - 0.1 / s.dur, hAt); expect(Math.hypot(P.e - Q.e, P.n - Q.n, P.y - Q.y)).toBeLessThan(0.1);
  });
  it('moves no faster than a camera crane or a drone would (under 40 m/s) and turns gently', () => {
    for (const s of all) { let prev = shotPose(s, 0, hAt);
      for (let t = 0.05; t <= s.dur; t += 0.05) { const P = shotPose(s, t / s.dur, hAt);
        expect(Math.hypot(P.e - prev.e, P.n - prev.n, P.y - prev.y) / 0.05, `${s.id} speed at ${t.toFixed(2)}`).toBeLessThan(40);
        expect(Math.abs(P.az - prev.az) / 0.05, `${s.id} turn at ${t.toFixed(2)}`).toBeLessThan(15); prev = P; } }
  });
});
