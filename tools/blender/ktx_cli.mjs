// A stand-in for the KTX-Software `ktx` CLI (session 17, cloud: its release downloads are blocked there), over the npm
// ktx2-encoder (Basis Universal WASM). It accepts the one call tools/blender/build.mjs makes:
//   ktx --version
//   ktx create --format R8G8B8A8_UNORM --assign-tf linear|srgb --encode uastc --uastc-quality N --zstd L --generate-mipmap in.png out.ktx2
// UASTC with zstd supercompression and mipmaps, like ktx.exe's output (not byte-identical: a different encoder build).
// Use: KTX=tools/blender/ktx_cli.sh node tools/blender/build.mjs <id>   (needs `npm i --no-save ktx2-encoder`)
import { readFileSync, writeFileSync } from 'node:fs';
const a = process.argv.slice(2);
if (a.includes('--version')) { console.log('ktx version: v4.4.2-compatible (ktx2-encoder, Basis Universal WASM)'); process.exit(0); }
if (a[0] !== 'create') { console.error('ktx_cli: only `create` and `--version`'); process.exit(2); }
const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
const files = a.filter((x, i) => !x.startsWith('--') && i > 0 && !a[i - 1].startsWith('--') || (i > 0 && ['--generate-mipmap'].includes(a[i - 1]) && !x.startsWith('--')));
const [inp, out] = files.slice(-2);
const { encodeToKTX2 } = await import('ktx2-encoder');
const sharp = (await import('sharp')).default;
const imageDecoder = async buf => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const k2 = await encodeToKTX2(new Uint8Array(readFileSync(inp)), {
  isUASTC: (opt('--encode') ?? 'uastc') === 'uastc', uastcLDRQualityLevel: Math.min(3, +(opt('--uastc-quality') ?? 2)),
  needSupercompression: opt('--zstd') !== undefined, generateMipmap: a.includes('--generate-mipmap'),
  isSetKTX2SRGBTransferFunc: opt('--assign-tf') === 'srgb', isKTX2File: true, imageDecoder,
});
writeFileSync(out, k2); console.log(`ktx_cli: ${inp} -> ${out} (${k2.length} B)`);
