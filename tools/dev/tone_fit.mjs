// D-309: fit the AgX look (slope, power, saturation, exposure; src/render/toneLook.ts) that carries midday world renders'
// tone statistics (the lower 60 % of the frame: luma p5/p25/p50/p75/p95 and mean saturation) onto sunlit photographs'.
// Each render pixel is inverted through plain AgX (the curve it was drawn with) to its log-domain value, then re-toned with
// a candidate look. Usage: node tools/dev/tone_fit.mjs <photos…> -- <renders…>
import sharp from 'sharp';
const args = process.argv.slice(2), k = args.indexOf('--'), photos = args.slice(0, k), renders = args.slice(k + 1);
const sigmoid = x => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; };
const M_OUT = [1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405];
const R2S = [1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187];
const mulC = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const inv3 = m => { // column-major 3×3 inverse
  const a = m[0], b = m[3], c = m[6], d = m[1], e = m[4], f = m[7], g = m[2], h = m[5], i = m[8];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  const r = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map(x => x / det); // row-major
  return [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]]; };
const OUTi = inv3(M_OUT), R2Si = inv3(R2S);
const toLin = u => { u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
const toS = l => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);
const sigInv = y => { let lo = 0, hi = 1; for (let j = 0; j < 30; j++) { const m = (lo + hi) / 2; if (sigmoid(m) < y) lo = m; else hi = m; } return (lo + hi) / 2; };
async function pix(f) { const { data, info } = await sharp(f).resize(200, null).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const out = [];
  for (let y = Math.floor(info.height * 0.4); y < info.height; y++) for (let x = 0; x < info.width; x++) { const i = (y * info.width + x) * 3; out.push([data[i], data[i + 1], data[i + 2]]); } return out; }
function stats(P) { const L = P.map(([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b).sort((a, b) => a - b), n = L.length; let s = 0;
  for (const [r, g, b] of P) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); s += mx ? (mx - mn) / mx : 0; }
  return [0.05, 0.25, 0.5, 0.75, 0.95].map(q => L[Math.floor(n * q)]).concat([s / n]); }
const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const PS = []; for (const f of photos) PS.push(stats(await pix(f)));
const target = PS[0].map((_, j) => med(PS.map(s => s[j])));
const fmt = s => s.map((x, j) => x.toFixed(j === 5 ? 2 : 0)).join(' ');
console.log(`photos ${photos.length}  target p5 p25 p50 p75 p95 sat: ${fmt(target)}`);
const R = [];
for (const f of renders) { const P = await pix(f); R.push(P.map(p => { const d = mulC(R2Si, p.map(toLin)); const o = mulC(OUTi, d.map(x => Math.pow(Math.max(x, 0), 1 / 2.2))); return o.map(x => sigInv(Math.min(1, Math.max(0, x)))); })); }
const tone = (v, L) => { const dv = Math.log2(L.exposure) / (4.026069 + 12.47393);
  let c = v.map(x => sigmoid(Math.min(1, Math.max(0, x + dv)))).map(x => Math.pow(Math.max(0, x * L.slope), L.power));
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; c = c.map(x => y + L.sat * (x - y));
  c = mulC(M_OUT, c).map(x => Math.pow(Math.max(0, x), 2.2)); return mulC(R2S, c).map(x => toS(Math.min(1, Math.max(0, x)))); };
const rstat = L => { const S = R.map(P => stats(P.map(v => tone(v, L)))); return S[0].map((_, j) => S.reduce((a, s) => a + s[j], 0) / S.length); };
const err = s => s.slice(0, 5).reduce((a, x, j) => a + ((x - target[j]) / 40) ** 2, 0) + ((s[5] - target[5]) / 0.05) ** 2;
const base = { slope: 1, power: 1, sat: 1, exposure: 1 }, b0 = rstat(base);
console.log(`renders ${renders.length}  as drawn (via the inversion): ${fmt(b0)}  err ${err(b0).toFixed(2)}`);
let best = { L: base, e: err(b0), s: b0 };
for (const exposure of [1, 1.15, 1.3, 1.5, 1.75, 2, 2.3, 2.6]) for (const power of [0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5]) for (const sat of [0.9, 1, 1.1, 1.2, 1.3, 1.4]) for (const slope of (process.env.SLOPES ?? "1,1.05,1.1").split(",").map(Number)) {
  const L = { slope, power, sat, exposure }, s = rstat(L), e = err(s); if (e < best.e) best = { L, e, s }; }
console.log(`best ${JSON.stringify(best.L)}: ${fmt(best.s)}  err ${best.e.toFixed(2)}`);
