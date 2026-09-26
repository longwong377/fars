// Persistence (audit D M9; gates T-H3, T-H3r; H workstream): the visit is saved without being asked (every AUTOSAVE_MS
// and when the page is hidden or closed) and loaded at start; save → load → save of the world state (the detailed people,
// their memory of the player, relations and chronicle, the visitor, the doors) is byte-identical, and the world goes on
// identically after a load. The browser round trip (clock, weather, player, population, visitor) is
// tests/e2e/persistence.spec.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Autosaver, AUTOSAVE_MS, parseSave, writeSave, setSaveProblemHandler, MAX_SAVE_BYTES, type SaveGame } from '../src/core/save';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { Visitor, type VisitorWorld } from '../src/world/visitor/controller';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import { DoorSystem } from '../src/arch/doors';
import { Physics } from '../src/player/physics';

class Target { l: Record<string, (() => void)[]> = {}; visibilityState: DocumentVisibilityState = 'visible';
  addEventListener(k: string, f: () => void) { (this.l[k] ??= []).push(f); } fire(k: string) { for (const f of this.l[k] ?? []) f(); } }

describe('autosave (T-H3: <= 5 real minutes, and on visibilitychange)', () => {
  it('saves every AUTOSAVE_MS while the visit is on, not on the title screen; at once when hidden, on pagehide and beforeunload', () => {
    expect(AUTOSAVE_MS).toBeLessThanOrEqual(5 * 60_000);
    let now = 0, on = false, written = 0; const A = new Autosaver(() => { written++; return true; }, () => on, () => now);
    const win = new Target(), doc = new Target(); A.attach(win as any, doc as any);
    now = AUTOSAVE_MS * 3; A.tick(); expect(written, 'title screen: nothing to save').toBe(0);
    on = true; A.tick(); expect(written).toBe(1); A.tick(); expect(written, 'not again within the interval').toBe(1);
    now += AUTOSAVE_MS - 1; A.tick(); expect(written).toBe(1); now += 1; A.tick(); expect(written).toBe(2);
    doc.visibilityState = 'hidden'; doc.fire('visibilitychange'); expect(written).toBe(3); expect(A.last?.reason).toBe('hidden');
    doc.visibilityState = 'visible'; doc.fire('visibilitychange'); expect(written, 'shown again: no save').toBe(3);
    win.fire('pagehide'); win.fire('beforeunload'); expect(written).toBe(5);
    A.enabled = false; win.fire('beforeunload'); now += AUTOSAVE_MS; A.tick(); expect(written, 'a new visit: the cleared save is not written back').toBe(5);
    const B = new Autosaver(() => false, () => true, () => now); B.save('x'); expect(B.failures).toBe(1);
  });
});

describe('save -> load -> save is byte-identical (T-H3r), and the world goes on the same', () => {
  it('people (agents, memory, relations, chronicle), visitor and doors', async () => {
    const loadNav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const nav = loadNav(), nav2 = loadNav(); // each world its own grid (a sim's route searches mark it)
    const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
    const vw: VisitorWorld = { guards: () => [], familiarity: () => 0, recognise: 0.25, react: () => true, escort: () => {} };
    const { parts } = buildTerrace(); const P = await Physics.create(); buildMeshes(parts, P, { dynamicDoors: true });
    const d1 = new DoorSystem(parts, P), d2 = new DoorSystem(parts, P); P.step(1 / 60);
    const s1 = new PeopleSim(1, nav, env); s1.jumpTo(24 * 40 + 9.5); for (let i = 0; i < 400; i++) s1.step(1);
    s1.noteAddressed(4); s1.noteAddressed(9); s1.pop.relate(s1.agents[2].pid, s1.agents[3].pid, 40, -0.3);
    const v1 = new Visitor(vw, null); v1.s.step = 3; v1.s.escorted = true;
    d1.toggle('harem:W', false); d1.toggle('tachara:S', true); for (let i = 0; i < 300; i++) d1.update(1 / 60, 10);
    const save = (s: PeopleSim, v: Visitor, d: DoorSystem) => JSON.stringify({ npc: { people: s.save(), visitor: v.save() }, doors: d.save() });
    const a = save(s1, v1, d1);
    expect(s1.events.length, 'a chronicle to keep').toBeGreaterThan(0);
    const s2 = new PeopleSim(1, nav2, env), v2 = new Visitor(vw, null), o = JSON.parse(a); s2.load(o.npc.people); v2.load(o.npc.visitor); d2.load(o.doors);
    const b = save(s2, v2, d2);
    expect(b.length).toBe(a.length); expect(b === a, 'byte-identical').toBe(true);
    expect(s2.familiarity(4)).toBeCloseTo(s1.familiarity(4), 9); expect(s2.events.length).toBe(s1.events.length);
    for (let i = 0; i < 600; i++) { s1.step(1); s2.step(1); }
    expect(JSON.stringify(s2.save()) === JSON.stringify(s1.save()), 'ten minutes on, the same world').toBe(true);
  }, 300_000);
});

describe('older saves and failed saves are never lost silently (T-H3v, T-H3s)', () => {
  it('a save of the previous build (people without walks, chronicle or route cache) loads and goes on; unreadable or unknown saves are announced', () => {
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
    const s1 = new PeopleSim(1, nav, env); s1.jumpTo(24 * 12 + 9); for (let i = 0; i < 120; i++) s1.step(1); s1.noteAddressed(4);
    // the previous build's save: the fields this session added are absent
    const cur: any = s1.save(), old: any = { ...cur, agents: cur.agents.map((a: any) => { const { path, pathI, walking, gait, legs, waitRoute, loadDay, kneadKey, emptyCarry, round, roundKey, ...rest } = a; return rest; }) };
    delete old.events; delete old.routes; delete old.near;
    const oldSave: SaveGame = { v: 1, savedAt: '2026-09-25T20:00:00Z', seed: 1, clockT: 12.4, timeScale: 1, weatherOverride: 'auto', player: { x: -175, y: 0, z: -122, yaw: 0, pitch: 0 }, npc: { people: old, visitor: { step: 0 } } };
    const notes: string[] = []; setSaveProblemHandler(m => notes.push(m));
    const parsed = parseSave(JSON.stringify(oldSave)); expect(parsed, 'the previous build\'s save reads').not.toBeNull(); expect(notes).toEqual([]);
    const s2 = new PeopleSim(1, nav, env); s2.load((parsed!.npc as any).people);
    expect(s2.familiarity(4)).toBeCloseTo(s1.familiarity(4), 9); for (let i = 0; i < 60; i++) s2.step(1); // and it goes on
    expect(parseSave('{not json')).toBeNull(); expect(notes.length).toBe(1);
    expect(parseSave(JSON.stringify({ ...oldSave, v: 7 }))).toBeNull(); expect(notes.length).toBe(2); expect(notes[1]).toMatch(/cannot read/);
  });
  it('a save no store accepts is announced (node: no localStorage, no IndexedDB); the size ceiling is 2 MB', () => {
    const notes: string[] = []; setSaveProblemHandler(m => notes.push(m));
    expect(writeSave({ v: 1, savedAt: '', seed: 1, clockT: 0, timeScale: 1, weatherOverride: 'auto', player: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 } })).toBe(false);
    expect(notes.length).toBe(1); expect(notes[0]).toMatch(/could not be saved/);
    expect(MAX_SAVE_BYTES).toBe(2 * 1024 * 1024);
  });
});
