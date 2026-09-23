// MakeHuman data readers for the human asset build (D-016). Only the CC0 data formats are read here (OBJ meshes,
// .target vertex offsets, MHCLO proxy fitting, JSON rigs and weights); no MakeHuman program code is used.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAW = 'https://raw.' + 'githubusercontent.com/makehumancommunity/';
/** MakeHuman 1.x repository data (CC0 assets; LICENSE.md §C) */
export const MH_URL = RAW + 'makehuman/master/makehuman/';
/** MPFB2 repository data (CC0 assets; LICENSE.md §C): the game-engine rig and its weights, base-mesh vertex groups */
export const MPFB_URL = RAW + 'mpfb2/master/';
export const CACHE = 'data/makehuman';

/** fetch a file into data/makehuman/ (cached; large raw files stay out of git) */
export async function fetchCached(url: string, local: string): Promise<Buffer> {
  const path = `${CACHE}/${local}`;
  if (existsSync(path)) return readFileSync(path);
  mkdirSync(dirname(path), { recursive: true });
  let buf: Buffer | null = null;
  try { const r = await fetch(url); if (r.ok) buf = Buffer.from(await r.arrayBuffer()); else if (r.status === 404) throw new Error(`404 ${url}`); }
  catch (e) { if (String(e).includes('404')) throw e; }
  if (!buf) { // node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set; curl honours it
    execFileSync('curl', ['-sSfL', '--retry', '3', '-o', path, url], { stdio: ['ignore', 'ignore', 'inherit'] });
    buf = readFileSync(path);
  } else writeFileSync(path, buf);
  return buf;
}
export const mh = (p: string) => fetchCached(MH_URL + p, 'mh/' + p);
export const mpfb = (p: string) => fetchCached(MPFB_URL + p, 'mpfb/' + p);
/** true if a MakeHuman target exists (cached negative lookups avoid refetching) */
export async function mhTry(p: string): Promise<Buffer | null> { try { return await mh(p); } catch (e) { if (String(e).includes('404')) return null; throw e; } }

export interface Obj { v: Float64Array; vt: Float64Array; faces: { g: string; v: number[]; t: number[] }[] }
export function parseObj(text: string): Obj {
  const v: number[] = [], vt: number[] = [], faces: Obj['faces'] = []; let g = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) { const s = line.split(/\s+/); v.push(+s[1], +s[2], +s[3]); }
    else if (line.startsWith('vt ')) { const s = line.split(/\s+/); vt.push(+s[1], +s[2]); }
    else if (line.startsWith('g ')) g = line.slice(2).trim();
    else if (line.startsWith('f ')) { const s = line.trim().split(/\s+/).slice(1); faces.push({ g, v: s.map(x => +x.split('/')[0] - 1), t: s.map(x => +(x.split('/')[1] || 0) - 1) }); }
  }
  return { v: Float64Array.from(v), vt: Float64Array.from(vt), faces };
}
export interface Target { idx: Int32Array; d: Float64Array }
export function parseTarget(text: string): Target {
  const idx: number[] = [], d: number[] = [];
  for (const line of text.split('\n')) { if (!line || line[0] === '#') continue; const s = line.trim().split(/\s+/); if (s.length < 4) continue; idx.push(+s[0]); d.push(+s[1], +s[2], +s[3]); }
  return { idx: Int32Array.from(idx), d: Float64Array.from(d) };
}
export function applyTarget(pos: Float64Array, t: Target, w: number) {
  if (!w) return; for (let k = 0; k < t.idx.length; k++) { const i = t.idx[k] * 3; pos[i] += w * t.d[k * 3]; pos[i + 1] += w * t.d[k * 3 + 1]; pos[i + 2] += w * t.d[k * 3 + 2]; }
}
export interface Mhclo { refs: Int32Array; w: Float64Array; off: Float64Array; scale: { x: [number, number, number]; y: [number, number, number]; z: [number, number, number] } }
export function parseMhclo(text: string): Mhclo {
  const refs: number[] = [], w: number[] = [], off: number[] = []; const scale: any = {}; let inVerts = false;
  for (const line of text.split('\n')) {
    const s = line.trim().split(/\s+/); if (!s[0] || s[0][0] === '#') continue;
    if (/^[xyz]_scale$/.test(s[0])) { scale[s[0][0]] = [+s[1], +s[2], +s[3]]; continue; }
    if (s[0] === 'verts') { inVerts = true; continue; }
    if (inVerts && /^\d/.test(s[0])) {
      if (s.length === 1) { refs.push(+s[0], +s[0], +s[0]); w.push(1, 0, 0); off.push(0, 0, 0); }
      else { refs.push(+s[0], +s[1], +s[2]); w.push(+s[3], +s[4], +s[5]); off.push(+s[6], +s[7], +s[8]); }
    } else if (inVerts) inVerts = false;
  }
  return { refs: Int32Array.from(refs), w: Float64Array.from(w), off: Float64Array.from(off), scale };
}
/** fit a proxy's vertices to a (morphed) base mesh: barycentric blend of three base vertices + scaled offset */
export function fitMhclo(c: Mhclo, base: Float64Array): Float64Array {
  const n = c.refs.length / 3, out = new Float64Array(n * 3);
  const sc = (a: [number, number, number], k: number) => Math.abs(base[a[0] * 3 + k] - base[a[1] * 3 + k]) / a[2];
  const s = [sc(c.scale.x, 0), sc(c.scale.y, 1), sc(c.scale.z, 2)];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    let p = 0; for (let j = 0; j < 3; j++) p += c.w[i * 3 + j] * base[c.refs[i * 3 + j] * 3 + k];
    out[i * 3 + k] = p + c.off[i * 3 + k] * s[k];
  }
  return out;
}

