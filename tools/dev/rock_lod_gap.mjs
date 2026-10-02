// D-600: how far apart the hills' rock pieces' levels are (public/models/land/ground.glb, lod0/1/2 per piece): the
// Hausdorff distance between consecutive levels at unit scale, over all vertices and over those above the ground (the sunk
// share of the piece's height left out; max and 99th percentile). bedrock.ts ROCK_LOD_GAP holds the result; a level is
// drawn from where its gap spans 2 px at the player's lens.
// Needs (not in package.json): npm i --no-save @gltf-transform/core @gltf-transform/extensions draco3dgltf
// Usage: node tools/dev/rock_lod_gap.mjs
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(new URL('../../public/models/land/ground.glb', import.meta.url).pathname);
const meshes = {};
for (const node of doc.getRoot().listNodes()) { const m = node.getMesh(); if (!m) continue;
  const M = node.getWorldMatrix(); const tris = [];
  for (const p of m.listPrimitives()) { const pos = p.getAttribute('POSITION'), idx = p.getIndices(); const P = [];
    for (let i = 0; i < pos.getCount(); i++) { const v = pos.getElement(i, []); P.push([M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12], M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13], M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]]); }
    for (let i = 0; i < idx.getCount(); i += 3) tris.push([P[idx.getScalar(i)], P[idx.getScalar(i + 1)], P[idx.getScalar(i + 2)]]); }
  meshes[node.getName()] = tris; }
// one-sided Hausdorff from the vertices of A to the surface of B (point-triangle distance), both ways
function ptTri(p, [a, b, c]) { // Ericson's closest point on triangle
  const sub=(u,v)=>[u[0]-v[0],u[1]-v[1],u[2]-v[2]],dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2],add=(u,v)=>[u[0]+v[0],u[1]+v[1],u[2]+v[2]],mul=(u,s)=>[u[0]*s,u[1]*s,u[2]*s];
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap); let q;
  if(d1<=0&&d2<=0)q=a;else{const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)q=b;else{const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)q=add(a,mul(ab,d1/(d1-d3)));else{const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)q=c;else{const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)q=add(a,mul(ac,d2/(d2-d6)));else{const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)q=add(b,mul(sub(c,b),(d4-d3)/((d4-d3)+(d5-d6))));else{const den=1/(va+vb+vc);q=add(a,add(mul(ab,vb*den),mul(ac,vc*den)));}}}}}}
  const d=sub(p,q);return Math.sqrt(dot(d,d));}
const haus = (A, B) => { let w = 0; const vs = A.flat(); for (let i = 0; i < vs.length; i += 3) { let m = Infinity; for (const t of B) { m = Math.min(m, ptTri(vs[i], t)); if (m < 1e-4) break; } w = Math.max(w, m); } return w; };
const ids = [...new Set(Object.keys(meshes).map(k => k.split('__')[0]))];
for (const id of ids) { const L = [0,1,2].map(l => meshes[`${id}__lod${l}`]); if (L.some(x => !x)) continue;
  const h01 = Math.max(haus(L[0], L[1]), haus(L[1], L[0])), h12 = Math.max(haus(L[1], L[2]), haus(L[2], L[1]));
  console.log(id, `tris ${L.map(x=>x.length).join('/')}`, `lod0-1 ${(h01*100).toFixed(1)} cm, lod1-2 ${(h12*100).toFixed(1)} cm (unit scale)`); }
// above the ground only: vertices higher than the sunk share of the piece's height (outcrop 0.18, the rest 0.3), and the 99th percentile
const above = (A, B, share) => { const vs = A.flat(); let lo = Infinity, hi = -Infinity; for (const v of vs) { lo = Math.min(lo, v[1]); hi = Math.max(hi, v[1]); }
  const cut = lo + (hi - lo) * share, ds = []; for (let i = 0; i < vs.length; i += 3) { if (vs[i][1] < cut) continue; let m = Infinity; for (const t of B) { m = Math.min(m, ptTri(vs[i], t)); if (m < 1e-4) break; } ds.push(m); }
  ds.sort((a, b) => a - b); return [ds[ds.length - 1], ds[Math.floor(ds.length * 0.99)]]; };
for (const id of ids) { const L = [0,1,2].map(l => meshes[`${id}__lod${l}`]); const sh = id.startsWith('outcrop') ? 0.18 : 0.3;
  const a = above(L[0], L[1], sh), b = above(L[1], L[0], sh), c = above(L[1], L[2], sh), d = above(L[2], L[1], sh);
  console.log(id, `above ground: lod0-1 max ${(Math.max(a[0], b[0])*100).toFixed(1)} p99 ${(Math.max(a[1], b[1])*100).toFixed(1)} cm; lod1-2 max ${(Math.max(c[0], d[0])*100).toFixed(1)} p99 ${(Math.max(c[1], d[1])*100).toFixed(1)} cm`); }
