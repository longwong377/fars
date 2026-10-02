// Where the Terrace's fires stand (all C: fires and lamps are attested in general, the positions are reconstruction). Split
// out of world.ts so that the fire-light occlusion bake (tools/build_fire_occ.ts, D-222) places the same fires offline.
import * as THREE from 'three/webgpu';
import type { Doorway } from '../arch/parts';
import { v } from '../arch/spec';
import placesJson from '../data/people_places.json';
import { fireLight, type FireKind, type FireSchedule } from './fire';

/** what placeFires needs of a fire system */
export interface FireSink { add(kind: FireKind, base: THREE.Vector3, meta: { tier: string; src: string; note: string; sched?: FireSchedule; group?: string; body?: boolean; stands?: () => boolean }): void }
const gw = (e: number, n: number, y: number) => new THREE.Vector3(e, y, -n);
/** does a wall torch's place lie in a doorway of the building (D-217)? Within its width (+0.5 m) along the wall and its
 *  depth (+1 m) across it */
export const inDoorway = (doorways: Doorway[], b: string, e: number, n: number) => doorways.some(d => d.building === b && Math.abs((e - d.c[0]) * d.u[0] + (n - d.c[1]) * d.u[1]) < d.width / 2 + 0.5 && Math.abs((e - d.c[0]) * d.n[0] + (n - d.c[1]) * d.n[1]) < d.depth / 2 + 1);
/** the Apadana hall's wall torches (grid e, n, height; C): every 10 m along each wall from its middle, 2.6 m over the podium,
 *  none in a doorway. D-217: the one at each wall's middle stood in the middle of the doorway there, 5.7 m over the floor
 *  with nothing to hold it: the "floating rod" of rubric s7 pass 2 (R11) */
export function apadanaTorches(m: any, doorways: Doorway[]): [number, number, number][] {
  const a = m.apadana; if (!a) return []; const [cx, cy] = a.hallCentre, hs = a.hallInterior, pod = a.podium, out: [number, number, number][] = [];
  for (let i = -2; i <= 2; i++) for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) { const e = cx + dx * (hs / 2 - 0.4) + (dy ? i * 10 : 0), n = cy + dy * (hs / 2 - 0.4) + (dx ? i * 10 : 0);
    if (!inDoorway(doorways, 'apadana', e, n)) out.push([e, n, pod + 2.6]); }
  return out;
}
/** Fire placements for the vertical slice (all C: fires/lamps are attested in general, positions are reconstruction). */
export function placeFires(fire: FireSink, m: any, parts: any[], doorways: Doorway[] = []) {
  const C = { tier: 'C', src: 'RECON', note: 'fire placement reconstructed (C)' };
  // Gate of All Nations: torches on the inner faces either side of each doorway
  const gfl = parts.find((p: any) => p.building === 'gate_nations' && p.kind === 'floor');
  if (gfl && m.gate_nations) { const [cx, cy] = gfl.c, hs = m.gate_nations.hallInteriorX, dw = v('gate_nations', 'door_width');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]]) for (const s of [-1, 1]) fire.add('torch', gw(cx + dx * (hs / 2 - 0.3) + (dy ? s * (dw / 2 + 1) : 0), cy + dy * (hs / 2 - 0.3) + (dx ? s * (dw / 2 + 1) : 0), 2.4), C); }
  // Grand Stair top landing: two braziers at the head of the stair (incense stands appear on the reliefs; B type, C place)
  fire.add('brazier', gw(-33.4, 128, 0), { ...C, note: 'brazier at the stair head, flanking the way to the Gate (type after the incense stands on the audience relief, B; place C)' });
  fire.add('brazier', gw(-33.4, 121, 0), { ...C, note: 'brazier at the stair head (C)' });
  // Apadana: braziers flanking the N stair central landing; torches along the hall walls (inside)
  const a = m.apadana; if (a) { const [cx] = a.hallCentre, pod = a.podium;
    for (const s of [-1, 1]) fire.add('brazier', gw(cx + s * 3, a.nStairEdge + 1.5, pod), C);
    for (const [e, n, y] of apadanaTorches(m, doorways)) fire.add('torch', gw(e, n, y), C); }
  // D-276: the room ranges' hearths (a hearth ring in each garrison quarters room, its kitchen, the guards' mess, the Harem's
  // kitchens and N hall) and the saucer lamps on their ledges (terrace.ts buildRanges; rooms.ts roomFittings). The garrison's
  // are kept through the night by the watch; the Harem's are domestic hearths and lamps (C)
  for (const b of ['garrison', 'harem', 'treasury', 'terrace']) { const R = (m[b] as any)?.ranges as { hearths: number[][]; lamps: number[][] } | undefined; if (!R) continue;
    for (const [e, n, fl] of R.hearths) fire.add('hearth', gw(e, n, fl), { ...C, sched: b === 'garrison' ? 'night' : 'home', note: `${b}: the room's hearth (C, D-276)` });
    for (const [e, n, y] of R.lamps) fire.add('lamp', gw(e, n, y), { ...C, sched: 'home', body: false, note: `${b}: a saucer lamp on its ledge (C, D-276)` }); }
  // the Hall of 100 Columns work-camp oven/hearth
  if (m.hall100) { const pl = (id: string) => (placesJson as any).places.find((q: any) => q.id === id).at as [number, number]; // the people's places and the fires agree
    fire.add('hearth', gw(...pl('work_hearth'), 0), { ...C, note: 'masons’ work-camp hearth, Hall of 100 Columns site (C)' }); fire.add('oven', gw(...pl('oven'), 0), { ...C, note: 'bread oven for the work gang (C)' }); }
  // Phase 4 palaces (all C): torches beside the main doorway inside each roofed hall; braziers at the Tachara and Hadish
  // porticoes; a cooking hearth in the Harem court; torches at the Treasury N doorway (guard post)
  for (const b of ['tachara', 'hadish', 'harem']) { const r = (m[b] as any)?.room as number[] | undefined; if (!r) continue; const [cx, cy, sx, sy, fl] = r;
    for (const s of [-1, 1]) for (const face of [-1, 1]) fire.add('torch', gw(cx + s * (sx / 2 - 0.4), cy + face * sy / 4, fl + 2.4), { ...C, note: `torch on the ${b} hall wall (C)` }); }
  const th = (m.tachara as any)?.room as number[] | undefined, tb = (m.tachara as any)?.porticoBraziers as [number, number][] | undefined; // portico braziers between the column rows (terrace.ts, D-130)
  if (th && tb) for (const [e, n] of tb) fire.add('brazier', gw(e, n, th[4]), { ...C, note: 'brazier in the Tachara portico (C)' });
  const hd = (m.hadish as any)?.room as number[] | undefined, NC = v<any>('hadish', 'north_court');
  if (hd) for (const s of [-1, 1]) fire.add('brazier', gw(hd[0] + s * hd[2] / 3, NC.y[0] + 2, hd[4]), { ...C, note: 'brazier in the Hadish N court, before the portico (C)' });
  const hm = (m.harem as any)?.room as number[] | undefined, HC = v<any>('harem', 'court');
  if (hm) fire.add('hearth', gw(HC.x[0] + 3, (HC.y[0] + HC.y[1]) / 2, hm[4]), { ...C, note: 'cooking hearth in the Harem court (C)' });
  const TN = (v<any[]>('treasury', 'doors')).find((d: any) => d.id === 'N');
  if (m.treasury && TN) for (const s of [-1, 1]) fire.add('torch', gw(TN.at[0] + s * (TN.width / 2 + 0.6), TN.at[1] + 0.3, 2.4), { ...C, note: 'torch at the Treasury N doorway, street side (C)' });
  // the scribes' room's saucer lamp on the bench (D-221 placed it unlit): lit through the working day, the room's only
  // daylight a 1.1 m doorway (session 8; C); its body is furnish.ts's clay lamp
  const SR = (m.treasury as any)?.scribesRoom as number[] | undefined, SH = (m.treasury as any)?.scribesShelves as number[][] | undefined;
  if (SR) { const L = v<any>('treasury', 'r_scribes_room'), nb = SH?.find(([, , sx, sy]) => sx > sy), top = nb ? nb[4] : SR[4] + L.bench.height;
    fire.add('lamp', gw(L.lamp.at[0], L.lamp.at[1], top + 0.02), { ...C, sched: 'day', body: false, note: 'the scribes\' saucer lamp, lit while they work in the dim room (C)' }); }
}

