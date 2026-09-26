// Activity-coverage lint (brief §9.5: "an activity-coverage check fails the build if any simulated activity lacks a
// visible performance or uses a placeholder"). Run by tests/performances.test.ts (npm test) over the registry in
// activities.ts: every activity and every variant must name a pose cycle that exists, props with geometry, work objects
// and animals that exist, and a sound the soundscape plays; none may be a placeholder or abstract-only. Returns the
// list of problems (empty = pass), so a test can also prove that a placeholder added back would fail it.
import { ANIMS } from './anim';
import { PROPS, propGeometry } from './props';
import { WORK_NOTES } from './workObjects';
import { SPECIES } from './animals';
import { PIECES } from './outfits';
import { STRIKE_KINDS, LAYER_SOUNDS } from '../audio/soundscape';
import { impFallback } from './impostors';
import type { Performance } from './activities';

export function activityLint(registry: Record<string, Performance>): string[] {
  const bad: string[] = [];
  const sounds = new Set<string>([...STRIKE_KINDS, ...LAYER_SOUNDS]);
  const check = (id: string, P: Partial<Performance>, where: string) => {
    if (P.placeholder) bad.push(`${id}${where}: flagged placeholder (no performance)`);
    if (P.abstractOnly) bad.push(`${id}${where}: abstract-only (never rendered)`);
    if (P.note !== undefined && /PLACEHOLDER/.test(P.note)) bad.push(`${id}${where}: its note says PLACEHOLDER`);
    if (P.anim !== undefined && !ANIMS.includes(P.anim)) bad.push(`${id}${where}: pose cycle '${P.anim}' does not exist`);
    // D-229: distance never breaks it (§9.5): the pose cycle has impostor frames of its own (impostors.ts IMP_MAP), not the standing frame
    if (P.anim !== undefined && ANIMS.includes(P.anim) && impFallback(P.anim)) bad.push(`${id}${where}: pose cycle '${P.anim}' has no impostor frame (drawn standing beyond the skinned crowd)`);
    for (const k of [P.prop, P.prop2]) if (k && (!PROPS[k] || !propGeometry(PROPS[k].geom))) bad.push(`${id}${where}: prop '${k}' has no geometry`);
    if (P.sound && !sounds.has(P.sound)) bad.push(`${id}${where}: sound '${P.sound}' is not played by the soundscape`);
    for (const w of P.work ?? []) if (!WORK_NOTES[w.kind]) bad.push(`${id}${where}: work object '${w.kind}' does not exist`);
    for (const s of P.animals?.species ?? []) if (!SPECIES.includes(s)) bad.push(`${id}${where}: animal '${s}' does not exist`);
    for (const k of P.wear ?? []) if (!PIECES[k]) bad.push(`${id}${where}: worn piece '${k}' does not exist (D-209)`);
    if (P.tier !== undefined && !['A', 'B', 'C'].includes(P.tier)) bad.push(`${id}${where}: bad tier ${P.tier}`);
    if (P.note !== undefined && P.note.trim().length < 4) bad.push(`${id}${where}: no note`);
  };
  for (const [id, P] of Object.entries(registry)) {
    if (!P) { bad.push(`${id}: no performance`); continue; }
    check(id, P, '');
    (P.variants ?? []).forEach((v, i) => check(id, v, ` (variant ${i})`));
  }
  return bad;
}
