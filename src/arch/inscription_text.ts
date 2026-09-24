// What a carved panel carries (D-177): the one path from src/data/inscriptions.json to carved characters, used by every
// carving (decor.ts, the Terrace; world/plain/naqsh.ts, Naqsh-e Rustam) and by the tests. Old Persian is the stored sign
// sequence (op_signs, built by tools/build_op_signs.ts from ARIo's words, Kent's rules and Kent's transliteration), never
// re-derived here; Elamite and Babylonian are the ATF converted sign by sign (tools/build_inscriptions.py).
import inscriptions from '../data/inscriptions.json';
import { carvedLines } from '../lang/oldPersian';

export type Version = 'op' | 'el' | 'bab';
export interface PanelText { font: 'op' | 'cun'; lines: string[]; lined: boolean }
const INS = inscriptions as Record<string, any>;
/** the carved text of one version of an inscription: its lines of characters and whether they are the inscription's own
 *  lines (Old Persian with Kent's lineation) or a run of text the panel flows (Elamite, Babylonian, and DPc/DPh without a
 *  lineation read); null if the version does not exist */
export function panelText(id: string, ver: Version): PanelText | null {
  const t = INS[id]; if (!t) return null;
  if (ver === 'op') return t.op_signs?.length ? { font: 'op', lines: carvedLines(t.op_signs), lined: !!t.op_lined } : null;
  const s: string = ver === 'el' ? t.el_cuneiform : t.bab_cuneiform;
  return s ? { font: 'cun', lines: [s], lined: false } : null;
}
/** every inscription id that has a text */
export const inscriptionIds = () => Object.keys(INS).filter(k => k !== '_meta');