/** where the Terrace fires' point lights stand (world x, y, z, mm-rounded) as FireSystem.update puts them: the fire's base
 *  + LIFT (FireSystem.add), then the light model's height (fireLight) — the fire-light occlusion bake's list (D-222) */
export function terraceFireLights(m: any, parts: any[], doorways: Doorway[] = []): { kind: FireKind; pos: [number, number, number] }[] {
  const out: { kind: FireKind; pos: [number, number, number] }[] = [];
  placeFires({ add(kind, base) { const L = fireLight(kind); out.push({ kind, pos: [base.x, base.y + L.height, base.z].map(v => Math.round(v * 1000) / 1000) as [number, number, number] }); } }, m, parts, doorways);
  return out;
}

/** D-530 (C3's ask): the court camps' cooking hearths (courtCamps.ts campItems, m === 'hearth', drawn by the camps' dressing)
 *  lit at the meal hours (the 'home' schedule: the evening meal as the light goes and the fire relit before dawn) while their
 *  tent stands (`standing(tentIndex)`: the court in residence, D-252). Call once the court's tents exist (they are laid out
 *  by the people's sim, after the fire system builds), then the fire system's extend(); returns the number added. All C */
export function addCampHearths(fire: FireSink & { extend?(): void }, items: { m: string; e: number; n: number; tent: number }[], ground: (e: number, n: number) => number, standing: (tent: number) => boolean): number {
  let k = 0;
  for (const it of items) { if (it.m !== 'hearth') continue; const y = ground(it.e, it.n); if (!Number.isFinite(y)) continue;
    fire.add('hearth', gw(it.e, it.n, y), { tier: 'C', src: 'RECON', sched: 'home', body: false, stands: () => standing(it.tent), note: 'a court camp\'s cooking hearth before its tent, lit for the meals while the tent stands (C, D-530)' }); k++; }
  fire.extend?.();
  return k;
}
