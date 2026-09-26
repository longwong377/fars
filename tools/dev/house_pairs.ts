// D-234 / T-E5: pairs of neighbouring houses (street doors 6-50 m apart) for matched door views (house_preview VIEWS=...)
import { buildTownPlan } from '../../src/world/settlement/plan';
const plan = buildTownPlan(), out: string[] = [], N = +(process.argv[2] ?? 8);
for (const sid of ['q_s1', 'q_w1', 'q_s3', 'q_w2']) { const s = plan.sites.find(x => x.id === sid)!; const hs = s.plots.filter(p => p.door && (p.kind === 'house' || p.kind === 'house_large'));
  for (let k = 0; k < N / 4; k++) { const a = (k * 37 + 11) % hs.length, da = s.doorPoints(hs[a])!; let best = -1, bd = 1e9;
    hs.forEach((p, i) => { if (i === a) return; const d = s.doorPoints(p)!; const dist = Math.hypot(d.mid[0] - da.mid[0], d.mid[1] - da.mid[1]); if (dist > 6 && dist < bd) { bd = dist; best = i; } });
    if (bd < 50) out.push(`door:${sid}:${a}`, `door:${sid}:${best}`); } }
console.log(out.join(';'));
