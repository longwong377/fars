// KTX2 (Basis UASTC/ETC1S) → PNG in node (s18 C14, D-790): the built animals' maps decoded so a derived model can start from
// a library model's processed body (the library sources themselves are not kept in git). Uses three's basis transcoder and sharp.
//   node tools/blender/lib/ktx2png.mjs <in.ktx2> <out.png>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
export async function ktx2rgba(file) {
  const dir = new URL('../../../node_modules/three/examples/jsm/libs/basis/', import.meta.url);
  const src = readFileSync(new URL('basis_transcoder.js', dir), 'utf8'), wasmBinary = readFileSync(new URL('basis_transcoder.wasm', dir));
  const m = { exports: {} }; new Function('module', 'exports', 'require', '__dirname', src + '\nmodule.exports = BASIS;')(m, m.exports, require, dir.pathname);
  const B = await m.exports({ wasmBinary }); B.initializeBasis();
  const k = new B.KTX2File(new Uint8Array(readFileSync(file))); if (!k.isValid()) throw new Error('not a KTX2 file: ' + file);
  const w = k.getWidth(), h = k.getHeight(); if (!k.startTranscoding()) throw new Error('transcode start failed');
  const RGBA32 = 13, dst = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
  if (!k.transcodeImage(dst, 0, 0, 0, RGBA32, 0, -1, -1)) throw new Error('transcode failed'); k.close(); k.delete();
  return { w, h, data: dst };
}
if (import.meta.url === `file://${process.argv[1]}`) { const [, , i, o] = process.argv; const { w, h, data } = await ktx2rgba(i); await sharp(Buffer.from(data), { raw: { width: w, height: h, channels: 4 } }).png().toFile(o); console.log(o, w, h); }
