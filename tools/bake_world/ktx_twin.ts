// s18 C9 (D-740): the ETC1S low-first twin of a KTX2 a bake has just written, from the same inputs and options (size, mips,
// layers, orientation, colour space), so the page can draw it before ready and swap the UASTC mips in after
// (src/render/lowfirst.ts). Listed in public/textures/ktx_low.json under '@' + its path under public/ (the scans' own
// entries are their path under textures/, tools/bake_world/ktx_low.ts).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
const LIST = 'public/textures/ktx_low.json';
/** `args`: the `ktx create` arguments the UASTC file was made with (its inputs and output last); writes `<out>.low.ktx2` */
export function twin(KTX: string, args: string[], out: string, qlevel = process.env.QLEVEL ?? '128') {
  const drop = new Set(['--encode', '--uastc-quality', '--uastc-rdo-l', '--zstd']), a: string[] = [];
  for (let i = 0; i < args.length; i++) { if (drop.has(args[i])) { i++; continue; } if (args[i] === '--uastc-rdo') continue; a.push(args[i]); }
  const low = out.replace(/\.ktx2$/, '.low.ktx2'); a[a.length - 1] = low; // (the output is the last argument)
  const i0 = a.indexOf('create') + 1; a.splice(i0, 0, '--encode', 'basis-lz', '--clevel', '2', '--qlevel', qlevel);
  execFileSync(KTX, a, { stdio: ['ignore', 'ignore', 'inherit'] });
  const key = '@' + out.replace(/^public\//, '').replace(/\.ktx2$/, ''), j = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')) : { maps: {} };
  j.maps[key] = createHash('sha1').update(readFileSync(out)).digest('hex').slice(0, 16); j.maps = Object.fromEntries(Object.entries(j.maps).sort());
  writeFileSync(LIST, JSON.stringify(j, null, 1));
  console.log(`twin ${low}: ${(statSync(low).size / 1048576).toFixed(2)} MB (full ${(statSync(out).size / 1048576).toFixed(1)} MB)`);
}
