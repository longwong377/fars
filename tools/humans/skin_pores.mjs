// s18 C14 (D-790): the skin's micro-relief tile: a ShareTextures "Human Skin" height map (CC0, 4K tileable; branch
// s18-face-assets assets-raw/faces/skin/sharetextures) brought to 1024^2, high-passed (the scan's broad undulation out),
// normalised to mean 0.5 and a fixed spread, kept tileable (the resize of a tileable map stays tileable; the high-pass wraps).
// tools/bake_world/ktx_humans.ts puts it in the skin layers' alpha; humanMaterial.ts lays it triplanar (SKIN.microTile m a repeat).
//   node tools/humans/skin_pores.mjs <height.jpg> tools/humans/data/skin_pores.png
import sharp from 'sharp';
const [inp, out] = process.argv.slice(2), N = 1024, SD = 0.12;
const { data } = await sharp(inp).greyscale().resize(N, N, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
const h = Float64Array.from(data, x => x / 255);
// a wrapped box blur (three passes ~ Gaussian) of radius R: the high-pass's low band
const blur = (a, R) => { let s = a; for (let p = 0; p < 3; p++) { const t = new Float64Array(N * N), u = new Float64Array(N * N);
  for (let y = 0; y < N; y++) { let acc = 0; for (let k = -R; k <= R; k++) acc += s[y * N + ((k + N) % N)]; for (let x = 0; x < N; x++) { t[y * N + x] = acc / (2 * R + 1); acc += s[y * N + ((x + R + 1) % N)] - s[y * N + ((x - R + N) % N)]; } }
  for (let x = 0; x < N; x++) { let acc = 0; for (let k = -R; k <= R; k++) acc += t[((k + N) % N) * N + x]; for (let y = 0; y < N; y++) { u[y * N + x] = acc / (2 * R + 1); acc += t[((y + R + 1) % N) * N + x] - t[((y - R + N) % N) * N + x]; } }
  s = u; } return s; };
const lo = blur(h, 24), hp = h.map((v, i) => v - lo[i]); let m = 0, v = 0; for (const x of hp) m += x; m /= hp.length; for (const x of hp) v += (x - m) ** 2; const sd = Math.sqrt(v / hp.length);
const o = Buffer.from(hp.map(x => Math.max(0, Math.min(255, Math.round(255 * (0.5 + (x - m) / sd * SD))))));
await sharp(o, { raw: { width: N, height: N, channels: 1 } }).png().toFile(out);
console.log(`[skin pores] ${inp} -> ${out}: high-pass sd ${(sd * 255).toFixed(2)} levels, stored at sd ${SD}`);
