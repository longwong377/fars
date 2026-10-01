// Brief generator (session 14, UD-28): one context pack in, one guard-compliant brief out. The fixed clauses are copied
// verbatim from handoff/agent_template.md with the slots filled; then the machine section, the operating model and the pack.
//   node tools/dev/brief.mjs handoff/briefs/s14/packs.json [name]   -> handoff/briefs/s14/<name>.md (all packs, or one)
// A pack: { name, title, hours, needs: 'node'|'gpu'|'blender', ud: [..], thresholds: [..], d, q: [q0, q1], b: [b0, b1],
//   goal, owns: [..], reads: [..], entry: [..], ids: [..], commands: [..], done, train: [..], notes? }
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const [packFile, only] = process.argv.slice(2);
const tpl = readFileSync('handoff/agent_template.md', 'utf8'), TH = JSON.parse(readFileSync('gates/thresholds.json', 'utf8')).thresholds;
const sec = (a, b) => { const i = tpl.indexOf(a), j = b ? tpl.indexOf(b, i + 1) : -1; return tpl.slice(i, j < 0 ? undefined : j).trim(); };
const fixed = sec('## Fixed clauses', '## Slots'), machine = sec('## Machine section', '## Operating model'), ops = sec('## Operating model');
const list = (xs, pre = '- ') => (xs ?? []).map(x => pre + x).join('\n') || '- (none)';
for (const p of JSON.parse(readFileSync(packFile, 'utf8')).filter(p => !only || p.name === only)) {
  const th = p.thresholds.map(id => { const r = TH.find(t => t.id === id); return r ? `${id}: "${r.metric}" ${r.op} ${r.value} ${r.unit}` : id; }).join('; ');
  const body = fixed // verbatim (the guard checks every literal piece); the real tree is in the pack
    .replace('{UD ids}', p.ud.join(', ')).replace(/\{T- ids[^}]*\}/, th)
    .replace('{n ≤ 2}', p.needs === 'node' ? '0' : '2').replace('{d}', String(p.d)).replace('{q0}', String(p.q[0])).replace('{q1}', String(p.q[1]))
    .replace('{b0}', String(p.b[0])).replace('{b1}', String(p.b[1]));
  const md = `# Brief s14/${p.name}: ${p.title}\n\n${body}\n\n${machine}\n\n${ops}\n\n## Your context pack\n` +
    `**Your tree:** C:/Users/Administrator/fars-wt/${p.name} (branch s14-${p.name}; the fixed clause's /home/user path is the cloud's).

**Goal (as the player meets it):** ${p.goal}\n\n**Time box:** ${p.hours} h. **Needs:** ${p.needs}. **Reserved:** D-${p.d}, Q-${p.q[0]}..Q-${p.q[1]}, B${p.b[0]}..B${p.b[1]}.\n\n` +
    `**Files you own:**\n${list(p.owns)}\n\n**Read-only, for context:**\n${list(p.reads)}\n\n**Start here (entry points):**\n${list(p.entry)}\n\n` +
    `**Decisions and blockers that matter (grep these ids, do not read the files whole):** ${(p.ids ?? []).join(', ') || '(none)'}\n\n` +
    `**Commands:**\n${list(p.commands)}\n\n**Done line:** ${p.done}\n\n**Render-train views to request:** ${(p.train ?? []).join(', ') || '(none: node-only)'}\n` +
    (p.notes ? `\n**Notes:** ${p.notes}\n` : '');
  writeFileSync(join(dirname(packFile), `${p.name}.md`), md); console.log(`${p.name}.md`);
}
