// frames -> renders/<stamp>/<id>.jpg (1280 px) + index.md, in the repo tree (branch s17-renders-cloud)
import { createRequire } from 'node:module'; const sharp = createRequire('/home/user/fars/package.json')('sharp');
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
const [setFile, inDir, stamp, head, notesFile] = process.argv.slice(2);
const S = JSON.parse(readFileSync(setFile, 'utf8')); const P = JSON.parse(readFileSync('/home/user/fars/tests/data/coverage_points.json', 'utf8')).points;
const notes = notesFile && existsSync(notesFile) ? JSON.parse(readFileSync(notesFile, 'utf8')) : {};
const views = [...P.filter(p => (S.ids ?? []).includes(p.id)).map(p => ({ ...p, why: `scoreboard ${p.sub}` })), ...(S.extra ?? [])];
const out = `/home/user/fars/renders/${stamp}`; mkdirSync(out, { recursive: true });
const log = existsSync(`${inDir}/log.txt`) ? readFileSync(`${inDir}/log.txt`, 'utf8') : '';
let md = `# ${stamp} (cloud eyes: headless Chromium, SwiftShader, the app's WebGL2 path ?webgl=1, Q=test, 1280x720, player lens)\n\nRendered from ${head}. CRUDE software frames, not the T4's look: quality=test and the WebGL2 backend (SwiftShader's WebGPU caps a fragment stage at 16 textures, so the terrain and hills pipelines fail there; WebGL2 has 32 units and draws the whole world). Judge placement, presence, scale, floating or sunk objects, empty ground; not tone, exposure or surface quality. Server: vite dev with NOHMR=1; world-cache puts over 100 MB dropped in the page (Playwright's pipe cannot carry them).\n\n| view | asked by | cam e,n,eye,az,pitch | day hour weather | why | what I see |\n|---|---|---|---|---|---|\n`;
for (const v of views) {
  const png = `${inDir}/${v.id}.png`; const agent = /^ask-([a-z0-9]+)-/.exec(v.id)?.[1]?.toUpperCase() ?? (v.id.startsWith('sb-') || v.id.startsWith('cov-') ? 'scoreboard' : '-');
  if (existsSync(png)) await sharp(png).resize({ width: 1280 }).jpeg({ quality: 85, mozjpeg: true }).toFile(`${out}/${v.id}.jpg`);
  const cell = s => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
  md += `| ${existsSync(png) ? `[${v.id}](${v.id}.jpg)` : `${v.id} (MISSING)`} | ${agent} | ${[v.e, v.n, v.eye, v.az, v.pitch].join(',')} | ${v.day} ${v.hour} ${v.w} | ${cell(v.why).slice(0, 160)} | ${cell(notes[v.id] ?? '')} |\n`;
}
md += `\n## Render log\n\n\`\`\`\n${log.slice(0, 6000)}\n\`\`\`\n`;
writeFileSync(`${out}/index.md`, md); console.log(out);