/** MakeHuman macro-modifier weights (the published target-naming scheme: gender × age × muscle × weight) */
export function ageYearsToValue(y: number) { return y <= 11 ? Math.max(0, (y - 1) / 10) * 0.1875 : y <= 25 ? 0.1875 + (y - 11) / 14 * 0.3125 : Math.min(1, 0.5 + (y - 25) / 65 * 0.5); }
export function ageWeights(v: number): Record<string, number> {
  if (v < 0.1875) return { baby: 1 - v / 0.1875, child: v / 0.1875 };
  if (v < 0.5) return { child: 1 - (v - 0.1875) / 0.3125, young: (v - 0.1875) / 0.3125 };
  return { young: 1 - (v - 0.5) / 0.5, old: (v - 0.5) / 0.5 };
}
export function triWeights(v: number, n: [string, string, string]): Record<string, number> {
  return v < 0.5 ? { [n[0]]: 1 - v / 0.5, [n[1]]: v / 0.5 } : { [n[1]]: 1 - (v - 0.5) / 0.5, [n[2]]: (v - 0.5) / 0.5 };
}
export interface Macro { gender: number; age: number; muscle: number; weight: number; height: number; proportions: number; blend: [number, number, number] }
/** list of (target path, weight) for a macro setting */
export function macroTargets(m: Macro): [string, number][] {
  const out: [string, number][] = [];
  const G = { female: 1 - m.gender, male: m.gender }, A = ageWeights(m.age);
  const M = triWeights(m.muscle, ['minmuscle', 'averagemuscle', 'maxmuscle']), W = triWeights(m.weight, ['minweight', 'averageweight', 'maxweight']);
  const races = ['african', 'asian', 'caucasian'] as const; const bsum = m.blend[0] + m.blend[1] + m.blend[2];
  for (const [g, gw] of Object.entries(G)) { if (gw < 1e-4) continue;
    for (const [a, aw] of Object.entries(A)) { if (aw < 1e-4) continue;
      races.forEach((r, i) => { const w = gw * aw * m.blend[i] / bsum; if (w > 1e-4) out.push([`data/targets/macrodetails/${r}-${g}-${a}.target`, w]); });
      for (const [mu, mw] of Object.entries(M)) { if (mw < 1e-4) continue;
        for (const [we, ww] of Object.entries(W)) { const w = gw * aw * mw * ww; if (w < 1e-4) continue;
          out.push([`data/targets/macrodetails/universal-${g}-${a}-${mu}-${we}.target`, w]);
          if (Math.abs(m.height - 0.5) > 1e-3) out.push([`data/targets/macrodetails/height/${g}-${a}-${mu}-${we}-${m.height > 0.5 ? 'maxheight' : 'minheight'}.target`, w * Math.abs(m.height - 0.5) * 2]);
          if (m.proportions > 0.5 + 1e-3) out.push([`data/targets/macrodetails/proportions/${g}-${a}-${mu}-${we}-idealproportions.target`, w * (m.proportions - 0.5) * 2]);
          if (m.proportions < 0.5 - 1e-3) out.push([`data/targets/macrodetails/proportions/${g}-${a}-${mu}-${we}-uncommonproportions.target`, w * (0.5 - m.proportions) * 2]);
        } } } }
  return out;
}
/** face/detail modifier (group, name, value −1..1) → target path + weight (min/max pair naming from modeling_modifiers.json) */
export function modifierTarget(group: string, name: string, v: number, pair: [string, string]): [string, number] {
  return [`data/targets/${group}/${name}-${v < 0 ? pair[0] : pair[1]}.target`, Math.abs(v)];
}
